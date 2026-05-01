/**
 * Chunking tests.
 */

import { describe, expect, it } from "vitest";
import { chunkText, estimateTokens } from "@/lib/ai/chunking";

describe("estimateTokens", () => {
  it("returns 0 for empty string", () => {
    expect(estimateTokens("")).toBe(0);
  });

  it("scales linearly with character length", () => {
    const a = estimateTokens("a".repeat(100));
    const b = estimateTokens("a".repeat(200));
    expect(b).toBeCloseTo(a * 2, 0);
  });
});

describe("chunkText", () => {
  it("returns [] on empty / whitespace input", () => {
    expect(chunkText("")).toEqual([]);
    expect(chunkText("   \n\n  ")).toEqual([]);
  });

  it("preserves single short paragraph as one chunk", () => {
    const out = chunkText("This is a single short paragraph.");
    expect(out).toHaveLength(1);
    expect(out[0]).toContain("single short paragraph");
  });

  it("splits multiple paragraphs that exceed chunk size", () => {
    const para = "Lorem ipsum dolor sit amet. ".repeat(50);
    const out = chunkText(`${para}\n\n${para}\n\n${para}`, { chunkTokens: 100 });
    expect(out.length).toBeGreaterThan(1);
  });

  it("handles a single huge paragraph via sliding window", () => {
    const para = "x".repeat(10_000);
    const out = chunkText(para, { chunkTokens: 100 });
    expect(out.length).toBeGreaterThan(2);
  });

  it("respects custom chunk size", () => {
    const para = "Lorem ipsum dolor sit amet. ".repeat(20);
    const small = chunkText(para, { chunkTokens: 30 });
    const large = chunkText(para, { chunkTokens: 200 });
    expect(small.length).toBeGreaterThanOrEqual(large.length);
  });
});
