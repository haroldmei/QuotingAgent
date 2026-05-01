/**
 * Unit tests for auth Zod schemas
 * Stack contract: testing.unit=vitest
 *
 * Covers Phase 5 of the auth-engineer skill:
 *  1. Valid OTP start request
 *  2. Invalid phone format rejected
 *  3. OTP verify with wrong-length token rejected
 *  4. Onboarding req with 4 required fields
 *  5. Invalid licence number rejected
 *  6. Invalid trade type rejected
 */

import { describe, it, expect } from "vitest";
import {
  OtpStartReqSchema,
  OtpVerifyReqSchema,
  OnboardingReqSchema,
  LicenceValidateReqSchema,
} from "@/lib/schemas/auth";

// ---------------------------------------------------------------------------
// OTP Start
// ---------------------------------------------------------------------------
describe("OtpStartReqSchema", () => {
  it("accepts a valid AU mobile in E.164", () => {
    const result = OtpStartReqSchema.safeParse({ phone: "+61412345678" });
    expect(result.success).toBe(true);
  });

  it("rejects a non-AU number", () => {
    const result = OtpStartReqSchema.safeParse({ phone: "+12125551234" });
    expect(result.success).toBe(false);
  });

  it("rejects a number without country code", () => {
    const result = OtpStartReqSchema.safeParse({ phone: "0412345678" });
    expect(result.success).toBe(false);
  });

  it("rejects a landline (not mobile)", () => {
    // Australian landlines: +612XXXXXXXX (starts with +612)
    const result = OtpStartReqSchema.safeParse({ phone: "+61212345678" });
    expect(result.success).toBe(false);
  });

  it("rejects empty phone", () => {
    const result = OtpStartReqSchema.safeParse({ phone: "" });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// OTP Verify
// ---------------------------------------------------------------------------
describe("OtpVerifyReqSchema", () => {
  it("accepts valid phone + 6-digit OTP", () => {
    const result = OtpVerifyReqSchema.safeParse({
      phone: "+61412345678",
      token: "123456",
    });
    expect(result.success).toBe(true);
  });

  it("rejects OTP shorter than 6 digits", () => {
    const result = OtpVerifyReqSchema.safeParse({
      phone: "+61412345678",
      token: "12345",
    });
    expect(result.success).toBe(false);
  });

  it("rejects OTP longer than 6 digits", () => {
    const result = OtpVerifyReqSchema.safeParse({
      phone: "+61412345678",
      token: "1234567",
    });
    expect(result.success).toBe(false);
  });

  it("rejects OTP with non-numeric characters", () => {
    const result = OtpVerifyReqSchema.safeParse({
      phone: "+61412345678",
      token: "12345a",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing token", () => {
    const result = OtpVerifyReqSchema.safeParse({ phone: "+61412345678" });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Onboarding
// ---------------------------------------------------------------------------
describe("OnboardingReqSchema", () => {
  const validPayload = {
    business_name: "Penrith Roofing Co",
    trade_type: "roofer",
    nsw_licence_number: "BLD123456",
    default_labour_rate_aud: 85,
  };

  it("accepts a valid onboarding payload", () => {
    const result = OnboardingReqSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it("uppercases licence number", () => {
    const result = OnboardingReqSchema.safeParse({
      ...validPayload,
      nsw_licence_number: "bld123456",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.nsw_licence_number).toBe("BLD123456");
    }
  });

  it("rejects invalid trade_type", () => {
    const result = OnboardingReqSchema.safeParse({
      ...validPayload,
      trade_type: "carpenter",
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative labour rate", () => {
    const result = OnboardingReqSchema.safeParse({
      ...validPayload,
      default_labour_rate_aud: -10,
    });
    expect(result.success).toBe(false);
  });

  it("rejects labour rate > $1000/hr", () => {
    const result = OnboardingReqSchema.safeParse({
      ...validPayload,
      default_labour_rate_aud: 1001,
    });
    expect(result.success).toBe(false);
  });

  it("accepts optional ABN with 11 digits", () => {
    const result = OnboardingReqSchema.safeParse({
      ...validPayload,
      abn: "51824753556",
    });
    expect(result.success).toBe(true);
  });

  it("rejects ABN with wrong format", () => {
    const result = OnboardingReqSchema.safeParse({
      ...validPayload,
      abn: "51 824 753 556",  // with spaces
    });
    expect(result.success).toBe(false);
  });

  it("accepts missing ABN (optional)", () => {
    const { abn: _abn, ...withoutAbn } = { ...validPayload, abn: undefined };
    const result = OnboardingReqSchema.safeParse(withoutAbn);
    expect(result.success).toBe(true);
  });

  it("rejects business name shorter than 2 chars", () => {
    const result = OnboardingReqSchema.safeParse({
      ...validPayload,
      business_name: "A",
    });
    expect(result.success).toBe(false);
  });

  it("trims whitespace from business name", () => {
    const result = OnboardingReqSchema.safeParse({
      ...validPayload,
      business_name: "  Penrith Roofing  ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.business_name).toBe("Penrith Roofing");
    }
  });
});

// ---------------------------------------------------------------------------
// Licence validation request
// ---------------------------------------------------------------------------
describe("LicenceValidateReqSchema", () => {
  it("accepts a valid licence number", () => {
    const result = LicenceValidateReqSchema.safeParse({
      nsw_licence_number: "BLD123456",
    });
    expect(result.success).toBe(true);
  });

  it("uppercases the licence number", () => {
    const result = LicenceValidateReqSchema.safeParse({
      nsw_licence_number: "bld123456",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.nsw_licence_number).toBe("BLD123456");
    }
  });

  it("rejects a licence number shorter than 4 chars", () => {
    const result = LicenceValidateReqSchema.safeParse({
      nsw_licence_number: "AB",
    });
    expect(result.success).toBe(false);
  });
});
