/**
 * Prompt-construction tests.
 * Verify cache-control placement (caching invariant) and the trade-rule injection.
 */

import { describe, expect, it } from "vitest";
import {
  buildVisionPrompt,
  PROMPT_VERSION as VISION_PROMPT_VERSION,
} from "@/prompts/vision-quote";
import {
  buildExtractionPrompt,
  ExtractedQuoteSchema,
  EXTRACTED_QUOTE_JSON_SCHEMA,
  PROMPT_VERSION as EXTRACTION_PROMPT_VERSION,
} from "@/prompts/extraction";

describe("vision-quote prompt", () => {
  it("PROMPT_VERSION pin is non-empty", () => {
    expect(VISION_PROMPT_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}/);
  });

  it("first system block is the frozen preamble (cache-control set)", () => {
    const prompt = buildVisionPrompt({
      tradeType: "roofer",
      contextNote: null,
      photoUrls: ["https://example.com/p.jpg"],
      defaultLabourRateAud: 95,
      rateCardCandidates: [],
      marginSummary: null,
    });
    expect(prompt.system[0]?.cache_control).toEqual({ type: "ephemeral" });
    expect(prompt.system[0]?.text).toContain("OUTPUT FORMAT");
  });

  it("second system block carries crew rate context (cached)", () => {
    const prompt = buildVisionPrompt({
      tradeType: "painter",
      contextNote: null,
      photoUrls: ["https://example.com/p.jpg"],
      defaultLabourRateAud: 75.5,
      rateCardCandidates: [
        {
          sourceId: "00000000-0000-0000-0000-000000000001",
          chunk: "Dulux Wash&Wear interior 10L",
          score: 0.9,
          supplier: "bunnings",
          sku: "PA-INT-10L",
          priceAud: 185,
          stale: false,
        },
      ],
      marginSummary: null,
    });
    expect(prompt.system[1]?.cache_control).toEqual({ type: "ephemeral" });
    expect(prompt.system[1]?.text).toContain("75.50");
    expect(prompt.system[1]?.text).toContain("PA-INT-10L");
  });

  it("trade-specific rules are injected into the preamble", () => {
    const r = buildVisionPrompt({
      tradeType: "roofer",
      contextNote: null,
      photoUrls: ["https://example.com/p.jpg"],
      defaultLabourRateAud: 0,
      rateCardCandidates: [],
      marginSummary: null,
    });
    expect(r.system[0]?.text).toContain("Roof-specific rules");
    expect(r.system[0]?.text).not.toContain("Paint-specific rules");
  });

  it("user message contains an image block per photo", () => {
    const r = buildVisionPrompt({
      tradeType: "roofer",
      contextNote: "test",
      photoUrls: ["https://a.example/1.jpg", "https://a.example/2.jpg"],
      defaultLabourRateAud: 0,
      rateCardCandidates: [],
      marginSummary: null,
    });
    const userContent = r.messages[0]?.content;
    if (!Array.isArray(userContent)) throw new Error("expected array");
    const imageBlocks = userContent.filter((b) => (b as { type?: string }).type === "image");
    expect(imageBlocks).toHaveLength(2);
  });

  it("blank context note triggers the 'infer from photos only' user text", () => {
    const r = buildVisionPrompt({
      tradeType: "roofer",
      contextNote: null,
      photoUrls: ["https://a.example/1.jpg"],
      defaultLabourRateAud: 0,
      rateCardCandidates: [],
      marginSummary: null,
    });
    const userContent = r.messages[0]?.content as Array<{ type: string; text?: string }>;
    const textBlock = userContent.find((b) => b.type === "text");
    expect(textBlock?.text).toContain("infer from photos");
  });

  it("includes margin summary when provided (FR-030)", () => {
    const r = buildVisionPrompt({
      tradeType: "roofer",
      contextNote: null,
      photoUrls: ["https://a.example/1.jpg"],
      defaultLabourRateAud: 95,
      rateCardCandidates: [],
      marginSummary: "Avg margin: 32%; labour estimate accuracy: ±8%",
    });
    expect(r.system[1]?.text).toContain("Historical margin");
    expect(r.system[1]?.text).toContain("32%");
  });

  it("flags stale rate-card rows in the context block", () => {
    const r = buildVisionPrompt({
      tradeType: "roofer",
      contextNote: null,
      photoUrls: ["https://a.example/1.jpg"],
      defaultLabourRateAud: 95,
      rateCardCandidates: [
        {
          sourceId: "x",
          chunk: "Old SKU",
          score: 0.8,
          supplier: "bunnings",
          sku: "OLD-001",
          priceAud: 10,
          stale: true,
        },
      ],
      marginSummary: null,
    });
    expect(r.system[1]?.text).toContain("[STALE >7d]");
  });
});

describe("extraction prompt", () => {
  it("PROMPT_VERSION pin is non-empty", () => {
    expect(EXTRACTION_PROMPT_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}/);
  });

  it("system has a cached preamble + cached lookup block", () => {
    const r = buildExtractionPrompt({
      visionDraft: "## Materials\n- Sample @ A$1\n",
      rateCardLookup: [{ sku: "X-1", supplier: "bunnings", description: "Sample" }],
    });
    expect(r.system[0]?.cache_control).toEqual({ type: "ephemeral" });
    expect(r.system[1]?.cache_control).toEqual({ type: "ephemeral" });
    expect(r.system[1]?.text).toContain("X-1");
  });

  it("user message wraps the vision draft in <draft>", () => {
    const r = buildExtractionPrompt({
      visionDraft: "DRAFT-CONTENT",
      rateCardLookup: [],
    });
    const userContent = r.messages[0]?.content as Array<{ type: string; text?: string }>;
    expect(userContent[0]?.text).toContain("<draft>");
    expect(userContent[0]?.text).toContain("DRAFT-CONTENT");
  });

  it("empty rate-card lookup block is non-empty placeholder text", () => {
    const r = buildExtractionPrompt({ visionDraft: "x", rateCardLookup: [] });
    expect(r.system[1]?.text).toContain("Rate-card lookup");
  });
});

describe("ExtractedQuoteSchema", () => {
  it("accepts a well-formed quote", () => {
    const valid = {
      overall_confidence: 88,
      lines: [
        {
          description: "Colorbond sheet",
          qty: 80,
          unit: "m²",
          unit_price_aud: 22.5,
          kind: "material" as const,
          confidence_score: 92,
        },
      ],
      requires_review: false,
    };
    expect(() => ExtractedQuoteSchema.parse(valid)).not.toThrow();
  });

  it("rejects qty < 0", () => {
    const invalid = {
      overall_confidence: 100,
      lines: [
        {
          description: "x",
          qty: -1,
          unit: "ea",
          unit_price_aud: 1,
          kind: "material" as const,
          confidence_score: 80,
        },
      ],
      requires_review: false,
    };
    expect(() => ExtractedQuoteSchema.parse(invalid)).toThrow();
  });

  it("rejects confidence_score > 100", () => {
    const invalid = {
      overall_confidence: 50,
      lines: [
        {
          description: "x",
          qty: 1,
          unit: "ea",
          unit_price_aud: 1,
          kind: "material" as const,
          confidence_score: 101,
        },
      ],
      requires_review: false,
    };
    expect(() => ExtractedQuoteSchema.parse(invalid)).toThrow();
  });
});

describe("EXTRACTED_QUOTE_JSON_SCHEMA", () => {
  it("has additionalProperties:false at root (Anthropic structured-outputs requirement)", () => {
    expect(EXTRACTED_QUOTE_JSON_SCHEMA.additionalProperties).toBe(false);
  });

  it("requires the three core fields", () => {
    expect(EXTRACTED_QUOTE_JSON_SCHEMA.required).toEqual([
      "overall_confidence",
      "lines",
      "requires_review",
    ]);
  });
});
