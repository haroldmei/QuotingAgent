-- ============================================================================
-- Migration: 20260501000004_ai_calls_ledger
-- Per-call AI ledger for fine-grained cost + latency tracking
-- Stack contract:
--   ai.cost_tracking=required
--   observability.token_metrics=required
-- Wedge: NFR-005 mean cost ≤ A$0.30 per quote; rolling-mean Sentry alert.
--
-- The existing `quote_ai_usage` table (see prisma/schema.prisma) tracks
-- per-quote totals. This `ai_calls` table tracks every individual model
-- call (vision pass, extraction pass, embedding, fallback retries) so we
-- can attribute cost to specific prompt versions and routes.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ai_calls (
  id                    uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid          NULL,                 -- nullable: worker calls have no user
  crew_id               uuid          NULL,                 -- nullable: rate-card refresh is global
  quote_id              uuid          NULL,                 -- FK to quotes.id when applicable
  route                 text          NOT NULL,             -- e.g. "vision-quote", "extraction", "embedding"
  prompt_version        text          NOT NULL,             -- e.g. "2026-04-28-1"
  model                 text          NOT NULL,             -- exact Anthropic model id
  input_tokens          integer       NOT NULL DEFAULT 0,
  cached_input_tokens   integer       NOT NULL DEFAULT 0,   -- prompt-cache reads (~10% cost)
  output_tokens         integer       NOT NULL DEFAULT 0,
  latency_ms            integer       NOT NULL DEFAULT 0,
  cost_aud              numeric(10, 6) NOT NULL DEFAULT 0,  -- 6dp for sub-cent precision
  is_error              boolean       NOT NULL DEFAULT false,
  fallback_used         boolean       NOT NULL DEFAULT false, -- true when sonnet-4-6 fallback engaged
  created_at            timestamptz   NOT NULL DEFAULT now()
);

-- Cost-roll-up indexes (NFR-005 rolling 10-quote mean alert; NFR-017 dashboard)
CREATE INDEX IF NOT EXISTS idx_ai_calls_quote_id
  ON public.ai_calls(quote_id) WHERE quote_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ai_calls_crew_created
  ON public.ai_calls(crew_id, created_at DESC) WHERE crew_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ai_calls_route_created
  ON public.ai_calls(route, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_calls_model_created
  ON public.ai_calls(model, created_at DESC);

-- ============================================================================
-- RLS — crews see their own AI usage; service role bypasses.
-- ============================================================================
ALTER TABLE public.ai_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_calls_select_own_crew ON public.ai_calls
  FOR SELECT
  USING (
    crew_id IS NULL
    OR crew_id = (
      SELECT u.crew_id FROM public.users u WHERE u.id = auth.uid()
    )
  );

-- INSERT and UPDATE go through the service role (worker writes the ledger);
-- no direct user writes.
CREATE POLICY ai_calls_no_user_write ON public.ai_calls
  FOR INSERT
  WITH CHECK (false);

-- ============================================================================
-- View: rolling per-crew quote-cost mean (NFR-005 alert source)
-- ============================================================================
CREATE OR REPLACE VIEW public.v_quote_ai_cost_rolling AS
  SELECT
    crew_id,
    quote_id,
    SUM(cost_aud) AS quote_cost_aud,
    SUM(input_tokens + output_tokens) AS quote_total_tokens,
    bool_or(fallback_used) AS used_fallback,
    MAX(created_at) AS last_call_at
  FROM public.ai_calls
  WHERE quote_id IS NOT NULL
  GROUP BY crew_id, quote_id;

COMMENT ON TABLE public.ai_calls IS
  'Per-call AI ledger. Every Anthropic SDK call goes through withCostTracking() which inserts a row here.';
COMMENT ON VIEW public.v_quote_ai_cost_rolling IS
  'Per-quote cost roll-up. Sentry rolling 10-quote mean cost alert reads this view.';
