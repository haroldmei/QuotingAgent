/**
 * Anthropic SDK client + cost-tracking wrapper.
 *
 * Stack contract:
 *   - ai.provider=anthropic
 *   - ai.cost_tracking=required (ledger: ai_calls table)
 *   - ai.confidence_scores=required (per-line score from extraction pass)
 *   - ai.latency_budget_seconds=20 (hard timeout per call)
 *
 * Pattern derived from the claude-api skill:
 *   - Adaptive thinking on Opus 4.7 (NEVER `budget_tokens` — 400 on 4.7)
 *   - Sampling parameters (temperature/top_p/top_k) are 400 on 4.7 → never set
 *   - Prompt caching ON for system prompt + crew rate-card context
 *   - Streaming for any user-facing call (vision pass) to hit p50 ≤ 5min
 *
 * Cost guard: estimateAndChooseModel() inspects the running per-quote tally
 * and falls extraction back to claude-sonnet-4-6 if soft cap A$0.30 would
 * be tripped (FR-012, NFR-005).
 */

import Anthropic from "@anthropic-ai/sdk";
import { logger } from "@/lib/logger";
import { COST_GUARD_AUD, MODELS, type ModelId } from "@/lib/ai/models";
import { computeCallCostAud } from "@/lib/ai/pricing";
import { recordAiCall, type AiCallContext } from "@/lib/ai/cost-tracking";

let _client: Anthropic | null = null;

/** Lazy-initialised singleton; honours ANTHROPIC_API_KEY env var. */
export function getAnthropicClient(): Anthropic {
  if (_client) return _client;
  _client = new Anthropic({
    // SDK reads ANTHROPIC_API_KEY automatically; allow override for tests.
    apiKey: process.env.ANTHROPIC_API_KEY,
    maxRetries: 2, // FR-011: 2 retries on transient API failure
  });
  return _client;
}

/**
 * Wrap a model call with cost tracking, latency timing, and structured logs.
 * Every model call in the codebase MUST go through this wrapper (Phase 8 gate).
 *
 * The provided `fn` returns the raw SDK response; we read `usage` off it to
 * compute cost. If `fn` throws, we still record an error row (cost=0,
 * is_error=true) so failed calls are visible in the ledger.
 */
export async function withCostTracking<T extends { usage?: AnthropicUsage }>(
  ctx: AiCallContext,
  fn: () => Promise<T>,
): Promise<T> {
  const start = Date.now();
  let response: T | undefined;
  let isError = false;
  let errMessage: string | undefined;

  try {
    response = await fn();
    return response;
  } catch (err) {
    isError = true;
    errMessage = err instanceof Error ? err.message : String(err);
    throw err;
  } finally {
    const latencyMs = Date.now() - start;
    const usage = response?.usage;
    const inputTokens = usage?.input_tokens ?? 0;
    const cachedInputTokens = usage?.cache_read_input_tokens ?? 0;
    const cacheWriteTokens = usage?.cache_creation_input_tokens ?? 0;
    const outputTokens = usage?.output_tokens ?? 0;
    const costAud = isError
      ? 0
      : computeCallCostAud(
          ctx.model,
          inputTokens,
          outputTokens,
          cachedInputTokens,
          cacheWriteTokens,
        );

    // PII-safe structured log (no prompt content; logger redacts further).
    logger.info(
      {
        ai: {
          route: ctx.route,
          prompt_version: ctx.promptVersion,
          model: ctx.model,
          input_tokens: inputTokens,
          cached_input_tokens: cachedInputTokens,
          output_tokens: outputTokens,
          latency_ms: latencyMs,
          cost_aud: costAud,
          is_error: isError,
          error: errMessage,
          fallback_used: ctx.fallbackUsed ?? false,
        },
        crew_id: ctx.crewId,
        quote_id: ctx.quoteId,
      },
      "ai.call.complete",
    );

    // Async fire-and-forget ledger write — never let it block the response.
    void recordAiCall({
      ...ctx,
      inputTokens,
      cachedInputTokens,
      outputTokens,
      latencyMs,
      costAud,
      isError,
    }).catch((e) => {
      logger.error({ err: e }, "ai.ledger.write_failed");
    });
  }
}

/**
 * Cost guard: decide which extraction model to use given the running tally.
 *
 * If the quote has already accumulated `>= softCapPerQuote` AUD of cost,
 * downshift extraction to sonnet-4-6 (mid-tier — cheaper than opus,
 * faster than haiku at structured tasks of this complexity).
 *
 * If the quote is at the hard cap, stay on haiku-4-5 anyway — extra spend
 * is unjustified.
 */
export function chooseExtractionModel(runningCostAud: number): {
  model: ModelId;
  fallbackUsed: boolean;
} {
  if (runningCostAud >= COST_GUARD_AUD.hardCapPerQuote) {
    // Hard cap — stay on the cheapest viable model.
    return { model: MODELS.extraction, fallbackUsed: false };
  }
  if (runningCostAud >= COST_GUARD_AUD.softCapPerQuote) {
    // Soft cap tripped — switch to sonnet for extraction quality without opus cost.
    return { model: MODELS.fallback, fallbackUsed: true };
  }
  return { model: MODELS.extraction, fallbackUsed: false };
}

// Anthropic SDK usage shape — narrowed for our purposes.
interface AnthropicUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
}

/** Internal export for tests. */
export const __INTERNAL__ = { resetClient: () => { _client = null; } };
