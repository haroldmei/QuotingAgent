/**
 * HMAC signing helpers
 * Stack contract: security.secrets_manager=gcp-secret-manager
 * Used for:
 *   1. DA webhook signature verification (HMAC-SHA256)
 *   2. Quote signed token mint + verify (customer quote view / accept)
 *
 * Design (docs/03-system-design.md §6.1):
 *   Quote signed token = HMAC-SHA256(quote_id || ":" || expiry_unix, QUOTE_SIGNING_HMAC_SECRET)
 *   Expiry ≤ 30 days (FR-016).
 */

import { createHmac, timingSafeEqual } from "crypto";

// ---------------------------------------------------------------------------
// DA Webhook verification
// ---------------------------------------------------------------------------

/**
 * Verify the HMAC-SHA256 signature on an incoming DA aggregator webhook.
 * The signature is in the `X-DA-Signature` header (hex-encoded).
 *
 * @param secret    HMAC secret (from DA_WEBHOOK_HMAC_SECRET env)
 * @param body      Raw request body (Buffer or string)
 * @param signature Hex-encoded HMAC from request header
 */
export function verifyDaWebhookSignature(
  secret: string,
  body: string | Buffer,
  signature: string
): boolean {
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret)
    .update(typeof body === "string" ? body : body)
    .digest("hex");

  try {
    const expectedBuf = Buffer.from(expected, "hex");
    const sigBuf = Buffer.from(signature.replace(/^sha256=/, ""), "hex");
    if (expectedBuf.length !== sigBuf.length) return false;
    return timingSafeEqual(expectedBuf, sigBuf);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Quote signed token (customer view + accept)
// ---------------------------------------------------------------------------

const QUOTE_TOKEN_EXPIRY_SECONDS = 30 * 24 * 60 * 60; // 30 days

export interface SignedQuoteToken {
  token: string;
  expiresAt: string; // ISO 8601
}

/**
 * Mint a signed token for a quote URL.
 * The token is HMAC-SHA256(quote_id + ":" + expiry_unix_ts, secret).
 */
export function mintQuoteToken(
  quoteId: string,
  secret: string,
  expirySeconds: number = QUOTE_TOKEN_EXPIRY_SECONDS
): SignedQuoteToken {
  const expiryUnix = Math.floor(Date.now() / 1000) + expirySeconds;
  const payload = `${quoteId}:${expiryUnix}`;
  const hmac = createHmac("sha256", secret).update(payload).digest("hex");
  const token = `${quoteId}.${expiryUnix}.${hmac}`;

  return {
    token,
    expiresAt: new Date(expiryUnix * 1000).toISOString(),
  };
}

/**
 * Verify a signed quote token.
 * Returns the quoteId if valid, null if invalid or expired.
 */
export function verifyQuoteToken(
  token: string,
  secret: string
): { quoteId: string } | null {
  if (!token || !secret) return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [quoteId, expiryStr, providedHmac] = parts;
  if (!quoteId || !expiryStr || !providedHmac) return null;

  const expiryUnix = parseInt(expiryStr, 10);
  if (isNaN(expiryUnix)) return null;

  // Check expiry
  if (Math.floor(Date.now() / 1000) > expiryUnix) return null;

  // Verify HMAC
  const payload = `${quoteId}:${expiryUnix}`;
  const expected = createHmac("sha256", secret).update(payload).digest("hex");

  try {
    const expectedBuf = Buffer.from(expected, "hex");
    const providedBuf = Buffer.from(providedHmac, "hex");
    if (expectedBuf.length !== providedBuf.length) return null;
    if (!timingSafeEqual(expectedBuf, providedBuf)) return null;
  } catch {
    return null;
  }

  return { quoteId };
}

/**
 * Build the customer quote view URL.
 */
export function buildQuoteViewUrl(baseUrl: string, token: string): string {
  return `${baseUrl}/q/${encodeURIComponent(token)}`;
}
