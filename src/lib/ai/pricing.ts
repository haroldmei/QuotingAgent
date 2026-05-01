/**
 * Token-cost arithmetic.
 *
 * Anthropic publishes USD per-million pricing. We log AUD on the ai_calls
 * ledger because the wedge cost target (A$0.30) is in AUD (NFR-005).
 *
 * Pricing table is cached from claude-api/shared/models.md (2026-04-15):
 *   Opus 4.7    — $5.00 / $25.00   (input/output per 1M)
 *   Sonnet 4.6  — $3.00 / $15.00
 *   Haiku 4.5   — $1.00 /  $5.00
 *   Voyage-3    — Voyage AI pricing (per Anthropic-recommended docs)
 *
 * Cached input tokens (prompt-cache reads) are billed at ~10% of base.
 * Cache writes are ~1.25x base for 5-minute TTL. We don't separate writes
 * here — the SDK reports `cache_creation_input_tokens` which we add to
 * input cost at 1.25x. See claude-api/shared/prompt-caching.md.
 *
 * AUD/USD: pinned to a conservative 1.55 — re-baseline quarterly with the
 * stack contract review (docs/00-tech-stack.md §4).
 */

import { MODELS, EMBEDDING_MODEL, type ModelId } from "@/lib/ai/models";

// USD per 1M tokens
const PRICE_PER_M_USD: Record<string, { input: number; output: number }> = {
  [MODELS.vision]: { input: 5.0, output: 25.0 },        // claude-opus-4-7
  [MODELS.fallback]: { input: 3.0, output: 15.0 },       // claude-sonnet-4-6
  [MODELS.extraction]: { input: 1.0, output: 5.0 },      // claude-haiku-4-5
};

// Voyage embeddings — voyage-3 is $0.06 / 1M input tokens (no output dimension)
const EMBED_PRICE_PER_M_USD = 0.06;

/** Conservative AUD per USD pin; re-baseline quarterly. */
export const AUD_PER_USD = 1.55;

/**
 * Compute cost in AUD for a single Anthropic call.
 *
 * @param model              The Anthropic model id (must be in PRICE_PER_M_USD)
 * @param inputTokens        Uncached prompt tokens (full price)
 * @param outputTokens       Completion tokens
 * @param cachedInputTokens  Prompt-cache read tokens (~10% cost) — optional
 * @param cacheWriteTokens   Prompt-cache write tokens (~1.25x cost) — optional
 */
export function computeCallCostAud(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cachedInputTokens = 0,
  cacheWriteTokens = 0,
): number {
  const price = PRICE_PER_M_USD[model];
  if (!price) {
    // Unknown model → return 0 rather than throw; observability captures this.
    return 0;
  }
  const inUsd = (inputTokens / 1_000_000) * price.input;
  const outUsd = (outputTokens / 1_000_000) * price.output;
  const cachedUsd = (cachedInputTokens / 1_000_000) * price.input * 0.1;
  const writeUsd = (cacheWriteTokens / 1_000_000) * price.input * 1.25;
  const usdTotal = inUsd + outUsd + cachedUsd + writeUsd;
  return roundAud(usdTotal * AUD_PER_USD);
}

/** Voyage-3 embedding cost in AUD. */
export function computeEmbeddingCostAud(inputTokens: number): number {
  const usd = (inputTokens / 1_000_000) * EMBED_PRICE_PER_M_USD;
  return roundAud(usd * AUD_PER_USD);
}

/** Round to 6 decimal places to match the ai_calls.cost_aud column. */
function roundAud(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

/**
 * Pre-call cost estimate. Vision token count is hard to know up-front; this
 * is a lower bound used by the cost guard to decide whether to swap models.
 *
 * @returns A conservative AUD estimate that the worker compares against
 *          COST_GUARD_AUD.softCapPerQuote.
 */
export function estimateCostAud(args: {
  model: ModelId;
  inputTokens: number;
  expectedOutputTokens: number;
}): number {
  return computeCallCostAud(args.model, args.inputTokens, args.expectedOutputTokens);
}

/** Exported for tests. Internal only. */
export const __INTERNAL__ = { PRICE_PER_M_USD, EMBED_PRICE_PER_M_USD };

// Reference EMBEDDING_MODEL so unused-import linter is satisfied (it's exported elsewhere).
void EMBEDDING_MODEL;
