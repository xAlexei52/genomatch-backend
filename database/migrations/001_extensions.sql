-- ============================================================
-- MIGRATION 001: Required PostgreSQL extensions
-- ============================================================

CREATE EXTENSION IF NOT EXISTS vector;        -- pgvector for embeddings
CREATE EXTENSION IF NOT EXISTS intarray;      -- Integer array operations
CREATE EXTENSION IF NOT EXISTS btree_gin;     -- GIN for scalar types
CREATE EXTENSION IF NOT EXISTS pg_trgm;       -- Trigram fuzzy search
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";   -- UUID generation
