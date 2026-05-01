/**
 * Unit tests: hmac.ts
 * Covers DA webhook verification and quote signed token mint/verify.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHmac } from "crypto";
import {
  verifyDaWebhookSignature,
  mintQuoteToken,
  verifyQuoteToken,
  buildQuoteViewUrl,
} from "@/lib/services/hmac";

const SECRET = "test-hmac-secret-32-bytes-long!!";
const QUOTE_ID = "550e8400-e29b-41d4-a716-446655440000";

// ── DA Webhook Verification ────────────────────────────────────────────────

describe("verifyDaWebhookSignature", () => {
  function makeSignature(body: string, secret: string): string {
    return createHmac("sha256", secret).update(body).digest("hex");
  }

  it("returns true for a valid signature", () => {
    const body = '{"leadId":"123","address":"1 Main St"}';
    const sig = makeSignature(body, SECRET);
    expect(verifyDaWebhookSignature(SECRET, body, sig)).toBe(true);
  });

  it("returns true when signature has sha256= prefix", () => {
    const body = '{"leadId":"123"}';
    const sig = `sha256=${makeSignature(body, SECRET)}`;
    expect(verifyDaWebhookSignature(SECRET, body, sig)).toBe(true);
  });

  it("returns false for wrong signature", () => {
    const body = '{"leadId":"123"}';
    const sig = makeSignature(body, "wrong-secret");
    expect(verifyDaWebhookSignature(SECRET, body, sig)).toBe(false);
  });

  it("returns false for tampered body", () => {
    const body = '{"leadId":"123"}';
    const sig = makeSignature(body, SECRET);
    const tamperedBody = '{"leadId":"456"}';
    expect(verifyDaWebhookSignature(SECRET, tamperedBody, sig)).toBe(false);
  });

  it("returns false for empty secret", () => {
    const body = '{"leadId":"123"}';
    const sig = makeSignature(body, SECRET);
    expect(verifyDaWebhookSignature("", body, sig)).toBe(false);
  });

  it("returns false for empty signature", () => {
    const body = '{"leadId":"123"}';
    expect(verifyDaWebhookSignature(SECRET, body, "")).toBe(false);
  });

  it("returns false for non-hex junk signature", () => {
    const body = '{"leadId":"123"}';
    expect(verifyDaWebhookSignature(SECRET, body, "not-hex!!")).toBe(false);
  });

  it("handles Buffer body", () => {
    const body = Buffer.from('{"leadId":"123"}', "utf8");
    const sig = createHmac("sha256", SECRET).update(body).digest("hex");
    expect(verifyDaWebhookSignature(SECRET, body, sig)).toBe(true);
  });
});

// ── mintQuoteToken ─────────────────────────────────────────────────────────

describe("mintQuoteToken", () => {
  it("returns a token with 3 dot-separated parts", () => {
    const result = mintQuoteToken(QUOTE_ID, SECRET);
    const parts = result.token.split(".");
    expect(parts).toHaveLength(3);
  });

  it("embeds the quoteId in the token", () => {
    const result = mintQuoteToken(QUOTE_ID, SECRET);
    expect(result.token.startsWith(QUOTE_ID + ".")).toBe(true);
  });

  it("returns an ISO expiresAt string", () => {
    const result = mintQuoteToken(QUOTE_ID, SECRET);
    expect(new Date(result.expiresAt).toISOString()).toBe(result.expiresAt);
  });

  it("defaults to ~30 day expiry", () => {
    const before = Date.now();
    const result = mintQuoteToken(QUOTE_ID, SECRET);
    const after = Date.now();
    const expiresMs = new Date(result.expiresAt).getTime();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    expect(expiresMs).toBeGreaterThan(before + thirtyDaysMs - 1000);
    expect(expiresMs).toBeLessThan(after + thirtyDaysMs + 1000);
  });

  it("respects custom expirySeconds", () => {
    const before = Math.floor(Date.now() / 1000);
    const result = mintQuoteToken(QUOTE_ID, SECRET, 3600);
    const expiryUnix = parseInt(result.token.split(".")[1]!, 10);
    expect(expiryUnix).toBeGreaterThanOrEqual(before + 3600);
    expect(expiryUnix).toBeLessThanOrEqual(before + 3600 + 2);
  });

  it("produces different tokens for different quoteIds", () => {
    const a = mintQuoteToken("aaa", SECRET);
    const b = mintQuoteToken("bbb", SECRET);
    expect(a.token).not.toBe(b.token);
  });

  it("produces different tokens for different secrets", () => {
    const a = mintQuoteToken(QUOTE_ID, "secret-A-32-bytes-long!!!!!!!!!");
    const b = mintQuoteToken(QUOTE_ID, "secret-B-32-bytes-long!!!!!!!!!");
    expect(a.token).not.toBe(b.token);
  });
});

// ── verifyQuoteToken ───────────────────────────────────────────────────────

describe("verifyQuoteToken", () => {
  it("returns quoteId for a freshly minted token", () => {
    const { token } = mintQuoteToken(QUOTE_ID, SECRET);
    const result = verifyQuoteToken(token, SECRET);
    expect(result).not.toBeNull();
    expect(result!.quoteId).toBe(QUOTE_ID);
  });

  it("returns null for wrong secret", () => {
    const { token } = mintQuoteToken(QUOTE_ID, SECRET);
    expect(verifyQuoteToken(token, "wrong-secret-padding-32-bytes!")).toBeNull();
  });

  it("returns null for expired token", () => {
    // Create token with -1 second expiry (already past)
    const { token } = mintQuoteToken(QUOTE_ID, SECRET, -1);
    expect(verifyQuoteToken(token, SECRET)).toBeNull();
  });

  it("returns null for malformed token (1 part)", () => {
    expect(verifyQuoteToken("onlyone", SECRET)).toBeNull();
  });

  it("returns null for malformed token (2 parts)", () => {
    expect(verifyQuoteToken("only.two", SECRET)).toBeNull();
  });

  it("returns null for empty token", () => {
    expect(verifyQuoteToken("", SECRET)).toBeNull();
  });

  it("returns null for empty secret", () => {
    const { token } = mintQuoteToken(QUOTE_ID, SECRET);
    expect(verifyQuoteToken(token, "")).toBeNull();
  });

  it("returns null when HMAC is tampered", () => {
    const { token } = mintQuoteToken(QUOTE_ID, SECRET);
    const parts = token.split(".");
    parts[2] = parts[2]!.split("").reverse().join(""); // flip the HMAC
    expect(verifyQuoteToken(parts.join("."), SECRET)).toBeNull();
  });

  it("returns null when expiry is not a number", () => {
    const { token } = mintQuoteToken(QUOTE_ID, SECRET);
    const parts = token.split(".");
    parts[1] = "notanumber";
    expect(verifyQuoteToken(parts.join("."), SECRET)).toBeNull();
  });
});

// ── buildQuoteViewUrl ──────────────────────────────────────────────────────

describe("buildQuoteViewUrl", () => {
  it("builds the correct URL with encoded token", () => {
    const token = "abc.123.def";
    const url = buildQuoteViewUrl("https://app.quotingagent.com.au", token);
    expect(url).toBe(
      `https://app.quotingagent.com.au/q/${encodeURIComponent(token)}`
    );
  });

  it("encodes special characters in token", () => {
    const token = "a+b/c=d";
    const url = buildQuoteViewUrl("https://example.com", token);
    expect(url).toContain(encodeURIComponent(token));
  });
});
