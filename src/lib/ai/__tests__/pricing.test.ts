/**
 * Pricing arithmetic tests.
 * Stack contract: NFR-005 mean cost ≤ A$0.30/quote.
 */

import { describe, expect, it } from "vitest";
import {
  computeCallCostAud,
  computeEmbeddingCostAud,
  estimateCostAud,
  AUD_PER_USD,
  __INTERNAL__,
} from "@/lib/ai/pricing";
import { MODELS } from "@/lib/ai/models";

describe("computeCallCostAud", () => {
  it("returns 0 for unknown model rather than throw", () => {
    expect(computeCallCostAud("claude-unknown-99", 1000, 1000)).toBe(0);
  });

  it("computes Opus 4.7 input + output cost in AUD", () => {
    // Opus 4.7: $5/$25 per 1M tokens
    // 1000 in + 500 out = (1000*5 + 500*25)/1M = 0.0175 USD
    const usd = (1000 * 5 + 500 * 25) / 1_000_000;
    const expected = usd * AUD_PER_USD;
    const got = computeCallCostAud(MODELS.vision, 1000, 500);
    expect(got).toBeCloseTo(expected, 5);
  });

  it("applies the 10% discount for cached input tokens", () => {
    const got = computeCallCostAud(MODELS.vision, 0, 0, 10000, 0);
    // 10000 cached input @ $5/1M * 0.1 = $0.005 USD = $0.00775 AUD
    expect(got).toBeCloseTo(0.005 * AUD_PER_USD, 5);
  });

  it("applies the 1.25× premium for cache write tokens", () => {
    const got = computeCallCostAud(MODELS.vision, 0, 0, 0, 10000);
    // 10000 cache-write @ $5/1M * 1.25 = $0.0625 USD
    expect(got).toBeCloseTo(0.0625 * AUD_PER_USD, 5);
  });

  it("Haiku is roughly 5x cheaper than Opus for the same usage", () => {
    const haiku = computeCallCostAud(MODELS.extraction, 1000, 500);
    const opus = computeCallCostAud(MODELS.vision, 1000, 500);
    expect(opus / haiku).toBeGreaterThan(4);
  });

  it("rounds cost to 6dp to fit numeric(10,6) ledger column", () => {
    const got = computeCallCostAud(MODELS.vision, 1, 1);
    const decimals = (got.toString().split(".")[1] ?? "").length;
    expect(decimals).toBeLessThanOrEqual(6);
  });
});

describe("computeEmbeddingCostAud", () => {
  it("zero tokens → zero cost", () => {
    expect(computeEmbeddingCostAud(0)).toBe(0);
  });

  it("voyage-3 cost scales linearly with tokens", () => {
    const a = computeEmbeddingCostAud(1_000_000);
    const b = computeEmbeddingCostAud(500_000);
    expect(a / b).toBeCloseTo(2, 5);
  });

  it("voyage-3 is meaningfully cheaper than haiku for the same tokens", () => {
    const embed = computeEmbeddingCostAud(1_000_000);
    const haiku = computeCallCostAud(MODELS.extraction, 1_000_000, 0);
    expect(embed).toBeLessThan(haiku);
  });
});

describe("estimateCostAud", () => {
  it("matches computeCallCostAud for the same inputs", () => {
    const e = estimateCostAud({
      model: MODELS.vision,
      inputTokens: 5000,
      expectedOutputTokens: 1000,
    });
    const c = computeCallCostAud(MODELS.vision, 5000, 1000);
    expect(e).toBe(c);
  });
});

describe("__INTERNAL__", () => {
  it("exposes pricing table for all configured models", () => {
    expect(__INTERNAL__.PRICE_PER_M_USD[MODELS.vision]).toBeDefined();
    expect(__INTERNAL__.PRICE_PER_M_USD[MODELS.extraction]).toBeDefined();
    expect(__INTERNAL__.PRICE_PER_M_USD[MODELS.fallback]).toBeDefined();
  });

  it("voyage embedding price is positive", () => {
    expect(__INTERNAL__.EMBED_PRICE_PER_M_USD).toBeGreaterThan(0);
  });
});
