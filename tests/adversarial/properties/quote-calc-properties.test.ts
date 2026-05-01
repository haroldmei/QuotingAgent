/**
 * Adversarial property tests: quote-calc.
 *
 * Statutory rule (FR-026): GST = 10% of subtotal exactly. AU customers
 * see this on every invoice; if the math drifts, the tradie risks an ATO
 * audit issue and customers may dispute totals.
 *
 * Properties to break:
 *   1. total = subtotal + gst (conservation)
 *   2. gst ≈ subtotal × 0.10 (within 1c rounding)
 *   3. roundAud is idempotent: roundAud(roundAud(x)) == roundAud(x)
 *   4. lineTotal is monotonic in qty for positive prices
 *   5. zero-qty items contribute zero
 *   6. negative line items don't crash (refund credit edge)
 *   7. Number.MAX_VALUE / Infinity / NaN don't yield NaN totals silently
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  computeQuoteTotals,
  lineTotal,
  roundAud,
  isValidGst,
} from "@/lib/services/quote-calc";

describe("[adversarial] quote-calc properties", () => {
  it("total = subtotal + gst (conservation, ±1c)", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            qty: fc.double({ min: 0, max: 1000, noNaN: true, noDefaultInfinity: true }),
            unit_price_aud: fc.double({
              min: 0,
              max: 100_000,
              noNaN: true,
              noDefaultInfinity: true,
            }),
          }),
          { minLength: 1, maxLength: 50 },
        ),
        (items) => {
          const { subtotalAud, gstAud, totalAud } = computeQuoteTotals(items);
          // Allow 1c slack for accumulated double-rounding
          expect(Math.abs(totalAud - (subtotalAud + gstAud))).toBeLessThanOrEqual(0.01);
        },
      ),
      { numRuns: 500 },
    );
  });

  it("GST is always within 1c of 10% of subtotal", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            qty: fc.double({ min: 0.01, max: 100, noNaN: true, noDefaultInfinity: true }),
            unit_price_aud: fc.double({
              min: 0.01,
              max: 10_000,
              noNaN: true,
              noDefaultInfinity: true,
            }),
          }),
          { minLength: 1, maxLength: 30 },
        ),
        (items) => {
          const { subtotalAud, gstAud } = computeQuoteTotals(items);
          expect(isValidGst(subtotalAud, gstAud)).toBe(true);
        },
      ),
      { numRuns: 300 },
    );
  });

  it("roundAud is idempotent", () => {
    fc.assert(
      fc.property(
        fc.float({ min: -1_000_000, max: 1_000_000, noNaN: true }),
        (n) => {
          expect(roundAud(roundAud(n))).toBeCloseTo(roundAud(n), 10);
        },
      ),
    );
  });

  it("roundAud preserves sign for values >= 0.005 in magnitude", () => {
    // For values smaller than 0.005, rounding to 2dp legitimately yields 0.
    // The sign-preservation property only holds above the rounding threshold.
    fc.assert(
      fc.property(
        fc.double({
          min: -10_000,
          max: 10_000,
          noNaN: true,
          noDefaultInfinity: true,
        }),
        (n) => {
          if (Math.abs(n) < 0.005) return;
          expect(Math.sign(roundAud(n))).toBe(Math.sign(n));
        },
      ),
    );
  });

  it("FINDING: roundAud(tiny denormal positive) collapses sign to 0 (legit, but documented)", () => {
    // Denormals smaller than 0.005 round to 0 (signless). This is correct
    // monetary rounding behaviour, but document so callers don't rely on
    // sign preservation.
    expect(roundAud(1.4e-45)).toBe(0);
    expect(roundAud(0.001)).toBe(0);
    expect(roundAud(0.004)).toBe(0);
  });

  it("empty line items → zero subtotal/gst/total", () => {
    const r = computeQuoteTotals([]);
    expect(r.subtotalAud).toBe(0);
    expect(r.gstAud).toBe(0);
    expect(r.totalAud).toBe(0);
  });

  it("zero-qty rows contribute zero", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            qty: fc.constant(0),
            unit_price_aud: fc.double({
              min: 0.01,
              max: 10_000,
              noNaN: true,
              noDefaultInfinity: true,
            }),
          }),
          { minLength: 1, maxLength: 20 },
        ),
        (items) => {
          const r = computeQuoteTotals(items);
          expect(r.subtotalAud).toBe(0);
        },
      ),
    );
  });

  it("totals never produce NaN for finite inputs", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            qty: fc.double({ min: 0, max: 1e6, noNaN: true, noDefaultInfinity: true }),
            unit_price_aud: fc.double({
              min: 0,
              max: 1e9,
              noNaN: true,
              noDefaultInfinity: true,
            }),
          }),
          { minLength: 0, maxLength: 100 },
        ),
        (items) => {
          const r = computeQuoteTotals(items);
          expect(Number.isFinite(r.subtotalAud)).toBe(true);
          expect(Number.isFinite(r.gstAud)).toBe(true);
          expect(Number.isFinite(r.totalAud)).toBe(true);
        },
      ),
      { numRuns: 300 },
    );
  });

  // ─── Boundary / nasty-input tests (not properties; explicit) ──────────

  it("lineTotal handles 0 qty cleanly", () => {
    expect(lineTotal({ qty: 0, unit_price_aud: 999.99 })).toBe(0);
  });

  it("lineTotal handles 0 unit_price cleanly", () => {
    expect(lineTotal({ qty: 5, unit_price_aud: 0 })).toBe(0);
  });

  it("roundAud(0.005) — half-cent boundary", () => {
    // Round half away from zero per docstring
    const r = roundAud(0.005);
    expect(r).toBeCloseTo(0.01, 5);
  });

  it("roundAud(-0.005) — negative half-cent boundary", () => {
    const r = roundAud(-0.005);
    // Per docstring: "round half away from zero" → -0.01
    expect(r).toBeCloseTo(-0.01, 5);
  });

  it("roundAud(0) is 0 not -0 (sign trap)", () => {
    // Math.sign(0) === 0, so 0 * 0 === 0 (not -0). Confirm.
    expect(Object.is(roundAud(0), 0)).toBe(true);
  });

  it("roundAud handles Infinity → NaN/Infinity gracefully (no throw)", () => {
    expect(() => roundAud(Infinity)).not.toThrow();
    expect(() => roundAud(-Infinity)).not.toThrow();
    expect(() => roundAud(NaN)).not.toThrow();
  });

  it("Quotes with 1000 line items still compute correctly", () => {
    const items = Array.from({ length: 1000 }, () => ({
      qty: 1,
      unit_price_aud: 1.0,
    }));
    const r = computeQuoteTotals(items);
    expect(r.subtotalAud).toBe(1000);
    expect(r.gstAud).toBe(100);
    expect(r.totalAud).toBe(1100);
  });

  it("very small unit prices (sub-cent) round consistently", () => {
    // 1000 × 0.001 = 1.00; 1000 × 0.0001 = 0.10
    const r1 = computeQuoteTotals([{ qty: 1000, unit_price_aud: 0.001 }]);
    expect(r1.subtotalAud).toBe(1);
    const r2 = computeQuoteTotals([{ qty: 1000, unit_price_aud: 0.0001 }]);
    expect(r2.subtotalAud).toBe(0.1);
  });

  it("isValidGst false for off-by-2c errors", () => {
    expect(isValidGst(100, 9.98)).toBe(false);
    expect(isValidGst(100, 10.02)).toBe(false);
  });
});
