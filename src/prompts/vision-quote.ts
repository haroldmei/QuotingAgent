/**
 * Vision-quote prompt — claude-opus-4-7 (wedge-critical).
 *
 * Stack contract: ai.models.vision_quoting=claude-opus-4-7
 *
 * Pattern:
 *   - System block (cached) — invariant role / output expectations / format
 *   - User block — photo data URLs + retrieved rate-card chunks + crew context
 *   - Streaming on (latency-critical: NFR-001 p50 ≤ 5min)
 *   - No `temperature` / `top_p` / `top_k` (400 on Opus 4.7 — claude-api skill)
 *   - Adaptive thinking ON for hard reasoning (line-item inference from photos)
 *
 * The output is plain text describing materials, quantities, labour. The
 * structured schema is enforced by the *extraction* pass (Haiku 4.5) that
 * runs against this output. Splitting reasoning from extraction is what
 * keeps cost ≤ A$0.30 (NFR-005).
 */

import type Anthropic from "@anthropic-ai/sdk";
import type { TradeType } from "@/prompts/types";
import type { RetrievedRateCardItem } from "@/lib/ai/retrieve";

/** Pin this when the prompt text or output expectations change. */
export const PROMPT_VERSION = "2026-04-28-1";

export interface VisionQuoteInput {
  tradeType: TradeType;
  /** Optional one-liner from the tradie (FR-010). */
  contextNote: string | null;
  /** Photos as data URLs (jpeg/png) or remote https URLs. */
  photoUrls: string[];
  /** Crew's saved labour rate (A$/hr). */
  defaultLabourRateAud: number;
  /** RAG hits — Bunnings/Reece line items the photos likely contain. */
  rateCardCandidates: RetrievedRateCardItem[];
  /** Optional historical margin summary for crews with ≥5 won jobs (FR-030). */
  marginSummary: string | null;
}

/**
 * Build the system + messages payload for the vision pass.
 *
 * The system block is split into a frozen, cacheable preamble + a
 * crew-specific "rate context" block. The preamble is identical across all
 * requests for the same trade type → cache hit rate ≥ 95% on the wedge
 * single critical flow.
 */
export function buildVisionPrompt(input: VisionQuoteInput): {
  system: Anthropic.TextBlockParam[];
  messages: Anthropic.MessageParam[];
} {
  const tradeRules = TRADE_RULES[input.tradeType];

  // Frozen preamble — caches at the prefix.
  const preamble: Anthropic.TextBlockParam = {
    type: "text",
    text: VISION_SYSTEM_PREAMBLE.replaceAll("{{TRADE}}", input.tradeType)
      .replaceAll("{{TRADE_RULES}}", tradeRules),
    cache_control: { type: "ephemeral" },
  };

  // Crew-specific block (rates + RAG candidates) — also cached because the
  // same crew reuses these for many quotes within a 5-minute TTL window.
  const rateContext: Anthropic.TextBlockParam = {
    type: "text",
    text: buildRateContextBlock(input),
    cache_control: { type: "ephemeral" },
  };

  // Per-quote user message — varying part. Photos + optional context.
  const userContent: Anthropic.ContentBlockParam[] = [];
  for (const url of input.photoUrls) {
    userContent.push({
      type: "image",
      source: { type: "url", url },
    });
  }
  userContent.push({
    type: "text",
    text: input.contextNote
      ? `Tradie context: ${input.contextNote.trim()}\n\nProduce the itemised draft.`
      : "No description added — infer from photos only. Produce the itemised draft.",
  });

  return {
    system: [preamble, rateContext],
    messages: [{ role: "user", content: userContent }],
  };
}

const VISION_SYSTEM_PREAMBLE = `You are an expert AU residential {{TRADE}} estimator. You work for the
tradie — your job is to look at site photos and produce an itemised quote
they can review and send.

OUTPUT FORMAT — strictly follow:

  ## Materials
  - <item description>: <qty> <unit> @ A$<unit_price>
  - ...

  ## Labour
  - <activity>: <hours>h @ A$<rate>/hr
  - ...

  ## Notes
  - <observations affecting the quote — access, height, complexity, defects>
  - <confidence concerns — what the photos do NOT show>

RULES:
1. Use ONLY supplier prices from the "Available rate-card items" block where
   the SKU description matches the material. If no rate-card hit fits a
   needed material, list it but write \`@ A$? (NO RATE-CARD MATCH)\` so the
   extraction pass flags it for human review.
2. Use the tradie's saved labour rate for all labour items.
3. Express quantities in the unit specified by the rate-card row (m², m, ea,
   each, kg). Round qty to two decimal places.
4. NEVER fabricate a price. If you don't see a rate-card hit, you do not
   know the price.
5. If the photos are too unclear to estimate (low light, only one angle,
   blurry, indoor when expecting roof), say so explicitly under Notes and
   refuse to itemise. The extraction pass will route to human review.
6. {{TRADE_RULES}}

CONTEXT YOU SHOULD ASSUME:
- Western Sydney residential job (Parramatta / Blacktown / Penrith corridor)
- NSW Fair Trading regulated work; statutory warranty applies
- Quote must be in AUD, GST exclusive (10% GST is added by the system)`;

const TRADE_RULES: Record<TradeType, string> = {
  roofer: `Roof-specific rules:
  - Measure roof area in m² from visible plan view; allow 8% wastage.
  - Distinguish colorbond profile (Trimdek vs Spandek vs Custom Orb) by ribbing pattern.
  - Always include: ridge cap, valley iron, flashings, fasteners, sealant.
  - Gutters: linear metres of fascia line; downpipes: count from photos.
  - If a single-storey vs multi-storey question is ambiguous, NOTE it.`,
  painter: `Paint-specific rules:
  - Wall area = perimeter × height; subtract openings (windows, doors).
  - Two coats minimum on previously-painted surfaces; three on bare timber.
  - Distinguish interior (low-VOC water-based) from exterior (acrylic).
  - Always include: prep (sand/fill/prime), drop sheets, masking tape.`,
  electrician: `Electrical rules:
  - Identify visible defects (exposed wiring, scorched outlets) — these are
    legal must-fix items; flag in Notes.
  - Quote in points (PowerPoint, light, switch); never in metres of cable.`,
  plumber: `Plumbing rules:
  - Identify pipe material (copper / PEX / PVC) before estimating.
  - Always include: isolation valves, fittings, sealant tape, fasteners.`,
  landscaper: `Landscaping rules:
  - Quote turf/mulch by m²; pavers by m² + count; retaining walls by linear m.
  - Always include: site prep, soil/sand bedding, drainage.`,
};

function buildRateContextBlock(input: VisionQuoteInput): string {
  const lines: string[] = [];
  lines.push(`# Crew context`);
  lines.push(``);
  lines.push(`Default labour rate: A$${input.defaultLabourRateAud.toFixed(2)}/hr`);
  if (input.marginSummary) {
    lines.push(``);
    lines.push(`# Historical margin (this crew, last ≥5 won jobs)`);
    lines.push(input.marginSummary.trim());
  }
  lines.push(``);
  lines.push(`# Available rate-card items`);
  lines.push(``);
  if (input.rateCardCandidates.length === 0) {
    lines.push(`(no rate-card hits — flag every material with NO RATE-CARD MATCH)`);
  } else {
    for (const r of input.rateCardCandidates) {
      const stale = r.stale ? " [STALE >7d]" : "";
      lines.push(
        `- [${r.supplier} ${r.sku}] ${r.chunk} — A$${r.priceAud.toFixed(2)}${stale}`,
      );
    }
  }
  return lines.join("\n");
}
