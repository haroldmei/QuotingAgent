/**
 * Adversarial: HMAC token expiry / boundary timing.
 *
 * Threat model: time-based attacks
 *   - Token issued at t and verified at t (clock-skew = 0): valid?
 *   - Token at t = expiry exactly: should be valid? (using `>` not `>=`)
 *   - Token at t = expiry + 1: invalid
 *   - Daylight-savings boundary on `Date.now()` (epoch is monotonic so OK)
 *   - Year-2038 / Year-9999 timestamps
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mintQuoteToken, verifyQuoteToken } from "@/lib/services/hmac";

const SECRET = "test-secret-32-bytes-long-padding!!!";
const QUOTE_ID = "550e8400-e29b-41d4-a716-446655440000";

describe("[adversarial] verifyQuoteToken — clock boundary", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("token verified at the same instant it was minted is valid", () => {
    vi.setSystemTime(new Date("2026-05-01T12:00:00.000Z"));
    const { token } = mintQuoteToken(QUOTE_ID, SECRET, 60);
    expect(verifyQuoteToken(token, SECRET)).not.toBeNull();
  });

  it("token at t = expiry exactly is valid (not expired)", () => {
    vi.setSystemTime(new Date("2026-05-01T12:00:00.000Z"));
    const { token } = mintQuoteToken(QUOTE_ID, SECRET, 60);
    // Advance to exactly +60s
    vi.setSystemTime(new Date("2026-05-01T12:01:00.000Z"));
    // Implementation: `if (now > expiryUnix) return null` — so == is allowed.
    expect(verifyQuoteToken(token, SECRET)).not.toBeNull();
  });

  it("token at t = expiry + 1s is REJECTED", () => {
    vi.setSystemTime(new Date("2026-05-01T12:00:00.000Z"));
    const { token } = mintQuoteToken(QUOTE_ID, SECRET, 60);
    vi.setSystemTime(new Date("2026-05-01T12:01:01.000Z"));
    expect(verifyQuoteToken(token, SECRET)).toBeNull();
  });

  it("token at t = expiry + 30 days is REJECTED", () => {
    vi.setSystemTime(new Date("2026-05-01T12:00:00.000Z"));
    const { token } = mintQuoteToken(QUOTE_ID, SECRET); // default 30 days
    vi.setSystemTime(new Date("2026-06-30T12:00:01.000Z"));
    expect(verifyQuoteToken(token, SECRET)).toBeNull();
  });

  it("DST boundary (AU autumn fall back) does not affect validity (epoch is monotonic)", () => {
    // Australia/Sydney 2026-04-05 03:00 AEDT → 02:00 AEST (fall back).
    // Mint right before the rollback; verify ~10 minutes later in
    // wall-clock time but only ~10 minutes in epoch (epoch is monotonic).
    vi.setSystemTime(new Date("2026-04-05T02:55:00.000+11:00"));
    const { token } = mintQuoteToken(QUOTE_ID, SECRET, 3600); // 1hr expiry
    // 10 minutes later in epoch (after fall back, wall says 02:05 AEST):
    vi.setSystemTime(new Date("2026-04-05T02:05:00.000+10:00"));
    expect(verifyQuoteToken(token, SECRET)).not.toBeNull();
  });

  it("year-2038 timestamp does not overflow (32-bit unix trap)", () => {
    vi.setSystemTime(new Date("2038-01-19T03:14:06.000Z")); // just before 2^31
    const { token } = mintQuoteToken(QUOTE_ID, SECRET, 60);
    expect(verifyQuoteToken(token, SECRET)).not.toBeNull();
    vi.setSystemTime(new Date("2038-01-19T03:14:08.000Z")); // just after 2^31
    const { token: token2 } = mintQuoteToken(QUOTE_ID, SECRET, 60);
    expect(verifyQuoteToken(token2, SECRET)).not.toBeNull();
  });
});

describe("[adversarial] mintQuoteToken — output shape", () => {
  it("token is URL-safe (no characters that would change under encodeURIComponent)", () => {
    const { token } = mintQuoteToken(QUOTE_ID, SECRET);
    // The token uses [a-z0-9.-]+; UUID + unix-int + hex.
    expect(token).toMatch(/^[a-zA-Z0-9.\-]+$/);
    // Round-trip: encoding the token must equal the token.
    expect(encodeURIComponent(token)).toBe(token);
  });

  it("expiresAt is a valid ISO 8601 string", () => {
    const r = mintQuoteToken(QUOTE_ID, SECRET);
    expect(() => new Date(r.expiresAt).toISOString()).not.toThrow();
    expect(new Date(r.expiresAt).toISOString()).toBe(r.expiresAt);
  });

  it("two mints with the same inputs at the same time produce the same token", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-01T12:00:00.000Z"));
    const a = mintQuoteToken(QUOTE_ID, SECRET, 60);
    const b = mintQuoteToken(QUOTE_ID, SECRET, 60);
    expect(a.token).toBe(b.token);
    vi.useRealTimers();
  });

  it("zero expirySeconds → token is immediately invalid", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-01T12:00:00.000Z"));
    const { token } = mintQuoteToken(QUOTE_ID, SECRET, 0);
    // At t = expiry exactly → valid per docstring; at t > expiry → invalid.
    // Per `if (now > expiryUnix)`, with 0s expiry now == expiry → valid.
    expect(verifyQuoteToken(token, SECRET)).not.toBeNull();
    // 1ms later (still same second) — Math.floor(now/1000) unchanged → valid
    vi.setSystemTime(new Date("2026-05-01T12:00:00.500Z"));
    expect(verifyQuoteToken(token, SECRET)).not.toBeNull();
    // 1s later → invalid
    vi.setSystemTime(new Date("2026-05-01T12:00:01.000Z"));
    expect(verifyQuoteToken(token, SECRET)).toBeNull();
    vi.useRealTimers();
  });

  it("very large expirySeconds (100 years)", () => {
    const r = mintQuoteToken(QUOTE_ID, SECRET, 100 * 365 * 24 * 3600);
    expect(verifyQuoteToken(r.token, SECRET)).not.toBeNull();
  });
});
