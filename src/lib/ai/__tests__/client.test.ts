/**
 * Cost-guard tests for chooseExtractionModel.
 * Wedge: FR-012 cost guard fall-back to claude-sonnet-4-6 when soft cap trips.
 */

import { describe, expect, it } from "vitest";
import { chooseExtractionModel } from "@/lib/ai/client";
import { COST_GUARD_AUD, MODELS } from "@/lib/ai/models";

describe("chooseExtractionModel — cost guard", () => {
  it("under soft cap → use haiku (cheapest path)", () => {
    const r = chooseExtractionModel(0.0);
    expect(r.model).toBe(MODELS.extraction);
    expect(r.fallbackUsed).toBe(false);
  });

  it("at soft cap → upgrade to sonnet-4-6", () => {
    const r = chooseExtractionModel(COST_GUARD_AUD.softCapPerQuote);
    expect(r.model).toBe(MODELS.fallback);
    expect(r.fallbackUsed).toBe(true);
  });

  it("between soft and hard cap → still sonnet-4-6", () => {
    const r = chooseExtractionModel(0.4);
    expect(r.model).toBe(MODELS.fallback);
    expect(r.fallbackUsed).toBe(true);
  });

  it("at or above hard cap → drop back to haiku (no extra spend)", () => {
    const r = chooseExtractionModel(COST_GUARD_AUD.hardCapPerQuote);
    expect(r.model).toBe(MODELS.extraction);
    expect(r.fallbackUsed).toBe(false);
  });

  it("just below soft cap stays on haiku", () => {
    const r = chooseExtractionModel(COST_GUARD_AUD.softCapPerQuote - 0.001);
    expect(r.model).toBe(MODELS.extraction);
    expect(r.fallbackUsed).toBe(false);
  });
});
