/**
 * POST /api/auth/otp
 * Phone-OTP flow (start + verify)
 *
 * Stack contract:
 *   auth.default=supabase-auth
 *   auth.strategy=phone-otp
 *   security.rate_limiting=required → Upstash ratelimit (NFR-012)
 *   auth.session=jwt-with-refresh    → cookies set by @supabase/ssr
 *
 * Rate limits (NFR-012):
 *   OTP start:  5/hr per phone number
 *   OTP verify: 10/hr per phone number
 *
 * Wedge constraint (FR-001 + FR-003):
 *   - OTP received within 30s
 *   - On verify success + new user → onboarding_required: true
 *   - On verify success + returning user → onboarding_required: false
 */

import { NextRequest, NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { createServerClient } from "@/lib/db/supabase-server";
import {
  OtpStartReqSchema,
  OtpVerifyReqSchema,
  type OtpStartRes,
  type OtpVerifyRes,
} from "@/lib/schemas/auth";
import { logger } from "@/lib/logger";

// ---------------------------------------------------------------------------
// Rate limiters
// ---------------------------------------------------------------------------
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const otpStartLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "1h"),
  prefix: "rl:otp:start",
  analytics: false,
});

const otpVerifyLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "1h"),
  prefix: "rl:otp:verify",
  analytics: false,
});

// ---------------------------------------------------------------------------
// POST /api/auth/otp
// Distinguishes start vs. verify by presence of `token` field.
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Determine action: if `token` present → verify; else → start
  const hasToken =
    typeof body === "object" &&
    body !== null &&
    "token" in body &&
    typeof (body as Record<string, unknown>).token === "string";

  if (hasToken) {
    return handleVerify(req, body);
  } else {
    return handleStart(req, body);
  }
}

// ---------------------------------------------------------------------------
// Start: send OTP via Supabase Auth
// ---------------------------------------------------------------------------
async function handleStart(
  req: NextRequest,
  body: unknown
): Promise<NextResponse> {
  const parse = OtpStartReqSchema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json(
      { error: "Invalid phone number", details: parse.error.flatten() },
      { status: 400 }
    );
  }

  const { phone } = parse.data;

  // Rate limit by phone number
  const { success, reset } = await otpStartLimiter.limit(phone);
  if (!success) {
    const retryAfter = Math.ceil((reset - Date.now()) / 1000);
    return NextResponse.json(
      { error: "Too many OTP requests. Try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfter) },
      }
    );
  }

  const supabase = await createServerClient();
  const { error, data } = await supabase.auth.signInWithOtp({
    phone,
    options: {
      // channel: 'sms' is the default for phone OTP in Supabase
      shouldCreateUser: true,
    },
  });

  if (error) {
    logger.error({ phone: "[redacted]", err: error.message }, "OTP start failed");
    return NextResponse.json(
      { error: "Failed to send OTP. Please try again." },
      { status: 500 }
    );
  }

  logger.info({ action: "otp_start" }, "OTP sent");

  const res: OtpStartRes = { ok: true };
  return NextResponse.json(res, { status: 200 });
}

// ---------------------------------------------------------------------------
// Verify: verify OTP, create session cookies
// ---------------------------------------------------------------------------
async function handleVerify(
  req: NextRequest,
  body: unknown
): Promise<NextResponse> {
  const parse = OtpVerifyReqSchema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json(
      { error: "Invalid OTP request", details: parse.error.flatten() },
      { status: 400 }
    );
  }

  const { phone, token } = parse.data;

  // Rate limit by phone number
  const { success, reset } = await otpVerifyLimiter.limit(phone);
  if (!success) {
    const retryAfter = Math.ceil((reset - Date.now()) / 1000);
    return NextResponse.json(
      { error: "Too many verification attempts. Try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfter) },
      }
    );
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase.auth.verifyOtp({
    phone,
    token,
    type: "sms",
  });

  if (error || !data.user || !data.session) {
    logger.warn(
      { action: "otp_verify_failed", err: error?.message },
      "OTP verification failed"
    );
    return NextResponse.json(
      { error: "Invalid or expired OTP." },
      { status: 401 }
    );
  }

  const user = data.user;

  // Determine if this is a new user needing onboarding
  // A user has completed onboarding if their user_metadata contains crew_id
  const crewId =
    user.user_metadata?.crew_id as string | undefined;
  const onboardingRequired = !crewId;

  logger.info(
    {
      action: "otp_verify_success",
      user_id: user.id,
      onboarding_required: onboardingRequired,
    },
    "OTP verified"
  );

  // Session cookies are handled by @supabase/ssr via the cookie store.
  // The access_token and refresh_token are returned for the client to
  // hand to the Supabase JS SDK (setSession).
  const res: OtpVerifyRes = {
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    onboarding_required: onboardingRequired,
    user_id: user.id,
  };

  return NextResponse.json(res, { status: 200 });
}
