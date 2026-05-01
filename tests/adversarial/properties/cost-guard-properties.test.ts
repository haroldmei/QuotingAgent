/**
 * Adversarial: AI cost-guard router.
 *
 * Wedge guarantee NFR-005: A$0.30/quote mean. The cost guard
 * (chooseExtractionModel) is the runtime enforcement. Property targets:
 *
 *   1. Monotonicity — strictly increasing running cost never reverts to a
 *      *more expensive* extraction model
 *   2. At soft cap → fallback (sonnet)
 *   3. At hard cap → cheap (haiku) regardless of cost (no upgrade past hard)
 *   4. NaN / negative / Infinity inputs don't pick opus by accident
 *   5. Cost computation is monotonic non-decreasing in tokens
 *   6. Cost is positive when tokens are positive (no rebate exploit)
 *   7. Unknown model returns 0 (handled, not crash)
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { chooseExtractionModel } from "@/lib/ai/client";
import {
  computeCallCostAud,
  computeEmbeddingCostAud,
  estimateCostAud,
} from "@/lib/ai/pricing";
import { MODELS, COST_GUARD_AUD } from "@/lib/ai/models";

describe("[adversarial] chooseExtractionModel — cost guard", () => {
  it("at exactly soft cap → fallback (sonnet)", () => {
    const r = chooseExtractionModel(COST_GUARD_AUD.softCapPerQuote);
    expect(r.fallbackUsed).toBe(true);
    expect(r.model).toBe(MODELS.fallback);
  });

  it("just below soft cap → haiku, no fallback flag", () => {
    const r = chooseExtractionModel(COST_GUARD_AUD.softCapPerQuote - 0.001);
    expect(r.fallbackUsed).toBe(false);
    expect(r.model).toBe(MODELS.extraction);
  });

  it("at exactly hard cap → haiku (no further upgrades)", () => {
    const r = chooseExtractionModel(COST_GUARD_AUD.hardCapPerQuote);
    expect(r.model).toBe(MODELS.extraction);
    expect(r.fallbackUsed).toBe(false);
  });

  it("massively above hard cap → still haiku", () => {
    const r = chooseExtractionModel(99_999);
    expect(r.model).toBe(MODELS.extraction);
  });

  it("negative / NaN / Infinity inputs do not yield opus extraction", () => {
    for (const c of [-1, -0.5, NaN, -Infinity, Infinity]) {
      const r = chooseExtractionModel(c);
      // Opus is the vision model; extraction must NEVER be opus.
      expect(r.model).not.toBe(MODELS.vision);
    }
  });

  it("returned model is always one of the known model IDs", () => {
    fc.assert(
      fc.property(
        fc.float({ min: -10, max: 10, noNaN: true, noDefaultInfinity: true }),
        (cost) => {
          const r = chooseExtractionModel(cost);
          expect([MODELS.extraction, MODELS.fallback]).toContain(r.model);
        },
      ),
      { numRuns: 200 },
    );
  });

  it("monotonic: running cost going up never *unsets* fallback once set", () => {
    // Sweep upward; once we cross soft cap, fallback should be true; once
    // we cross hard cap, model must be extraction (no further "upgrades").
    let crossedSoft = false;
    let crossedHard = false;
    const samples = Array.from({ length: 1000 }, (_, i) => i * 0.001);
    for (const cost of samples) {
      const r = chooseExtractionModel(cost);
      if (cost >= COST_GUARD_AUD.softCapPerQuote && !crossedSoft) crossedSoft = true;
      if (cost >= COST_GUARD_AUD.hardCapPerQuote && !crossedHard) crossedHard = true;
      if (crossedHard) {
        expect(r.model).toBe(MODELS.extraction);
      } else if (crossedSoft) {
        expect(r.model).toBe(MODELS.fallback);
      } else {
        expect(r.model).toBe(MODELS.extraction);
      }
    }
  });
});

describe("[adversarial] cost computation properties", () => {
  it("computeCallCostAud is monotonic in input tokens", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1_000_000 }),
        fc.integer({ min: 0, max: 1_000_000 }),
        fc.integer({ min: 0, max: 100_000 }),
        (a, b, output) => {
          fc.pre(a < b);
          const costA = computeCallCostAud(MODELS.vision, a, output);
          const costB = computeCallCostAud(MODELS.vision, b, output);
          expect(costB).toBeGreaterThanOrEqual(costA);
        },
      ),
      { numRuns: 200 },
    );
  });

  it("computeCallCostAud is monotonic in output tokens", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1_000_000 }),
        fc.integer({ min: 0, max: 1_000_000 }),
        fc.integer({ min: 0, max: 100_000 }),
        (a, b, input) => {
          fc.pre(a < b);
          const costA = computeCallCostAud(MODELS.vision, input, a);
          const costB = computeCallCostAud(MODELS.vision, input, b);
          expect(costB).toBeGreaterThanOrEqual(costA);
        },
      ),
      { numRuns: 200 },
    );
  });

  it("computeCallCostAud(unknown model, *, *) returns 0", () => {
    expect(computeCallCostAud("not-a-model", 1000, 1000)).toBe(0);
    expect(computeCallCostAud("", 1000, 1000)).toBe(0);
  });

  it("zero tokens → zero cost", () => {
    for (const m of Object.values(MODELS)) {
      expect(computeCallCostAud(m, 0, 0)).toBe(0);
    }
  });

  it("opus > sonnet > haiku for the same token count", () => {
    const i = 100_000;
    const o = 10_000;
    const opus = computeCallCostAud(MODELS.vision, i, o);
    const sonnet = computeCallCostAud(MODELS.fallback, i, o);
    const haiku = computeCallCostAud(MODELS.extraction, i, o);
    expect(opus).toBeGreaterThan(sonnet);
    expect(sonnet).toBeGreaterThan(haiku);
  });

  it("cached input tokens cost ≤ uncached input tokens", () => {
    // Cache reads are billed at ~10% of base
    const uncached = computeCallCostAud(MODELS.vision, 100_000, 0);
    const cached = computeCallCostAud(MODELS.vision, 0, 0, 100_000);
    expect(cached).toBeLessThanOrEqual(uncached);
    expect(cached).toBeGreaterThan(0); // not free
  });

  it("cache writes cost ≥ uncached input (1.25x base)", () => {
    const uncached = computeCallCostAud(MODELS.vision, 100_000, 0);
    const written = computeCallCostAud(MODELS.vision, 0, 0, 0, 100_000);
    expect(written).toBeGreaterThan(uncached);
  });

  it("never returns negative cost for non-negative inputs", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10_000_000 }),
        fc.integer({ min: 0, max: 10_000_000 }),
        fc.integer({ min: 0, max: 10_000_000 }),
        fc.integer({ min: 0, max: 10_000_000 }),
        (i, o, c, w) => {
          for (const m of Object.values(MODELS)) {
            expect(computeCallCostAud(m, i, o, c, w)).toBeGreaterThanOrEqual(0);
          }
        },
      ),
      { numRuns: 300 },
    );
  });

  it("estimateCostAud is consistent with computeCallCostAud (no exp output term)", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100_000 }),
        fc.integer({ min: 0, max: 10_000 }),
        (input, expected) => {
          const a = estimateCostAud({
            model: MODELS.vision,
            inputTokens: input,
            expectedOutputTokens: expected,
          });
          const b = computeCallCostAud(MODELS.vision, input, expected);
          expect(a).toBeCloseTo(b, 6);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("embedding cost is positive and bounded (~9c per million tokens)", () => {
    // Voyage-3 at 0.06 USD / 1M, AUD 1.55x → ~A$0.093 per million tokens
    const c = computeEmbeddingCostAud(1_000_000);
    expect(c).toBeGreaterThan(0);
    // Should be well under A$0.30/quote NFR-005 budget even at 1M tokens
    expect(c).toBeLessThan(0.3);
    // And ~A$0.093 specifically (sanity)
    expect(c).toBeGreaterThan(0.05);
    expect(c).toBeLessThan(0.15);
  });

  it("FINDING (AT-COST-001): a single 50k-input + 4096-output Opus call exceeds the A$0.50 hard cap", () => {
    // Filed bug: an attacker can craft a payload (huge contextNote, 15
    // photos with rich descriptions, expanded RAG candidate list) such
    // that a SINGLE vision call's cost exceeds the per-quote hard cap.
    // The cost guard runs BETWEEN calls (chooseExtractionModel), not
    // WITHIN a single Opus call. The fix needs:
    //   - a tighter `max_tokens` governor on the vision pass, OR
    //   - a pre-call estimateCostAud()+abort hook in withCostTracking,
    //     OR
    //   - a payload-byte limit before invoking the model.
    // Currently the only mitigation is the photo count (max 15) + the
    // 4096 max_tokens vision cap — but a 50k-input prompt with 4096
    // output already costs A$0.546.
    const cost = computeCallCostAud(MODELS.vision, 50_000, 4096);
    expect(cost).toBeGreaterThan(COST_GUARD_AUD.hardCapPerQuote);
  });

  it("attacker-style burst: 100 calls at 5k input + 4k output sums under limit safely?", () => {
    // 100x ([5k input * $5/1M opus] + [4k output * $25/1M opus]) = ?
    // = 100 * (0.025 + 0.1) = $12.50 USD * 1.55 = A$19.38
    // This should be REJECTED by upstream rate-limit + cost guard, but the
    // pure pricing math just confirms the per-call cost is $0.19.
    const single = computeCallCostAud(MODELS.vision, 5000, 4000);
    expect(single).toBeLessThan(COST_GUARD_AUD.hardCapPerQuote);
    // 100 calls would be over A$0.30 budget; the cost guard *must* trip
    // before then in a real run via chooseExtractionModel.
    // Confirm the guard would have tripped after just 2-3 calls:
    let running = 0;
    let trippedAtCall = -1;
    for (let i = 0; i < 100; i++) {
      running += single;
      if (chooseExtractionModel(running).fallbackUsed && trippedAtCall === -1) {
        trippedAtCall = i + 1;
      }
    }
    expect(trippedAtCall).toBeGreaterThan(0);
    expect(trippedAtCall).toBeLessThan(10); // tripped early
  });
});
