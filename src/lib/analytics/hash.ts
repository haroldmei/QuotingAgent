/**
 * One-way hash helpers for PII-free analytics.
 *
 * IDs sent to PostHog are hashed so raw UUIDs are never present in the
 * analytics data. This is a privacy measure per NFR-013:
 *   "Do NOT send PII (email, name, phone) to analytics — use hashed user IDs."
 *
 * We extend that principle to lead_id and quote_id (UUIDs that could be
 * correlated with DB records by a PostHog data leak).
 */

/**
 * Fast, non-cryptographic hex-string hash of an ID for analytics use.
 * Uses SubtleCrypto (SHA-256) when available (browser), falls back to a
 * djb2-style integer hash for SSR contexts where SubtleCrypto isn't available
 * but the server-side PostHog capture does not require hashing anyway.
 *
 * NOTE: this is a one-way hash used for correlation within the same session.
 * It is NOT a secure token.
 */
export async function hashId(id: string): Promise<string> {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(id);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    // Return first 16 hex chars (64-bit prefix) — sufficient for funnel analytics
    return hashArray
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .slice(0, 16);
  }
  // Fallback (should not be hit in modern environments)
  let h = 5381;
  for (let i = 0; i < id.length; i++) {
    h = (h * 33) ^ id.charCodeAt(i);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/**
 * Synchronous variant for contexts where async is not available.
 * Uses djb2; only for edge cases — prefer hashId() where possible.
 */
export function hashIdSync(id: string): string {
  let h = 5381;
  for (let i = 0; i < id.length; i++) {
    h = (h * 33) ^ id.charCodeAt(i);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}
