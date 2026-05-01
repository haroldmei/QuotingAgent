-- ============================================================================
-- Migration: 20260501000005_rate_card_search_rpc
-- pgvector cosine RPC consumed by src/lib/ai/retrieve.ts
-- Stack contract: ai.vector_store=pgvector
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rate_card_search(
  query_vec text,                  -- vector literal "[v1,v2,...]"
  match_count int DEFAULT 24,
  supplier_filter text DEFAULT NULL
)
RETURNS TABLE (
  id          uuid,
  supplier    text,
  sku         text,
  description text,
  price_aud   numeric,
  stale       boolean,
  distance    double precision
)
LANGUAGE sql STABLE
AS $$
  SELECT
    rc.id,
    rc.supplier,
    rc.sku,
    rc.description,
    rc.price_aud,
    rc.stale,
    (rce.embedding <=> query_vec::extensions.vector) AS distance
  FROM public.rate_card_embeddings rce
  JOIN public.rate_card_items rc ON rc.id = rce.rate_card_item_id
  WHERE supplier_filter IS NULL OR rc.supplier = supplier_filter
  ORDER BY rce.embedding <=> query_vec::extensions.vector ASC
  LIMIT match_count;
$$;

COMMENT ON FUNCTION public.rate_card_search IS
  'Cosine ANN over rate_card_embeddings. distance = 1 - similarity. Used by src/lib/ai/retrieve.ts.';
