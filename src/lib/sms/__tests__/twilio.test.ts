/**
 * Unit tests: twilio.ts
 * Covers buildQuoteSmsBody (pure), verifyTwilioSignature (pure wrapper),
 * and sendSms happy/error paths with mocked Twilio SDK.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Mock the twilio module ─────────────────────────────────────────────────
// vi.hoisted ensures these are available inside the vi.mock factory (which is hoisted)
const { mockMessagesCreate, mockValidateRequest } = vi.hoisted(() => ({
  mockMessagesCreate: vi.fn(),
  mockValidateRequest: vi.fn(),
}));

vi.mock("twilio", () => {
  const mockClient = {
    messages: { create: mockMessagesCreate },
  };
  // twilio() constructor returns mockClient
  const twilioFn = vi.fn(() => mockClient);
  // twilio.validateRequest is a static method
  (twilioFn as unknown as { validateRequest: typeof mockValidateRequest }).validateRequest =
    mockValidateRequest;
  return { default: twilioFn };
});

// ── Mock logger ────────────────────────────────────────────────────────────
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { sendSms, verifyTwilioSignature, buildQuoteSmsBody, __INTERNAL__ } from "@/lib/sms/twilio";

// ── buildQuoteSmsBody ──────────────────────────────────────────────────────

describe("buildQuoteSmsBody", () => {
  it("uses first name only", () => {
    const body = buildQuoteSmsBody("AusRoof", "John Smith", "12 Main St, Sydney", "https://t.ly/abc");
    expect(body).toContain("John,");
    expect(body).not.toContain("Smith");
  });

  it("uses first segment of address", () => {
    const body = buildQuoteSmsBody("AusRoof", "Jane", "42 King St, Parramatta, NSW", "https://t.ly/xyz");
    expect(body).toContain("42 King St");
    expect(body).not.toContain("Parramatta");
  });

  it("stays within 160 chars for a typical message", () => {
    const body = buildQuoteSmsBody(
      "AusRoof Pty Ltd",
      "John Smith",
      "123 George St, Sydney NSW 2000",
      "https://app.quotingagent.com.au/q/abc123"
    );
    expect(body.length).toBeLessThanOrEqual(160);
  });

  it("truncates long messages to 160 chars with short fallback", () => {
    const longLink = "https://app.quotingagent.com.au/q/" + "a".repeat(100);
    const body = buildQuoteSmsBody("VeryLongTradeName", "FirstName", "Very Long Street Address", longLink);
    expect(body.length).toBeLessThanOrEqual(160);
  });

  it("includes the quote link in the message", () => {
    const link = "https://app.quotingagent.com.au/q/testtoken123";
    const body = buildQuoteSmsBody("Roofer", "Alice", "1 Main St", link);
    expect(body).toContain(link);
  });
});

// ── verifyTwilioSignature ──────────────────────────────────────────────────

describe("verifyTwilioSignature", () => {
  it("delegates to twilio.validateRequest", () => {
    mockValidateRequest.mockReturnValueOnce(true);
    const result = verifyTwilioSignature(
      "auth-token",
      "sig",
      "https://example.com/webhook",
      { MessageSid: "SM123" }
    );
    expect(result).toBe(true);
    expect(mockValidateRequest).toHaveBeenCalledWith(
      "auth-token",
      "sig",
      "https://example.com/webhook",
      { MessageSid: "SM123" }
    );
  });

  it("returns false when validateRequest returns false", () => {
    mockValidateRequest.mockReturnValueOnce(false);
    const result = verifyTwilioSignature("token", "bad-sig", "https://example.com", {});
    expect(result).toBe(false);
  });
});

// ── sendSms ────────────────────────────────────────────────────────────────

describe("sendSms", () => {
  beforeEach(() => {
    process.env.TWILIO_ACCOUNT_SID = "ACtest";
    process.env.TWILIO_AUTH_TOKEN = "auth-token-test";
    process.env.TWILIO_PHONE_NUMBER = "+61400000000";
    __INTERNAL__.resetClient();
    mockMessagesCreate.mockReset();
  });

  afterEach(() => {
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_PHONE_NUMBER;
    __INTERNAL__.resetClient();
  });

  it("returns messageSid and status on success", async () => {
    mockMessagesCreate.mockResolvedValueOnce({ sid: "SM123", status: "queued" });
    const result = await sendSms("+61411000001", "Hello!", "https://cb.url/delivery");
    expect(result).toEqual({ messageSid: "SM123", status: "queued" });
  });

  it("calls messages.create with correct params", async () => {
    mockMessagesCreate.mockResolvedValueOnce({ sid: "SM456", status: "queued" });
    await sendSms("+61411000002", "Test body", "https://cb.url/delivery");
    expect(mockMessagesCreate).toHaveBeenCalledWith({
      to: "+61411000002",
      from: "+61400000000",
      body: "Test body",
      statusCallback: "https://cb.url/delivery",
    });
  });

  it("sends without statusCallback when not provided", async () => {
    mockMessagesCreate.mockResolvedValueOnce({ sid: "SM789", status: "queued" });
    await sendSms("+61411000003", "No callback");
    expect(mockMessagesCreate).toHaveBeenCalledWith({
      to: "+61411000003",
      from: "+61400000000",
      body: "No callback",
    });
  });

  it("throws when TWILIO_PHONE_NUMBER is missing", async () => {
    delete process.env.TWILIO_PHONE_NUMBER;
    await expect(sendSms("+61411000004", "body")).rejects.toThrow("TWILIO_PHONE_NUMBER");
  });

  it("propagates Twilio API errors", async () => {
    mockMessagesCreate.mockRejectedValueOnce(new Error("Twilio rate limit exceeded"));
    await expect(sendSms("+61411000005", "body")).rejects.toThrow("Twilio rate limit exceeded");
  });

  it("throws when credentials are missing", async () => {
    delete process.env.TWILIO_ACCOUNT_SID;
    __INTERNAL__.resetClient();
    await expect(sendSms("+61411000006", "body")).rejects.toThrow(
      "TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN not configured"
    );
  });
});
