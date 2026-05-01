/**
 * Twilio SMS service
 * Stack contract: sms.provider=twilio, sms.au_long_code=required, sms.read_receipt=webhook
 *
 * Sends SMS via AU long-code (FR-017) and verifies Twilio webhook signatures (FR-018, FR-019).
 * Email fallback via Resend is triggered from the webhook handler.
 */

import twilio from "twilio";
import { logger } from "@/lib/logger";

let _client: ReturnType<typeof twilio> | null = null;

function getTwilioClient(): ReturnType<typeof twilio> {
  if (_client) return _client;
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) {
    throw new Error("TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN not configured");
  }
  _client = twilio(accountSid, authToken);
  return _client;
}

export interface SmsResult {
  messageSid: string;
  status: string;
}

/**
 * Send an SMS via Twilio AU long-code.
 * Returns the Twilio message SID on success, throws on failure.
 *
 * The status callback URL is set to our delivery webhook (FR-017).
 * The callbackUrl must be the full public URL, e.g. https://app.example.com/api/webhooks/twilio/delivery
 */
export async function sendSms(
  to: string,
  body: string,
  callbackUrl?: string
): Promise<SmsResult> {
  const client = getTwilioClient();
  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!from) throw new Error("TWILIO_PHONE_NUMBER not configured");

  const message = await client.messages.create({
    to,
    from,
    body,
    ...(callbackUrl
      ? { statusCallback: callbackUrl }
      : {}),
  });

  logger.info({ messageSid: message.sid, status: message.status }, "sms.sent");

  return {
    messageSid: message.sid,
    status: message.status,
  };
}

/**
 * Verify a Twilio request signature.
 * Per NFR-010: rejects requests with invalid signatures (HMAC-SHA1).
 *
 * @param authToken - Twilio auth token (from env)
 * @param signature - Value of the X-Twilio-Signature header
 * @param url       - The full URL of the webhook endpoint (must match exactly)
 * @param params    - The POST body params as a key-value object
 */
export function verifyTwilioSignature(
  authToken: string,
  signature: string,
  url: string,
  params: Record<string, string>
): boolean {
  return twilio.validateRequest(authToken, signature, url, params);
}

/**
 * Build the default SMS body for a quote.
 * Must be ≤ 160 characters (FR-017).
 */
export function buildQuoteSmsBody(
  tradeName: string,
  customerName: string,
  address: string,
  quoteLink: string
): string {
  // Base message — keep short to leave room for the link
  const base = `Hi ${customerName.split(" ")[0]}, ${tradeName} has sent you a quote for ${address.split(",")[0]}. View & accept: `;
  const full = `${base}${quoteLink}`;
  if (full.length <= 160) return full;
  // Shorter fallback: "TradeName quote: <link>"
  const short = `${tradeName} quote: ${quoteLink}`;
  if (short.length <= 160) return short;
  // Hard truncate with ellipsis to guarantee ≤160 chars (FR-017)
  return short.slice(0, 157) + "...";
}

/** Reset client (for tests). */
export const __INTERNAL__ = {
  resetClient: () => { _client = null; },
};
