/**
 * Extraction prompt — claude-haiku-4-5 (or sonnet-4-6 fallback).
 *
 * Stack contract: ai.models.line_item_extraction=claude-haiku-4-5
 *                 (fallback to claude-sonnet-4-6 when cost guard trips)
 *
 * Pattern:
 *   - Reads the vision pass output (plain text from Opus 4.7)
 *   - Emits JSON conforming to ExtractedQuoteSchema (Zod)
 *   - Per-line `confidence_score: 0..100` (ai.confidence_scores=required)
 *   - Uses `output_config.format` with strict JSON schema (no prefill — 4.6/4.7 reject)
 *
 * The schema is the contract between the AI worker and the Quote service.
 */

import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";

export const PROMPT_VERSION = "2026-04-28-1";

// ---------------------------------------------------------------------------
// Output schema (Zod) — also exported as JSON Schema for output_config.format
// ---------------------------------------------------------------------------

export const QuoteLineKindSchema = z.enum(["material", "labour", "other"]);

export const ExtractedQuoteLineSchema = z.object({
  description: z.string().min(1).max(280),
  qty: z.number().nonnegative(),
  unit: z.string().min(1).max(32),
  unit_price_aud: z.number().nonnegative(),
  kind: QuoteLineKindSchema,
  /**
   * Per-line confidence 0..100 (FR-014).
   * <80 → flagged in UI; <60 across whole quote → human review.
   */
  confidence_score: z.number().int().min(0).max(100),
  /** Optional supplier SKU — present when matched from rate-card. */
  rate_card_sku: z.string().optional(),
  /** Optional explanation surfaced when confidence_score < 80. */
  flag_reason: z.string().optional(),
});

export const ExtractedQuoteSchema = z.object({
  /** Whole-quote confidence 0..100 — independent of per-line average. */
  overall_confidence: z.number().int().min(0).max(100),
  /** Empty when AI deems photos too unclear; triggers refusal path (FR-014). */
  lines: z.array(ExtractedQuoteLineSchema),
  /** Free-text observations (access, defects, scope ambiguity). */
  notes: z.string().optional(),
  /** True when extractor recommends routing to human review. */
  requires_review: z.boolean(),
});

export type ExtractedQuoteLine = z.infer<typeof ExtractedQuoteLineSchema>;
export type ExtractedQuote = z.infer<typeof ExtractedQuoteSchema>;

/**
 * JSON Schema for `output_config.format` — keep in sync with the Zod above.
 * Anthropic structured-outputs rules: every object needs additionalProperties:false.
 */
export const EXTRACTED_QUOTE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["overall_confidence", "lines", "requires_review"],
  properties: {
    overall_confidence: { type: "integer", minimum: 0, maximum: 100 },
    lines: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["description", "qty", "unit", "unit_price_aud", "kind", "confidence_score"],
        properties: {
          description: { type: "string" },
          qty: { type: "number" },
          unit: { type: "string" },
          unit_price_aud: { type: "number" },
          kind: { type: "string", enum: ["material", "labour", "other"] },
          confidence_score: { type: "integer", minimum: 0, maximum: 100 },
          rate_card_sku: { type: "string" },
          flag_reason: { type: "string" },
        },
      },
    },
    notes: { type: "string" },
    requires_review: { type: "boolean" },
  },
} as const;

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

export interface ExtractionInput {
  /** Plain-text output from the vision pass. */
  visionDraft: string;
  /** Optional rate-card index — used to populate `rate_card_sku`. */
  rateCardLookup: Array<{ sku: string; supplier: string; description: string }>;
}

export function buildExtractionPrompt(input: ExtractionInput): {
  system: Anthropic.TextBlockParam[];
  messages: Anthropic.MessageParam[];
} {
  const preamble: Anthropic.TextBlockParam = {
    type: "text",
    text: EXTRACTION_SYSTEM,
    cache_control: { type: "ephemeral" },
  };

  // Rate-card lookup is large but stable per-crew within the cache window.
  const lookupBlock: Anthropic.TextBlockParam = {
    type: "text",
    text: buildLookupBlock(input.rateCardLookup),
    cache_control: { type: "ephemeral" },
  };

  return {
    system: [preamble, lookupBlock],
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text:
              `Extract the quote draft below into structured JSON per the schema.\n\n` +
              `<draft>\n${input.visionDraft.trim()}\n</draft>`,
          },
        ],
      },
    ],
  };
}

const EXTRACTION_SYSTEM = `You are a strict quote extractor. You take the plain-text output of a
vision-pass quote draft and convert it to the structured JSON schema.

RULES:
1. Each line in the draft becomes one entry in \`lines\`. Materials → kind:"material", labour → "labour", everything else → "other".
2. Set \`confidence_score\` per line:
   - 90–100 — exact rate-card match, photo is clear, qty is straightforward
   - 80–89  — rate-card match but qty inferred from limited photos
   - 60–79  — partial match or ambiguous qty (single angle, occluded view) — set \`flag_reason\`
   - 0–59   — no rate-card match, "NO RATE-CARD MATCH" marker, or speculative line — set \`flag_reason\`
3. If the draft says "NO RATE-CARD MATCH" or unit_price is "?" → confidence_score ≤ 50 and \`flag_reason\` MUST be set.
4. Set \`overall_confidence\` to the WORST line confidence, NOT the average. The wedge requires conservative refusal.
5. If the vision pass said the photos are too unclear, return \`requires_review: true\` and \`lines: []\`.
6. \`requires_review\` MUST be true if any of:
   - more than 3 lines have confidence_score < 80
   - overall_confidence < 60
   - the draft mentions defects or legal must-fix items
7. Populate \`rate_card_sku\` whenever the description matches a row in the
   "Rate-card lookup" block.
8. Output ONLY the JSON. No preamble. No code fences.`;

function buildLookupBlock(rows: ExtractionInput["rateCardLookup"]): string {
  if (rows.length === 0) return "# Rate-card lookup\n\n(no rate-card rows in scope)";
  const lines = ["# Rate-card lookup", ""];
  for (const r of rows) {
    lines.push(`- [${r.supplier} ${r.sku}] ${r.description}`);
  }
  return lines.join("\n");
}
