-- =========================================================================
-- NEXUS — pgvector Migration
-- =========================================================================
-- Run this in the Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql/new)
-- Adds vector search support to the existing database schema.
-- =========================================================================

-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS "vector";

-- 2. Add embedding column to existing items table
ALTER TABLE items ADD COLUMN IF NOT EXISTS embedding vector(768);

-- 3. Create IVFFlat index for fast approximate nearest neighbor search
CREATE INDEX IF NOT EXISTS idx_items_embedding ON items
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- 4. Create search function for semantic similarity
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
