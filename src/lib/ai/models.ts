/**
 * AI model registry — single source of truth.
 *
 * Stack contract: docs/00-tech-stack.md §ai.models
 *   - vision_quoting:        claude-opus-4-7  (highest accuracy, wedge-critical line items)
 *   - line_item_extraction:  claude-haiku-4-5 (fast structured extraction pass)
 *   - fallback:              claude-sonnet-4-6 (mid-tier when opus latency > 20s OR cost guard trips)
 *
 * No model ID may be hardcoded outside this file. Self-critique gate: see
 * .claude/skills/ai-features/SKILL.md §Phase 8.
 *
 * The exact model IDs come from `shared/models.md` in the claude-api skill —
 * never construct date-suffixed variants from training-data recall. The
 * strings below are the canonical aliases.
 */

export const MODELS = {
  /** Vision pass — wedge-critical accuracy on residential roofing photos. */
  vision: "claude-opus-4-7",

  /** Structured extraction — fast + cheap second pass to enforce schema. */
  extraction: "claude-haiku-4-5",

  /**
   * Fallback — used when:
   *   1. Vision pass exceeds the 20s latency budget (ai.latency_budget_seconds)
   *   2. Estimated quote cost exceeds A$0.30 (ai.cost_tracking)
   * Routed in src/lib/ai/client.ts via `chooseExtractionModel()`.
   */
  fallback: "claude-sonnet-4-6",
} as const;

export type ModelId = (typeof MODELS)[keyof typeof MODELS];

/** Embedding model — STACK_GAP-001 resolved: voyage-3 @ 1024 dims. */
export const EMBEDDING_MODEL = "voyage-3" as const;
export const EMBEDDING_DIMS = 1024 as const;

/**
 * Wall-clock budgets per the contract:
 *   - LLM call:        20s   (ai.latency_budget_seconds)
 *   - Worker total:    60s   (NFR-002 BullMQ p50)
 *   - End-to-end p50:  300s  (NFR-001 photo→SMS)
 */
export const LATENCY_BUDGET_MS = {
  llm: 20_000,
  worker: 60_000,
} as const;

/**
 * Per-quote cost guard (AUD).
 * Mean ≤ A$0.30 (NFR-005); hard cap A$0.50 → triggers fallback.
 */
export const COST_GUARD_AUD = {
  /** Soft target — log warning + nudge to fallback for the next call. */
  softCapPerQuote: 0.3,
  /** Hard cap — refuse further upgrades and force haiku/sonnet for extraction. */
  hardCapPerQuote: 0.5,
} as const;
