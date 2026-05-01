/**
 * Unit tests: schemas/quotes.ts
 * Validates line item edit, send, accept, decline, Twilio webhook, push subscription schemas.
 */

import { describe, it, expect } from "vitest";
import {
  QuoteEnqueueReqSchema,
  LineItemPatchReqSchema,
  SendReqSchema,
  AcceptReqSchema,
  DeclineReqSchema,
  TwilioDeliveryWebhookSchema,
  PushSubscribeReqSchema,
} from "@/lib/schemas/quotes";

// ── QuoteEnqueueReqSchema ───────────────────────────────────────────────────

describe("QuoteEnqueueReqSchema", () => {
  it("accepts empty object (context is optional)", () => {
    expect(QuoteEnqueueReqSchema.safeParse({}).success).toBe(true);
  });

  it("accepts valid context string", () => {
    expect(
      QuoteEnqueueReqSchema.safeParse({ context: "Roof replacement due to hail damage" }).success
    ).toBe(true);
  });

  it("rejects context over 280 chars", () => {
    expect(
      QuoteEnqueueReqSchema.safeParse({ context: "x".repeat(281) }).success
    ).toBe(false);
  });
});

// ── LineItemPatchReqSchema ──────────────────────────────────────────────────

describe("LineItemPatchReqSchema", () => {
  it("accepts valid single-field patch", () => {
    expect(LineItemPatchReqSchema.safeParse({ qty: 5 }).success).toBe(true);
    expect(LineItemPatchReqSchema.safeParse({ description: "New description" }).success).toBe(true);
    expect(LineItemPatchReqSchema.safeParse({ unit_price_aud: 48.5 }).success).toBe(true);
    expect(LineItemPatchReqSchema.safeParse({ unit: "lm" }).success).toBe(true);
  });

  it("accepts multi-field patch", () => {
    expect(
      LineItemPatchReqSchema.safeParse({ qty: 10, unit_price_aud: 52.0, unit: "ea" }).success
    ).toBe(true);
  });

  it("rejects empty object (at least one field required)", () => {
    expect(LineItemPatchReqSchema.safeParse({}).success).toBe(false);
  });

  it("rejects unknown fields (strict)", () => {
    expect(
      LineItemPatchReqSchema.safeParse({ qty: 5, unknown: "x" }).success
    ).toBe(false);
  });

  it("rejects negative qty", () => {
    expect(LineItemPatchReqSchema.safeParse({ qty: -1 }).success).toBe(false);
  });

  it("accepts zero qty", () => {
    expect(LineItemPatchReqSchema.safeParse({ qty: 0 }).success).toBe(true);
  });

  it("rejects negative unit_price_aud", () => {
    expect(LineItemPatchReqSchema.safeParse({ unit_price_aud: -0.01 }).success).toBe(false);
  });

  it("rejects empty description", () => {
    expect(LineItemPatchReqSchema.safeParse({ description: "" }).success).toBe(false);
  });

  it("rejects description over 280 chars", () => {
    expect(
      LineItemPatchReqSchema.safeParse({ description: "d".repeat(281) }).success
    ).toBe(false);
  });
});

// ── SendReqSchema ───────────────────────────────────────────────────────────

describe("SendReqSchema", () => {
  it("accepts empty object (sms_body is optional)", () => {
    expect(SendReqSchema.safeParse({}).success).toBe(true);
  });

  it("accepts valid sms_body up to 160 chars", () => {
    expect(
      SendReqSchema.safeParse({ sms_body: "a".repeat(160) }).success
    ).toBe(true);
  });

  it("rejects sms_body over 160 chars", () => {
    expect(
      SendReqSchema.safeParse({ sms_body: "a".repeat(161) }).success
    ).toBe(false);
  });
});

// ── AcceptReqSchema ─────────────────────────────────────────────────────────

describe("AcceptReqSchema", () => {
  it("accepts valid signed token", () => {
    expect(
      AcceptReqSchema.safeParse({ signed_token: "quoteId.12345.abcdef" }).success
    ).toBe(true);
  });

  it("accepts optional customer_name", () => {
    expect(
      AcceptReqSchema.safeParse({ signed_token: "tok", customer_name: "John Smith" }).success
    ).toBe(true);
  });

  it("rejects empty signed_token", () => {
    expect(AcceptReqSchema.safeParse({ signed_token: "" }).success).toBe(false);
  });

  it("trims customer_name whitespace", () => {
    const result = AcceptReqSchema.safeParse({
      signed_token: "tok",
      customer_name: "  Jane  ",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.customer_name).toBe("Jane");
  });

  it("rejects customer_name over 128 chars", () => {
    expect(
      AcceptReqSchema.safeParse({ signed_token: "tok", customer_name: "x".repeat(129) }).success
    ).toBe(false);
  });
});

// ── DeclineReqSchema ────────────────────────────────────────────────────────

describe("DeclineReqSchema", () => {
  it("accepts minimal payload", () => {
    expect(DeclineReqSchema.safeParse({ signed_token: "tok" }).success).toBe(true);
  });

  it("accepts optional reason", () => {
    expect(
      DeclineReqSchema.safeParse({ signed_token: "tok", reason: "Price too high" }).success
    ).toBe(true);
  });

  it("rejects empty signed_token", () => {
    expect(DeclineReqSchema.safeParse({ signed_token: "" }).success).toBe(false);
  });

  it("rejects reason over 280 chars", () => {
    expect(
      DeclineReqSchema.safeParse({ signed_token: "tok", reason: "x".repeat(281) }).success
    ).toBe(false);
  });
});

// ── TwilioDeliveryWebhookSchema ─────────────────────────────────────────────

describe("TwilioDeliveryWebhookSchema", () => {
  it("accepts minimal valid payload", () => {
    expect(
      TwilioDeliveryWebhookSchema.safeParse({
        MessageSid: "SM123abc",
        MessageStatus: "delivered",
      }).success
    ).toBe(true);
  });

  it("accepts full payload", () => {
    expect(
      TwilioDeliveryWebhookSchema.safeParse({
        MessageSid: "SM123abc",
        MessageStatus: "failed",
        SmsSid: "SM123abc",
        To: "+61411000001",
        From: "+61400000000",
        ErrorCode: "30003",
      }).success
    ).toBe(true);
  });

  it("rejects missing MessageSid", () => {
    expect(
      TwilioDeliveryWebhookSchema.safeParse({ MessageStatus: "delivered" }).success
    ).toBe(false);
  });

  it("rejects missing MessageStatus", () => {
    expect(
      TwilioDeliveryWebhookSchema.safeParse({ MessageSid: "SM123" }).success
    ).toBe(false);
  });
});

// ── PushSubscribeReqSchema ──────────────────────────────────────────────────

describe("PushSubscribeReqSchema", () => {
  const validSub = {
    endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
    keys: {
      p256dh: "BM3dQxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      auth: "Axxxxxxxxxxxxxxxxx",
    },
  };

  it("accepts valid push subscription", () => {
    expect(PushSubscribeReqSchema.safeParse(validSub).success).toBe(true);
  });

  it("rejects non-URL endpoint", () => {
    expect(
      PushSubscribeReqSchema.safeParse({ ...validSub, endpoint: "not-a-url" }).success
    ).toBe(false);
  });

  it("rejects empty p256dh", () => {
    expect(
      PushSubscribeReqSchema.safeParse({
        ...validSub,
        keys: { p256dh: "", auth: "auth" },
      }).success
    ).toBe(false);
  });

  it("rejects empty auth", () => {
    expect(
      PushSubscribeReqSchema.safeParse({
        ...validSub,
        keys: { p256dh: "key", auth: "" },
      }).success
    ).toBe(false);
  });

  it("rejects missing keys", () => {
    expect(
      PushSubscribeReqSchema.safeParse({ endpoint: "https://example.com" }).success
    ).toBe(false);
  });
});
