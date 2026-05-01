/**
 * Unit tests: quote-calc.ts
 * NFR-016: mutation-tested (Stryker), ≥80% branch coverage
 * FR-026: GST = 10% of subtotal, rounded to 2 decimal places
 */

import { describe, it, expect } from "vitest";
import {
  roundAud,
  lineTotal,
  computeQuoteTotals,
  isValidGst,
} from "@/lib/services/quote-calc";

describe("roundAud", () => {
  it("rounds to 2 decimal places", () => {
    expect(roundAud(1.005)).toBe(1.01);
    expect(roundAud(1.004)).toBe(1.00);
    expect(roundAud(10.5)).toBe(10.5);
    expect(roundAud(0)).toBe(0);
  });

  it("handles negative values", () => {
    expect(roundAud(-1.005)).toBe(-1.01);
  });

  it("handles large values without precision loss", () => {
    expect(roundAud(99999.99)).toBe(99999.99);
    expect(roundAud(12345.678)).toBe(12345.68);
  });
});

describe("lineTotal", () => {
  it("multiplies qty by unit_price_aud", () => {
    expect(lineTotal({ qty: 5, unit_price_aud: 100.0 })).toBe(500.0);
    expect(lineTotal({ qty: 3.5, unit_price_aud: 48.5 })).toBe(169.75);
  });

  it("handles fractional quantities", () => {
    expect(lineTotal({ qty: 0.5, unit_price_aud: 100.0 })).toBe(50.0);
  });

  it("returns 0 for zero quantity", () => {
    expect(lineTotal({ qty: 0, unit_price_aud: 100.0 })).toBe(0);
  });

  it("rounds result to 2 decimal places", () => {
    // 3 × $48.33 = 144.99 — not 144.99000...001
    expect(lineTotal({ qty: 3, unit_price_aud: 48.33 })).toBe(144.99);
  });
});

describe("computeQuoteTotals", () => {
  it("computes subtotal, 10% GST, and grand total correctly", () => {
    const items = [
      { qty: 1, unit_price_aud: 100.0 },
      { qty: 2, unit_price_aud: 50.0 },
    ];
    const result = computeQuoteTotals(items);
    expect(result.subtotalAud).toBe(200.0);
    expect(result.gstAud).toBe(20.0); // 10% of 200
    expect(result.totalAud).toBe(220.0);
  });

  it("handles empty line items", () => {
    const result = computeQuoteTotals([]);
    expect(result.subtotalAud).toBe(0);
    expect(result.gstAud).toBe(0);
    expect(result.totalAud).toBe(0);
  });

  it("rounds GST to 2 decimal places", () => {
    // Subtotal = 33.33 → GST = 3.333 → should round to 3.33
    const items = [{ qty: 1, unit_price_aud: 33.33 }];
    const result = computeQuoteTotals(items);
    expect(result.gstAud).toBe(3.33);
    expect(result.totalAud).toBe(36.66);
  });

  it("does not have floating-point drift for currency values", () => {
    // 0.1 + 0.2 = 0.30000000000000004 in IEEE 754
    const items = [
      { qty: 1, unit_price_aud: 0.1 },
      { qty: 1, unit_price_aud: 0.2 },
    ];
    const result = computeQuoteTotals(items);
    expect(result.subtotalAud).toBe(0.3);
    expect(result.gstAud).toBe(0.03);
    expect(result.totalAud).toBe(0.33);
  });

  it("computes a realistic roofing quote correctly", () => {
    // Typical roofing job
    const items = [
      { qty: 180, unit_price_aud: 48.5 },  // Colorbond sheet 180 lm
      { qty: 40, unit_price_aud: 52.0 },   // Guttering 40 lm
      { qty: 8, unit_price_aud: 38.0 },    // Downpipes 8 ea
      { qty: 16, unit_price_aud: 650.0 },  // Labour: 16 hours @ $650/day
    ];
    const result = computeQuoteTotals(items);
    const expectedSubtotal = 180 * 48.5 + 40 * 52 + 8 * 38 + 16 * 650;
    // = 8730 + 2080 + 304 + 10400 = 21514
    expect(result.subtotalAud).toBe(21514);
    expect(result.gstAud).toBe(2151.4);
    expect(result.totalAud).toBe(23665.4);
  });

  it("GST + subtotal = total always", () => {
    const items = [
      { qty: 1.33, unit_price_aud: 77.77 },
      { qty: 0.5, unit_price_aud: 123.45 },
    ];
    const result = computeQuoteTotals(items);
    // Allow for rounding error of 1 cent due to independent rounding
    expect(Math.abs(result.subtotalAud + result.gstAud - result.totalAud)).toBeLessThanOrEqual(0.01);
  });
});

describe("isValidGst", () => {
  it("returns true for exact 10% GST", () => {
    expect(isValidGst(100, 10)).toBe(true);
    expect(isValidGst(200.0, 20.0)).toBe(true);
    expect(isValidGst(33.33, 3.33)).toBe(true);
  });

  it("returns false for incorrect GST", () => {
    expect(isValidGst(100, 11)).toBe(false);
    expect(isValidGst(100, 9)).toBe(false);
    expect(isValidGst(100, 0)).toBe(false);
  });

  it("allows 0.5 cent tolerance for rounding", () => {
    // 33.333... × 0.1 = 3.3333... → rounds to 3.33, within 0.005 tolerance
    expect(isValidGst(33.33, 3.33)).toBe(true);
  });
});
