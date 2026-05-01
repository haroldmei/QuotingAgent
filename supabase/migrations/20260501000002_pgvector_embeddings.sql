-- ============================================================================
-- Migration: 20260501000002_pgvector_embeddings
-- pgvector extension + rate_card_embeddings table
-- Stack contract: database.pgvector=true, ai.vector_store=pgvector
-- STACK_GAP-001: embedding dims = 1024 (Voyage voyage-3, Anthropic-recommended)
-- ============================================================================

-- Enable pgvector (Supabase enables this by default in ap-southeast-2)
CREATE EXTENSION IF NOT EXISTS vector SCHEMA extensions;

-- ============================================================================
-- rate_card_embeddings (1024-dim — Voyage voyage-3)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.rate_card_embeddings (
  id               uuid              PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_card_item_id uuid             UNIQUE NOT NULL
                     REFERENCES public.rate_card_items(id) ON DELETE CASCADE,
  embedding        extensions.vector(1024) NOT NULL
);

-- IVFFlat ANN index (sufficient for ≤50K SKUs at preview tier)
-- lists = 100 as specified in docs/03-system-design.md §3.4
CREATE INDEX IF NOT EXISTS idx_rate_card_embedding_ivfflat
  ON public.rate_card_embeddings
  USING ivfflat (embedding extensions.vector_cosine_ops)
  WITH (lists = 100);
