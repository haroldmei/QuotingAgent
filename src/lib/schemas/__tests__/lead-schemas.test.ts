/**
 * Unit tests: schemas/leads.ts
 * Validates AU mobile regex, lead creation, DA webhook, and pagination schemas.
 */

import { describe, it, expect } from "vitest";
import {
  AuMobileE164,
  ManualLeadReqSchema,
  LeadPatchReqSchema,
  LeadListQuerySchema,
  DaWebhookReqSchema,
  JobCompletionReqSchema,
} from "@/lib/schemas/leads";

// ── AuMobileE164 ────────────────────────────────────────────────────────────

describe("AuMobileE164", () => {
  it.each([
    "+61411000001",
    "+61400000000",
    "+61499999999",
  ])("accepts valid AU mobile: %s", (mobile) => {
    expect(AuMobileE164.safeParse(mobile).success).toBe(true);
  });

  it.each([
    ["0411000001", "no country code"],
    ["+1411000001", "US country code"],
    ["+61311000001", "landline prefix"],
    ["+6141100000", "too short"],
    ["+614110000011", "too long"],
    ["", "empty string"],
    ["+61 411 000 001", "spaces"],
  ])("rejects '%s' (%s)", (mobile) => {
    expect(AuMobileE164.safeParse(mobile).success).toBe(false);
  });
});

// ── ManualLeadReqSchema ─────────────────────────────────────────────────────

describe("ManualLeadReqSchema", () => {
  it("accepts minimal valid payload (name only)", () => {
    const result = ManualLeadReqSchema.safeParse({ customer_name: "John Smith" });
    expect(result.success).toBe(true);
  });

  it("accepts full payload", () => {
    const result = ManualLeadReqSchema.safeParse({
      customer_name: "Jane Doe",
      customer_mobile: "+61411000001",
      customer_email: "jane@example.com",
      address: "1 Main St, Sydney NSW 2000",
      description: "Roof replacement needed",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty customer_name", () => {
    const result = ManualLeadReqSchema.safeParse({ customer_name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects customer_name over 128 chars", () => {
    const result = ManualLeadReqSchema.safeParse({ customer_name: "a".repeat(129) });
    expect(result.success).toBe(false);
  });

  it("trims whitespace from customer_name", () => {
    const result = ManualLeadReqSchema.safeParse({ customer_name: "  John  " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.customer_name).toBe("John");
  });

  it("rejects invalid email", () => {
    const result = ManualLeadReqSchema.safeParse({
      customer_name: "Jane",
      customer_email: "not-an-email",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid AU mobile", () => {
    const result = ManualLeadReqSchema.safeParse({
      customer_name: "Jane",
      customer_mobile: "0411000001",
    });
    expect(result.success).toBe(false);
  });

  it("rejects description over 280 chars", () => {
    const result = ManualLeadReqSchema.safeParse({
      customer_name: "Jane",
      description: "x".repeat(281),
    });
    expect(result.success).toBe(false);
  });
});

// ── LeadPatchReqSchema ──────────────────────────────────────────────────────

describe("LeadPatchReqSchema", () => {
  it("accepts valid status transition", () => {
    expect(LeadPatchReqSchema.safeParse({ status: "won" }).success).toBe(true);
  });

  it("accepts partial update", () => {
    expect(
      LeadPatchReqSchema.safeParse({ sms_disabled_followup: true }).success
    ).toBe(true);
  });

  it("rejects unknown fields (strict)", () => {
    expect(
      LeadPatchReqSchema.safeParse({ status: "new", unknownField: "x" }).success
    ).toBe(false);
  });

  it("rejects invalid status value", () => {
    expect(
      LeadPatchReqSchema.safeParse({ status: "invalid_status" }).success
    ).toBe(false);
  });

  it("accepts all valid status values", () => {
    const statuses = ["new", "generating", "draft_ready", "sent", "delivered", "opened", "won", "lost"];
    for (const status of statuses) {
      expect(LeadPatchReqSchema.safeParse({ status }).success).toBe(true);
    }
  });
});

// ── LeadListQuerySchema ─────────────────────────────────────────────────────

describe("LeadListQuerySchema", () => {
  it("defaults limit to 20", () => {
    const result = LeadListQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.limit).toBe(20);
  });

  it("accepts numeric limit string", () => {
    const result = LeadListQuerySchema.safeParse({ limit: "50" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.limit).toBe(50);
  });

  it("rejects limit > 100", () => {
    const result = LeadListQuerySchema.safeParse({ limit: "101" });
    expect(result.success).toBe(false);
  });

  it("rejects limit < 1", () => {
    const result = LeadListQuerySchema.safeParse({ limit: "0" });
    expect(result.success).toBe(false);
  });

  it("accepts status filter", () => {
    const result = LeadListQuerySchema.safeParse({ status: "sent" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid status filter", () => {
    const result = LeadListQuerySchema.safeParse({ status: "bogus" });
    expect(result.success).toBe(false);
  });
});

// ── DaWebhookReqSchema ──────────────────────────────────────────────────────

describe("DaWebhookReqSchema", () => {
  const validPayload = {
    da_reference: "DA2026/0042",
    address: "123 George St, Sydney NSW 2000",
  };

  it("accepts minimal valid payload", () => {
    expect(DaWebhookReqSchema.safeParse(validPayload).success).toBe(true);
  });

  it("accepts full payload", () => {
    expect(
      DaWebhookReqSchema.safeParse({
        ...validPayload,
        description: "Residential roof replacement",
        council: "City of Sydney",
        received_at: "2026-05-01T09:00:00.000Z",
        customer_name: "John Smith",
        customer_mobile: "+61411000001",
      }).success
    ).toBe(true);
  });

  it("rejects empty da_reference", () => {
    expect(DaWebhookReqSchema.safeParse({ ...validPayload, da_reference: "" }).success).toBe(false);
  });

  it("rejects empty address", () => {
    expect(DaWebhookReqSchema.safeParse({ ...validPayload, address: "" }).success).toBe(false);
  });

  it("rejects invalid datetime for received_at", () => {
    expect(
      DaWebhookReqSchema.safeParse({ ...validPayload, received_at: "not-a-date" }).success
    ).toBe(false);
  });

  it("rejects invalid AU mobile", () => {
    expect(
      DaWebhookReqSchema.safeParse({ ...validPayload, customer_mobile: "0411000001" }).success
    ).toBe(false);
  });
});

// ── JobCompletionReqSchema ──────────────────────────────────────────────────

describe("JobCompletionReqSchema", () => {
  it("accepts empty object", () => {
    expect(JobCompletionReqSchema.safeParse({}).success).toBe(true);
  });

  it("accepts valid invoiced amount", () => {
    expect(JobCompletionReqSchema.safeParse({ invoiced_amount_aud: 5000.00 }).success).toBe(true);
  });

  it("accepts zero invoiced amount", () => {
    expect(JobCompletionReqSchema.safeParse({ invoiced_amount_aud: 0 }).success).toBe(true);
  });

  it("rejects negative invoiced amount", () => {
    expect(JobCompletionReqSchema.safeParse({ invoiced_amount_aud: -1 }).success).toBe(false);
  });
});
