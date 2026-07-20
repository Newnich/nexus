-- =========================================================================
-- NEXUS Database Schema
-- =========================================================================
-- Run this in the Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql/new)
-- Then run: npx tsx scripts/seed.ts
-- =========================================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "vector"; -- pgvector for semantic search

-- ── Users Table ──
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  avatar_url TEXT,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'team', 'enterprise')),
  ai_settings JSONB NOT NULL DEFAULT '{
    "organizationStyle": "auto",
    "summaryLength": "medium",
    "connectionAggressiveness": 0.5,
    "autoTag": true,
    "autoCategorize": true,
    "dailyDigest": true,
    "weeklyReport": false
  }',
  preferences JSONB NOT NULL DEFAULT '{
    "theme": "dark",
    "defaultView": "grid",
    "itemsPerPage": 50,
    "enableSpatialView": true,
    "keyboardShortcuts": {}
  }',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Items Table ──
CREATE TABLE IF NOT EXISTS items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('link', 'note', 'file', 'image', 'screenshot', 'voice_memo', 'pdf', 'video')),
  title TEXT NOT NULL,
  UNIQUE(user_id, title),
  content TEXT DEFAULT '',
  extracted_text TEXT DEFAULT '',
  metadata JSONB NOT NULL DEFAULT '{}',
  ai_data JSONB DEFAULT NULL,
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'team', 'public')),
  is_favorite BOOLEAN NOT NULL DEFAULT false,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accessed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Items full-text search index ──
-- Note: user_id lookup is covered by the UNIQUE(user_id, title) constraint's b-tree index
CREATE INDEX IF NOT EXISTS idx_items_type ON items(type);
CREATE INDEX IF NOT EXISTS idx_items_created_at ON items(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_items_favorite ON items(user_id, is_favorite) WHERE is_favorite = true;
CREATE INDEX IF NOT EXISTS idx_items_fts ON items USING GIN(to_tsvector('english', coalesce(title, '') || ' ' || coalesce(extracted_text, '')));

-- pgvector index for semantic search (cosine distance)
CREATE INDEX IF NOT EXISTS idx_items_embedding ON items USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ── Collections Table ──
CREATE TABLE IF NOT EXISTS collections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  UNIQUE(user_id, name),
  description TEXT DEFAULT '',
  type TEXT NOT NULL DEFAULT 'manual' CHECK (type IN ('manual', 'auto', 'query')),
  icon TEXT DEFAULT '📁',
  color TEXT DEFAULT '#6366f1',
  parent_id UUID REFERENCES collections(id) ON DELETE SET NULL,
  item_count INTEGER NOT NULL DEFAULT 0,
  rules JSONB DEFAULT NULL,
  query_config JSONB DEFAULT NULL,
  ai_data JSONB DEFAULT NULL,
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'team', 'public')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_collections_user ON collections(user_id);
CREATE INDEX IF NOT EXISTS idx_collections_parent ON collections(parent_id);

-- ── Collection-Items Junction ──
CREATE TABLE IF NOT EXISTS collection_items (
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  added_by UUID REFERENCES users(id),
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (collection_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_collection_items_item ON collection_items(item_id);

-- ── Connections Table ──
CREATE TABLE IF NOT EXISTS connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  from_item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  to_item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('semantic', 'temporal', 'manual', 'inferred', 'citation', 'domain')),
  strength FLOAT NOT NULL DEFAULT 0.5 CHECK (strength >= 0 AND strength <= 1),
  label TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(from_item_id, to_item_id, type)
);

CREATE INDEX IF NOT EXISTS idx_connections_user ON connections(user_id);
CREATE INDEX IF NOT EXISTS idx_connections_from ON connections(from_item_id);
CREATE INDEX IF NOT EXISTS idx_connections_to ON connections(to_item_id);
CREATE INDEX IF NOT EXISTS idx_connections_strength ON connections(strength DESC);

-- ── AI Processing Queue ──
CREATE TABLE IF NOT EXISTS ai_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  priority INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_queue_status ON ai_queue(status);

-- ── Activity Log ──
CREATE TABLE IF NOT EXISTS activity_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_log(user_id, created_at DESC);

-- ── Semantic Search Function (pgvector) ──
-- Returns items ranked by cosine similarity to a query embedding
CREATE OR REPLACE FUNCTION search_items(
  query_embedding vector(768),
  user_id_param UUID,
  match_count INT DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  type TEXT,
  content TEXT,
  extracted_text TEXT,
  metadata JSONB,
  ai_data JSONB,
  visibility TEXT,
  is_favorite BOOLEAN,
  is_archived BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  accessed_at TIMESTAMPTZ,
  similarity FLOAT
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    items.id, items.title, items.type, items.content,
    items.extracted_text, items.metadata, items.ai_data,
    items.visibility, items.is_favorite, items.is_archived,
    items.created_at, items.updated_at, items.accessed_at,
    1 - (items.embedding <=> query_embedding) AS similarity
  FROM items
  WHERE items.user_id = user_id_param
    AND items.embedding IS NOT NULL
  ORDER BY items.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ── Automatic Timestamps ──
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_items_updated_at
  BEFORE UPDATE ON items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_collections_updated_at
  BEFORE UPDATE ON collections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Auto-update collection item_count ──
CREATE OR REPLACE FUNCTION update_collection_item_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE collections SET item_count = item_count + 1 WHERE id = NEW.collection_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE collections SET item_count = GREATEST(0, item_count - 1) WHERE id = OLD.collection_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_collection_item_count
  AFTER INSERT OR DELETE ON collection_items
  FOR EACH ROW EXECUTE FUNCTION update_collection_item_count();
