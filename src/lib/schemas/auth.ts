/**
 * Auth Zod schemas
 * Stack contract: auth.strategy=phone-otp, backend.validators=zod
 */

import { z } from "zod";

// E.164 AU mobile number validator
// AU mobiles: +614XXXXXXXX (10 digits after +61)
const AuMobileE164 = z
  .string()
  .regex(
    /^\+614\d{8}$/,
    "Must be an Australian mobile number in E.164 format (+614XXXXXXXX)"
  );

// ---------------------------------------------------------------------------
// OTP start (POST /api/auth/otp/start)
// ---------------------------------------------------------------------------
export const OtpStartReqSchema = z.object({
  phone: AuMobileE164,
});

export type OtpStartReq = z.infer<typeof OtpStartReqSchema>;

export const OtpStartResSchema = z.object({
  ok: z.literal(true),
  // messageId returned by Supabase to support correlation in tests
  messageId: z.string().optional(),
});

export type OtpStartRes = z.infer<typeof OtpStartResSchema>;

// ---------------------------------------------------------------------------
// OTP verify (POST /api/auth/otp/verify)
// ---------------------------------------------------------------------------
export const OtpVerifyReqSchema = z.object({
  phone: AuMobileE164,
  token: z
    .string()
    .length(6, "OTP must be exactly 6 digits")
    .regex(/^\d{6}$/, "OTP must contain only digits"),
});

export type OtpVerifyReq = z.infer<typeof OtpVerifyReqSchema>;

export const OtpVerifyResSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  // Indicates whether onboarding is required (new user) or not (returning user)
  onboarding_required: z.boolean(),
  user_id: z.string().uuid(),
});

export type OtpVerifyRes = z.infer<typeof OtpVerifyResSchema>;

// ---------------------------------------------------------------------------
// Onboarding (POST /api/auth/onboarding)
// Wedge constraint: ≤1 onboarding screen; 4 required fields per FR-002
// ---------------------------------------------------------------------------
export const TradeTypeSchema = z.enum([
  "roofer",
  "painter",
  "electrician",
  "plumber",
  "landscaper",
]);

export type TradeType = z.infer<typeof TradeTypeSchema>;

export const OnboardingReqSchema = z.object({
  business_name: z
    .string()
    .min(2, "Business name must be at least 2 characters")
    .max(128, "Business name must be at most 128 characters")
    .trim(),
  trade_type: TradeTypeSchema,
  nsw_licence_number: z
    .string()
    .min(4, "Licence number must be at least 4 characters")
    .max(32, "Licence number must be at most 32 characters")
    .trim()
    .toUpperCase(),
  default_labour_rate_aud: z
    .number()
    .positive("Labour rate must be positive")
    .max(1000, "Labour rate cannot exceed $1,000/hr"),
  // ABN: optional at onboarding but captured for GST compliance (OI-007)
  abn: z
    .string()
    .regex(/^\d{11}$/, "ABN must be 11 digits (no spaces)")
    .optional(),
});

export type OnboardingReq = z.infer<typeof OnboardingReqSchema>;

export const OnboardingResSchema = z.object({
  crew_id: z.string().uuid(),
  licence_verified: z.boolean(),
  licence_verified_at: z.string().datetime().nullable(),
});

export type OnboardingRes = z.infer<typeof OnboardingResSchema>;

// ---------------------------------------------------------------------------
// Licence re-validation (POST /api/crew/licence-validate)
// ---------------------------------------------------------------------------
export const LicenceValidateReqSchema = z.object({
  nsw_licence_number: z
    .string()
    .min(4)
    .max(32)
    .trim()
    .toUpperCase(),
});

export type LicenceValidateReq = z.infer<typeof LicenceValidateReqSchema>;

export const LicenceValidateResSchema = z.object({
  valid: z.boolean(),
  expires_at: z.string().datetime().nullable(),
  licence_holder_name: z.string().nullable(),
  error: z.string().optional(),
});

export type LicenceValidateRes = z.infer<typeof LicenceValidateResSchema>;
