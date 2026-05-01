/**
 * Quote calculation helpers
 * Stack contract: payments.au_gst=stripe-tax (label; V1 uses static 10%)
 * FR-026: GST = 10% of subtotal, rounded to 2 decimal places
 * FR-015: recalculate totals on line item edit
 * NFR-016: mutation-tested (Stryker) for correctness
 */

export interface LineItem {
  qty: number;
  unit_price_aud: number;
}

/**
 * Round a number to 2 decimal places (monetary precision).
 * Uses "round half away from zero" to avoid systematic bias for both
 * positive and negative values (e.g. -1.005 → -1.01, not -1.00).
 */
export function roundAud(value: number): number {
  // Math.sign ensures the tie-break goes away from zero for negatives
  return Math.round((Math.abs(value) + Number.EPSILON) * 100) / 100 * Math.sign(value);
}

/**
 * Compute the line-item total (qty × unit_price_aud).
 */
export function lineTotal(item: LineItem): number {
  return roundAud(item.qty * item.unit_price_aud);
}

/**
 * Compute subtotal, GST (10%), and grand total from an array of line items.
 * GST is always 10% of subtotal (FR-026 — AU statutory requirement).
 * All values are rounded to 2 decimal places.
 */
export function computeQuoteTotals(items: LineItem[]): {
  subtotalAud: number;
  gstAud: number;
  totalAud: number;
} {
  const subtotalAud = roundAud(
    items.reduce((acc, item) => acc + lineTotal(item), 0)
  );
  const gstAud = roundAud(subtotalAud * 0.1);
  const totalAud = roundAud(subtotalAud + gstAud);

  return { subtotalAud, gstAud, totalAud };
}

/**
 * Validate that a GST amount is exactly 10% of the subtotal.
 * Used in tests and compliance checks.
 */
export function isValidGst(subtotalAud: number, gstAud: number): boolean {
  const expected = roundAud(subtotalAud * 0.1);
  return Math.abs(expected - gstAud) < 0.005;
}
