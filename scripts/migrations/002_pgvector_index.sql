-- =========================================================================
-- Migration 002: pgvector IVFFlat Index
-- =========================================================================
-- Adds the IVFFlat index for fast approximate nearest neighbor search
-- on the items.embedding column. Reverses cleanly.
-- Up/Migrate: creates index
-- Down/Rollback: drops index
-- =========================================================================

-- ═════════════════════════════════════════════════════════════════════════
-- UP
-- ═════════════════════════════════════════════════════════════════════════

-- Create IVFFlat index for fast approximate nearest neighbor search
-- Uses vector_cosine_ops operator class for cosine distance (<->)
-- lists=100 is a good default for up to ~1M vectors
CREATE INDEX IF NOT EXISTS idx_items_embedding ON items
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- ═════════════════════════════════════════════════════════════════════════
-- DOWN
-- ═════════════════════════════════════════════════════════════════════════

-- DROP INDEX IF EXISTS idx_items_embedding;
