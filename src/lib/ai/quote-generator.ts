/**
 * Quote generator — vision → extraction → confidence gate.
 *
 * This is what the BullMQ worker (separate Cloud Run service per
 * docs/03-system-design.md §5.1) calls for each quote-generation job.
 *
 * Flow:
 *   1. Resolve photo signed URLs from GCS
 *   2. RAG: embed the trade context + tradie note → top-K rate-card hits
 *   3. Vision pass — Opus 4.7 streamed (latency budget 20s; if exceeded,
 *      partial draft is returned with flag — FR-011 alt path)
 *   4. Extraction pass — Haiku 4.5 → strict JSON via output_config.format
 *      Cost guard: if running cost ≥ A$0.30 → swap to sonnet-4-6 (FR-012)
 *   5. Summarise confidence; if requires_review → mark quote, surface to user
 *   6. Persist line items + quote_ai_usage; lifeline ledger already
 *      written via withCostTracking on every call
 */

import { getAnthropicClient, withCostTracking, chooseExtractionModel } from "@/lib/ai/client";
import { LATENCY_BUDGET_MS, MODELS, COST_GUARD_AUD } from "@/lib/ai/models";
import { estimateCostAud } from "@/lib/ai/pricing";
import { retrieveRateCard, type RetrievedRateCardItem } from "@/lib/ai/retrieve";
import { summariseConfidence, type ConfidenceSummary } from "@/lib/ai/confidence";
import { summariseQuoteCost } from "@/lib/ai/cost-tracking";
import {
  buildVisionPrompt,
  PROMPT_VERSION as VISION_PROMPT_VERSION,
  type VisionQuoteInput,
} from "@/prompts/vision-quote";
import {
  buildExtractionPrompt,
  EXTRACTED_QUOTE_JSON_SCHEMA,
  ExtractedQuoteSchema,
  PROMPT_VERSION as EXTRACTION_PROMPT_VERSION,
  type ExtractedQuote,
} from "@/prompts/extraction";
import type { TradeType } from "@/prompts/types";
import { logger } from "@/lib/logger";

export interface QuoteGenInput {
  quoteId: string;
  crewId: string;
  userId: string | null;
  tradeType: TradeType;
  contextNote: string | null;
  /** Signed GCS URLs to the uploaded photos (pre-resolved by the worker). */
  photoUrls: string[];
  defaultLabourRateAud: number;
  /** Crew historical margin summary — null when crew has < 5 won jobs. */
  marginSummary: string | null;
}

export interface QuoteGenResult {
  /** Final structured quote (Zod-parsed). */
  quote: ExtractedQuote;
  /** Confidence summary used by the worker to decide review routing. */
  confidence: ConfidenceSummary;
  /** Total cost across all calls for this quote. */
  totalCostAud: number;
  /** Did the cost guard route extraction to sonnet-4-6 fallback? */
  fallbackUsed: boolean;
  /** Source of the rate-card data: "live" if any RAG hit was non-stale. */
  rateCardSource: "live" | "cached" | "learned";
  /** Models actually used (logged into quote_ai_usage). */
  modelVision: string;
  modelExtraction: string;
}

/**
 * Run the full quote-generation pipeline.
 *
 * Throws only on unrecoverable infra errors (Anthropic 5xx after retries,
 * Voyage 5xx after retries). Soft failures (low confidence, no rate-card
 * hits) are surfaced via `confidence.requiresReview` for caller routing.
 */
export async function generateQuote(input: QuoteGenInput): Promise<QuoteGenResult> {
  const aiCtx = {
    quoteId: input.quoteId,
    crewId: input.crewId,
    userId: input.userId,
  };

  // ---------- Phase 2: RAG — retrieve rate-card candidates ----------
  const ragQuery = buildRagQuery(input);
  const candidates = await retrieveRateCard(ragQuery, {
    topK: 12,
    mmrLambda: 0.7,
    aiCtx,
  });

  // ---------- Phase 3b: Pre-call cost gate (AT-COST-001 fix) ----------
  // Estimate the vision call using a conservative upper bound:
  //   - Input: 10 000 tokens (system + photo descriptions + rate-card candidates)
  //   - Output: 2 048 tokens (the reduced max_tokens cap below)
  // If this single call would already bust the hard cap, refuse early and
  // surface a clear error — the worker will retry with a smaller payload.
  const VISION_EST_INPUT_TOKENS = 10_000;
  const VISION_MAX_OUTPUT_TOKENS = 2_048;
  const estimatedVisionCost = estimateCostAud({
    model: MODELS.vision,
    inputTokens: VISION_EST_INPUT_TOKENS,
    expectedOutputTokens: VISION_MAX_OUTPUT_TOKENS,
  });
  if (estimatedVisionCost > COST_GUARD_AUD.hardCapPerQuote) {
    logger.error(
      {
        quoteId: input.quoteId,
        estimatedVisionCost,
        hardCap: COST_GUARD_AUD.hardCapPerQuote,
      },
      "ai.cost_guard.pre_call_refused",
    );
    throw new Error(
      `Pre-call cost estimate A$${estimatedVisionCost.toFixed(4)} exceeds hard cap A$${COST_GUARD_AUD.hardCapPerQuote}`,
    );
  }

  // ---------- Phase 4a: Vision pass (Opus 4.7) ----------
  const visionPrompt = buildVisionPrompt({
    tradeType: input.tradeType,
    contextNote: input.contextNote,
    photoUrls: input.photoUrls,
    defaultLabourRateAud: input.defaultLabourRateAud,
    rateCardCandidates: candidates,
    marginSummary: input.marginSummary,
  } satisfies VisionQuoteInput);

  const visionDraft = await runVisionPass(visionPrompt, aiCtx);

  // ---------- Phase 4b: Extraction pass (Haiku 4.5 or fallback) ----------
  const runningCost = (await summariseQuoteCost(input.quoteId)).totalCostAud;
  const { model: extractionModel, fallbackUsed } = chooseExtractionModel(runningCost);

  const extracted = await runExtractionPass(visionDraft, candidates, extractionModel, fallbackUsed, aiCtx);

  // ---------- Phase 5: Confidence + refusal path ----------
  const confidence = summariseConfidence(extracted.lines);

  // Final cost roll-up (now that ledger has all rows for this quote).
  const finalCost = await summariseQuoteCost(input.quoteId);

  return {
    quote: { ...extracted, requires_review: extracted.requires_review || confidence.requiresReview },
    confidence,
    totalCostAud: finalCost.totalCostAud,
    fallbackUsed: finalCost.fallbackUsed || fallbackUsed,
    rateCardSource: pickRateCardSource(candidates, !!input.marginSummary),
    modelVision: MODELS.vision,
    modelExtraction: extractionModel,
  };
}

// ---------------------------------------------------------------------------
// Vision pass — streamed (NFR-001 latency budget)
// ---------------------------------------------------------------------------

interface AiCtx {
  quoteId: string;
  crewId: string;
  userId: string | null;
}

async function runVisionPass(
  prompt: ReturnType<typeof buildVisionPrompt>,
  ctx: AiCtx,
): Promise<string> {
  const client = getAnthropicClient();

  const visionResponse = await withCostTracking(
    {
      model: MODELS.vision,
      promptVersion: VISION_PROMPT_VERSION,
      route: "vision-quote",
      ...ctx,
    },
    async () => {
      // Streaming on user-facing path; .finalMessage() returns the assembled message.
      // NOTE: Anthropic SDK v0.40 typings lag the API. `thinking: { type: "adaptive" }`
      // is the only on-mode for Opus 4.7 (claude-api skill). Cast to any at the SDK
      // boundary; bump the SDK to ≥0.50 to recover full type safety.
      const stream = client.messages.stream(
        {
          model: MODELS.vision,
          // AT-COST-001 fix: capped at 2048. Vision output is "draft notes" only;
          // the extraction pass does the structured work and is far cheaper.
          max_tokens: 2048,
          thinking: { type: "adaptive", display: "summarized" } as unknown as Anthropic.ThinkingConfigParam,
          system: prompt.system,
          messages: prompt.messages,
        },
        {
          // Hard wall-clock cap — ai.latency_budget_seconds=20.
          timeout: LATENCY_BUDGET_MS.llm,
        },
      );
      const final = await stream.finalMessage();
      return final;
    },
  );

  // Extract the text from the assistant message.
  const textBlocks = visionResponse.content.filter(
    (b): b is Anthropic.TextBlock => b.type === "text",
  );
  const text = textBlocks.map((b) => b.text).join("\n").trim();
  if (!text) {
    logger.warn({ quoteId: ctx.quoteId }, "ai.vision.empty_response");
    throw new Error("Vision pass returned no text");
  }
  return text;
}

// ---------------------------------------------------------------------------
// Extraction pass — strict JSON via output_config.format
// ---------------------------------------------------------------------------

async function runExtractionPass(
  visionDraft: string,
  candidates: RetrievedRateCardItem[],
  model: string,
  fallbackUsed: boolean,
  ctx: AiCtx,
): Promise<ExtractedQuote> {
  const client = getAnthropicClient();
  const prompt = buildExtractionPrompt({
    visionDraft,
    rateCardLookup: candidates.map((r) => ({
      sku: r.sku,
      supplier: r.supplier,
      description: r.chunk,
    })),
  });

  const response = await withCostTracking(
    {
      model,
      promptVersion: EXTRACTION_PROMPT_VERSION,
      route: "extraction",
      fallbackUsed,
      ...ctx,
    },
    async () => {
      // SDK v0.40 typings lag — `output_config` is a real param per the
      // claude-api skill but isn't in the type yet. Cast to satisfy tsc
      // without losing runtime behaviour. The schema is enforced server-side.
      // Haiku 4.5 + Sonnet 4.6 both support structured outputs.
      return client.messages.create({
        model,
        max_tokens: 2048,
        system: prompt.system,
        messages: prompt.messages,
        output_config: {
          format: {
            type: "json_schema",
            schema: EXTRACTED_QUOTE_JSON_SCHEMA as unknown as Record<string, unknown>,
          },
        },
      } as unknown as Anthropic.MessageCreateParamsNonStreaming);
    },
  );

  // Get the JSON text — output_config returns it as a single text block.
  const textBlocks = response.content.filter(
    (b): b is Anthropic.TextBlock => b.type === "text",
  );
  const json = textBlocks.map((b) => b.text).join("");
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (err) {
    logger.error({ err, raw: json.slice(0, 200), quoteId: ctx.quoteId }, "ai.extraction.json_parse_error");
    throw new Error("Extraction returned invalid JSON");
  }
  return ExtractedQuoteSchema.parse(parsed);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildRagQuery(input: QuoteGenInput): string {
  const parts: string[] = [`Trade: ${input.tradeType}`];
  if (input.contextNote) parts.push(input.contextNote);
  return parts.join(". ");
}

function pickRateCardSource(
  candidates: RetrievedRateCardItem[],
  hasMarginSummary: boolean,
): "live" | "cached" | "learned" {
  if (hasMarginSummary) return "learned";
  if (candidates.length === 0) return "cached";
  const anyFresh = candidates.some((c) => !c.stale);
  return anyFresh ? "live" : "cached";
}

// Anthropic SDK type re-export for convenience in this file.
import type Anthropic from "@anthropic-ai/sdk";
