/**
 * Quote Zod schemas
 * Stack contract: backend.validators=zod
 * FR-011 (enqueue), FR-015 (line item edit), FR-016-FR-017 (send), FR-020-FR-022 (accept/decline)
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Enqueue AI quote generation — FR-011
// ---------------------------------------------------------------------------
export const QuoteEnqueueReqSchema = z.object({
  context: z.string().max(280).optional(),
});

export type QuoteEnqueueReq = z.infer<typeof QuoteEnqueueReqSchema>;

export const QuoteEnqueueResSchema = z.object({
  quote_id: z.string().uuid(),
  status: z.literal("generating"),
});

export type QuoteEnqueueRes = z.infer<typeof QuoteEnqueueResSchema>;

// ---------------------------------------------------------------------------
// Line item patch — FR-015
// ---------------------------------------------------------------------------
export const LineItemPatchReqSchema = z
  .object({
    description: z.string().min(1).max(280).optional(),
    qty: z.number().nonnegative().optional(),
    unit: z.string().min(1).max(32).optional(),
    unit_price_aud: z.number().nonnegative().optional(),
  })
  .strict()
  .refine(
    (v) => Object.keys(v).length > 0,
    "At least one field must be provided"
  );

export type LineItemPatchReq = z.infer<typeof LineItemPatchReqSchema>;

// ---------------------------------------------------------------------------
// Quote send — FR-016 + FR-017
// ---------------------------------------------------------------------------
export const SendReqSchema = z.object({
  sms_body: z
    .string()
    .max(160, "SMS body must be ≤ 160 characters")
    .optional(),
});

export type SendReq = z.infer<typeof SendReqSchema>;

// ---------------------------------------------------------------------------
// Quote accept — FR-021 (no-auth, signed URL)
// ---------------------------------------------------------------------------
export const AcceptReqSchema = z.object({
  signed_token: z.string().min(1),
  customer_name: z.string().min(1).max(128).trim().optional(),
});

export type AcceptReq = z.infer<typeof AcceptReqSchema>;

// ---------------------------------------------------------------------------
// Quote decline — FR-022 (no-auth, signed URL)
// ---------------------------------------------------------------------------
export const DeclineReqSchema = z.object({
  signed_token: z.string().min(1),
  reason: z.string().max(280).optional(),
});

export type DeclineReq = z.infer<typeof DeclineReqSchema>;

// ---------------------------------------------------------------------------
// Twilio delivery webhook — FR-018
// ---------------------------------------------------------------------------
export const TwilioDeliveryWebhookSchema = z.object({
  MessageSid: z.string(),
  MessageStatus: z.string(), // "sent" | "delivered" | "failed" | "undelivered" | "read"
  SmsSid: z.string().optional(),
  To: z.string().optional(),
  From: z.string().optional(),
  ErrorCode: z.string().optional(),
});

export type TwilioDeliveryWebhook = z.infer<typeof TwilioDeliveryWebhookSchema>;

// ---------------------------------------------------------------------------
// Push subscription — FR-032
// ---------------------------------------------------------------------------

/**
 * Allowlist of known push service hostname patterns.
 * Fix for AT-SSRF-001: reject metadata/loopback/internal URLs.
 * Only FCM, Mozilla, Apple, and Windows push services are permitted.
 */
const ALLOWED_PUSH_HOSTNAME_RE =
  /^(fcm\.googleapis\.com|[\w-]+\.push\.services\.mozilla\.com|[\w-]+\.web\.push\.apple\.com|[\w-]+\.notify\.windows\.com|[\w.-]+\.googleapis\.com)$/;

function isAllowedPushEndpoint(endpoint: string): boolean {
  try {
    const u = new URL(endpoint);
    // Must be HTTPS
    if (u.protocol !== "https:") return false;
    // Must not be loopback or private network
    const hostname = u.hostname;
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      // GCP metadata servers
      hostname === "metadata.google.internal" ||
      hostname === "169.254.169.254" ||
      // RFC-1918 / link-local prefixes (simple check)
      /^10\./.test(hostname) ||
      /^192\.168\./.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
    ) {
      return false;
    }
    return ALLOWED_PUSH_HOSTNAME_RE.test(hostname);
  } catch {
    return false;
  }
}

export const PushSubscribeReqSchema = z
  .object({
    endpoint: z
      .string()
      .url()
      .refine(isAllowedPushEndpoint, {
        message:
          "Push endpoint must be a known push service (FCM, Mozilla, Apple, or Windows)",
      }),
    keys: z.object({
      p256dh: z.string().min(1),
      auth: z.string().min(1),
    }),
  });

export type PushSubscribeReq = z.infer<typeof PushSubscribeReqSchema>;
