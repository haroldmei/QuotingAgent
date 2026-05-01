/**
 * AI cost ledger writer + per-quote roll-up.
 *
 * Stack contract:
 *   - ai.cost_tracking=required
 *   - observability.token_metrics=required
 *
 * The ledger is `public.ai_calls` (see supabase/migrations/20260501000004_ai_calls_ledger.sql).
 * Per-quote totals are also synthesised into `quote_ai_usage` (FR-012) at the
 * end of each quote-generation run by `quote-generator.ts`.
 */

import { createServiceClient } from "@/lib/db/supabase-server";
import { logger } from "@/lib/logger";

/**
 * Routes — used as the `route` column on the ledger and as cardinality keys
 * for the Sentry token-metrics dashboard (NFR-017).
 */
export type AiRoute =
  | "vision-quote"
  | "extraction"
  | "embedding"
  | "rate-card-refresh";

/** Context passed into withCostTracking() — propagates to the ledger row. */
export interface AiCallContext {
  /** Anthropic model id (canonical alias). */
  model: string;
  /** Prompt version pin from `src/prompts/<task>.ts`. */
  promptVersion: string;
  /** Route name — controls Sentry metric cardinality. */
  route: AiRoute;
  /** Calling user (Supabase auth.uid()) — null for worker/system calls. */
  userId?: string | null;
  /** Tenant context — null for global calls (rate-card refresh). */
  crewId?: string | null;
  /** Quote-correlation key — present for vision/extraction; null for embeddings. */
  quoteId?: string | null;
  /** True when the soft cap routed us to claude-sonnet-4-6. */
  fallbackUsed?: boolean;
}

/** Full ledger row payload. */
export interface AiCallLedgerRow extends AiCallContext {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  latencyMs: number;
  costAud: number;
  isError: boolean;
}

/**
 * Insert a row into `ai_calls`. Uses the service-role client because the
 * worker (or a Route Handler in a finally block) writes here without a
 * user JWT in scope, and the ledger is RLS-protected against direct user
 * writes (only service role inserts).
 *
 * Never throws — failures are logged and swallowed. The ledger is
 * observability-grade, not transactional; we will not break a quote because
 * Supabase had a hiccup.
 */
export async function recordAiCall(row: AiCallLedgerRow): Promise<void> {
  try {
    // Database.types.ts is auto-generated and does not yet include ai_calls
    // (added in migration 20260501000004). Until `pnpm db:gen-types` is rerun,
    // cast at the boundary. Schema is enforced by Postgres + RLS.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createServiceClient() as any;
    const { error } = await supabase.from("ai_calls").insert({
      user_id: row.userId ?? null,
      crew_id: row.crewId ?? null,
      quote_id: row.quoteId ?? null,
      route: row.route,
      prompt_version: row.promptVersion,
      model: row.model,
      input_tokens: row.inputTokens,
      cached_input_tokens: row.cachedInputTokens,
      output_tokens: row.outputTokens,
      latency_ms: row.latencyMs,
      cost_aud: row.costAud,
      is_error: row.isError,
      fallback_used: row.fallbackUsed ?? false,
    });
    if (error) {
      logger.error({ err: error, ledger: "ai_calls" }, "ai.ledger.insert_error");
    }
  } catch (err) {
    logger.error({ err }, "ai.ledger.exception");
  }
}

/**
 * Roll up the AI-cost ledger for a single quote and synthesise the
 * `quote_ai_usage` row (FR-012). Called at the end of quote generation
 * by `quote-generator.ts`.
 *
 * Returns the totals so the caller can decide whether to flip
 * `cost_overrun=true` on the quote_ai_usage row.
 */
export async function summariseQuoteCost(quoteId: string): Promise<{
  totalCostAud: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  modelVision: string | null;
  modelExtraction: string | null;
  fallbackUsed: boolean;
}> {
  // ai_calls not yet in Database.types.ts auto-gen; cast at boundary.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceClient() as any;
  const { data, error } = await supabase
    .from("ai_calls")
    .select("model,route,input_tokens,output_tokens,cost_aud,fallback_used")
    .eq("quote_id", quoteId);

  if (error || !data) {
    logger.error({ err: error, quoteId }, "ai.summarise.error");
    return {
      totalCostAud: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      modelVision: null,
      modelExtraction: null,
      fallbackUsed: false,
    };
  }

  let totalCostAud = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let modelVision: string | null = null;
  let modelExtraction: string | null = null;
  let fallbackUsed = false;

  // Row shape (matches the SELECT above).
  type LedgerRow = {
    cost_aud: number | string | null;
    input_tokens: number | null;
    output_tokens: number | null;
    fallback_used: boolean | null;
    route: string;
    model: string;
  };
  for (const row of data as LedgerRow[]) {
    totalCostAud += Number(row.cost_aud ?? 0);
    totalInputTokens += row.input_tokens ?? 0;
    totalOutputTokens += row.output_tokens ?? 0;
    if (row.fallback_used) fallbackUsed = true;
    if (row.route === "vision-quote") modelVision = row.model;
    if (row.route === "extraction") modelExtraction = row.model;
  }

  return {
    totalCostAud,
    totalInputTokens,
    totalOutputTokens,
    modelVision,
    modelExtraction,
    fallbackUsed,
  };
}
