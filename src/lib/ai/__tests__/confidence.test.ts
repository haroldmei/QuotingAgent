/**
 * Confidence summary tests.
 * Stack contract: ai.confidence_scores=required.
 * Wedge: FR-014 per-line + whole-quote thresholds.
 */

import { describe, expect, it } from "vitest";
import {
  summariseConfidence,
  LINE_CONFIDENCE_THRESHOLD,
  REFUSE_THRESHOLD,
} from "@/lib/ai/confidence";
import type { ExtractedQuoteLine } from "@/prompts/extraction";

function line(score: number, kind: "material" | "labour" = "material"): ExtractedQuoteLine {
  return {
    description: `line@${score}`,
    qty: 1,
    unit: "ea",
    unit_price_aud: 10,
    kind,
    confidence_score: score,
  };
}

describe("summariseConfidence", () => {
  it("empty lines → requiresReview true (no quote to send)", () => {
    const r = summariseConfidence([]);
    expect(r.requiresReview).toBe(true);
    expect(r.flaggedLineCount).toBe(0);
    expect(r.overallConfidence).toBe(0);
  });

  it("all lines high confidence → no review needed", () => {
    const r = summariseConfidence([line(95), line(90), line(88)]);
    expect(r.requiresReview).toBe(false);
    expect(r.hasFlaggedLines).toBe(false);
    expect(r.flaggedLineCount).toBe(0);
  });

  it("one flagged line → flag count 1, no whole-quote review", () => {
    const r = summariseConfidence([line(95), line(LINE_CONFIDENCE_THRESHOLD - 1), line(90)]);
    expect(r.flaggedLineCount).toBe(1);
    expect(r.hasFlaggedLines).toBe(true);
    expect(r.requiresReview).toBe(false);
  });

  it("more than 3 flagged lines → forces review", () => {
    const lines = [line(70), line(70), line(70), line(70)]; // 4 flagged
    const r = summariseConfidence(lines);
    expect(r.requiresReview).toBe(true);
    expect(r.flaggedLineCount).toBe(4);
  });

  it("overall confidence below REFUSE_THRESHOLD → forces review", () => {
    const r = summariseConfidence([line(REFUSE_THRESHOLD - 5)]);
    expect(r.requiresReview).toBe(true);
    expect(r.overallConfidence).toBe(REFUSE_THRESHOLD - 5);
  });

  it("threshold lines at exactly 80 are NOT flagged", () => {
    const r = summariseConfidence([line(LINE_CONFIDENCE_THRESHOLD)]);
    expect(r.flaggedLineCount).toBe(0);
  });

  it("computes mean across mixed-kind lines", () => {
    const r = summariseConfidence([line(80, "material"), line(90, "labour")]);
    expect(r.overallConfidence).toBe(85);
  });
});
