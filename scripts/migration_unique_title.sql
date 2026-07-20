-- =========================================================================
-- NEXUS Migration: Add unique constraints on items and collections
-- =========================================================================
-- Run this in the Supabase SQL Editor:
-- https://supabase.com/dashboard/project/cnqwmienvpgrixowavlu/sql/new
-- =========================================================================

-- Item unique constraint (user_id + title) — prevents duplicate item titles
-- per user. This already exists from schema.sql; safe to skip if already present.
ALTER TABLE items
  ADD CONSTRAINT items_user_id_title_key
  UNIQUE (user_id, title);

-- Drop the old standalone index on user_id since the unique constraint
-- already creates a b-tree index on the same column.
DROP INDEX IF EXISTS idx_items_user_id;

-- Collection unique constraint (user_id + name) — prevents duplicate
-- collection names per user. Run this so the seed script's upsert works.
ALTER TABLE collections
  ADD CONSTRAINT collections_user_id_name_key
  UNIQUE (user_id, name);

-- Drop the redundant standalone index on user_id since the unique constraints
-- already create b-tree indexes covering user_id lookups.
DROP INDEX IF EXISTS idx_collections_user;

-- Note: If you re-run schema.sql on a fresh database, both constraints are
-- already included in the CREATE TABLE statements.
-- To remove either constraint later:
--   ALTER TABLE items DROP CONSTRAINT items_user_id_title_key;
--   ALTER TABLE collections DROP CONSTRAINT collections_user_id_name_key;
