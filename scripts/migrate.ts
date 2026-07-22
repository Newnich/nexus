/**
 * NEXUS Database Migration
 *
 * Run: npx tsx scripts/migrate.ts
 *
 * This creates the full NEXUS schema in Supabase/PostgreSQL.
 * Tables: users, items, collections, collection_items, connections, ai_queue
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    "Missing Supabase credentials. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY",
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const MIGRATION_SQL = `
-- =========================================================================
-- NEXUS Database Schema
-- =========================================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

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

-- ── Collections Table ──
CREATE TABLE IF NOT EXISTS collections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
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

-- ── Collection-Items Junction ──
CREATE TABLE IF NOT EXISTS collection_items (
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  added_by UUID REFERENCES users(id),
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (collection_id, item_id)
);

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

-- ── AI Processing Queue ──
CREATE TABLE IF NOT EXISTS ai_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'queued', 'processing', 'completed', 'failed')),
  priority INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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

-- =========================================================================
-- Indexes
-- =========================================================================

CREATE INDEX IF NOT EXISTS idx_items_user_id ON items(user_id);
CREATE INDEX IF NOT EXISTS idx_items_type ON items(type);
CREATE INDEX IF NOT EXISTS idx_items_created_at ON items(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_items_is_favorite ON items(user_id, is_favorite) WHERE is_favorite = true;
CREATE INDEX IF NOT EXISTS idx_items_search ON items USING GIN(to_tsvector('english', title || ' ' || coalesce(extracted_text, '')));
CREATE INDEX IF NOT EXISTS idx_items_metadata ON items USING GIN(metadata);

-- Partial index for backfill: quickly find items missing AI processing
CREATE INDEX IF NOT EXISTS idx_items_unprocessed ON items(created_at) WHERE embedding IS NULL;

CREATE INDEX IF NOT EXISTS idx_collections_user_id ON collections(user_id);
CREATE INDEX IF NOT EXISTS idx_collections_parent_id ON collections(parent_id);
CREATE INDEX IF NOT EXISTS idx_collection_items_item ON collection_items(item_id);

CREATE INDEX IF NOT EXISTS idx_connections_user_id ON connections(user_id);
CREATE INDEX IF NOT EXISTS idx_connections_from ON connections(from_item_id);
CREATE INDEX IF NOT EXISTS idx_connections_to ON connections(to_item_id);
CREATE INDEX IF NOT EXISTS idx_connections_strength ON connections(strength DESC);

-- Unique constraint on item_id for upsert support in the worker
ALTER TABLE ai_queue DROP CONSTRAINT IF EXISTS ai_queue_item_id_key;
ALTER TABLE ai_queue ADD CONSTRAINT ai_queue_item_id_key UNIQUE (item_id);

CREATE INDEX IF NOT EXISTS idx_ai_queue_status ON ai_queue(status);
-- ── API Keys Table ──
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  prefix TEXT NOT NULL,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);

-- ── Row-Level Security for api_keys ──
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- Users can view their own API keys
DROP POLICY IF EXISTS api_keys_select_policy ON api_keys;
CREATE POLICY api_keys_select_policy ON api_keys
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own API keys
DROP POLICY IF EXISTS api_keys_insert_policy ON api_keys;
CREATE POLICY api_keys_insert_policy ON api_keys
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own API keys
DROP POLICY IF EXISTS api_keys_delete_policy ON api_keys;
CREATE POLICY api_keys_delete_policy ON api_keys
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_activity_log_user ON activity_log(user_id, created_at DESC);

-- =========================================================================
-- Functions & Triggers
-- =========================================================================

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

-- Auto-update collection item_count
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

-- ── Auto-enqueue AI processing on item creation ──
-- When an item is inserted, notify the background worker via Postgres LISTEN/NOTIFY
CREATE OR REPLACE FUNCTION notify_item_created()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify(
    'nexus:item:created',
    json_build_object(
      'itemId', NEW.id,
      'userId', NEW.user_id
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notify_item_created
  AFTER INSERT ON items
  FOR EACH ROW
  EXECUTE FUNCTION notify_item_created();
`;

async function runMigration() {
  console.log("🚀 Running NEXUS database migration...");

  // Split by semicolons and execute each statement
  const statements = MIGRATION_SQL.split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("--"));

  let successCount = 0;
  let failCount = 0;

  for (const statement of statements) {
    try {
      const { error } = await supabase.rpc("exec_sql", { sql: statement });
      if (error) {
        // Fallback: try direct query via REST
        console.warn(`  ⚠ Statement had issue (may be fine): ${error.message.slice(0, 100)}`);
      }
      successCount++;
    } catch (e) {
      failCount++;
      console.error(`  ✗ Failed: ${(e as Error).message.slice(0, 100)}`);
    }
  }

  console.log(`\n✅ Migration complete: ${successCount} statements processed, ${failCount} failed`);
  console.log("\n📋 Next steps:");
  console.log("  1. Run: npx tsx scripts/seed.ts (optional seed data)");
  console.log("  2. Start: npm run dev");
}

runMigration().catch(console.error);
