/**
 * POST /api/auth/onboarding
 * Save crew profile after phone-OTP verification.
 *
 * Stack contract:
 *   auth.default=supabase-auth
 *   auth.multi_tenant.model=crew-as-tenant
 *   security.nsw_licence_binding=required → licence validated before insert
 *   external_integrations.service_nsw.method=rest → Service NSW lookup
 *
 * Wedge constraints (FR-002):
 *   - 4 required fields: business_name, trade_type, nsw_licence_number, default_labour_rate_aud
 *   - Licence validated via Service NSW API before profile is saved
 *   - User cannot proceed unless licence is valid
 *
 * Uses service-role client to write crew + user rows (no crew_id in JWT yet).
 * After insert, sets user_metadata.crew_id on the Supabase Auth user so
 * subsequent JWTs include crew_id for RLS.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient, createServiceClient } from "@/lib/db/supabase-server";
import { OnboardingReqSchema, type OnboardingRes } from "@/lib/schemas/auth";
import { validateNswLicence } from "@/lib/auth/nsw-licence";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  // 1. Authenticate the caller — must have a valid Supabase JWT
  const supabase = await createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Reject if onboarding already completed (crew_id in user_metadata)
  if (user.user_metadata?.crew_id) {
    return NextResponse.json(
      { error: "Onboarding already completed" },
      { status: 409 }
    );
  }

  // 3. Parse and validate request body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parse = OnboardingReqSchema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parse.error.flatten() },
      { status: 422 }
    );
  }

  const {
    business_name,
    trade_type,
    nsw_licence_number,
    default_labour_rate_aud,
    abn,
  } = parse.data;

  // 4. Validate NSW contractor licence (NFR-019, FR-002)
  // Block onboarding if licence is invalid or Service NSW API is unavailable
  let licenceVerified = false;
  let licenceVerifiedAt: string | null = null;

  try {
    const licenceResult = await validateNswLicence(nsw_licence_number);
    if (!licenceResult.valid) {
      return NextResponse.json(
        {
          error: "Invalid NSW contractor licence number",
          details: licenceResult.error ?? "Licence not found or expired",
        },
        { status: 422 }
      );
    }
    licenceVerified = true;
    licenceVerifiedAt = new Date().toISOString();
  } catch (err) {
    // Service NSW API unavailable — block onboarding per NFR-019
    logger.error({ err }, "Service NSW API unavailable during onboarding");
    return NextResponse.json(
      {
        error:
          "NSW licence verification service is currently unavailable. Please try again in a moment.",
      },
      { status: 503 }
    );
  }

  // 5. Insert crew and user using service-role client
  const serviceClient = createServiceClient();

  // Begin: create crew
  const { data: crew, error: crewError } = await serviceClient
    .from("crews")
    .insert({
      business_name,
      trade_type,
      nsw_licence_number,
      licence_verified: licenceVerified,
      licence_verified_at: licenceVerifiedAt,
      default_labour_rate_aud: String(default_labour_rate_aud),
      abn: abn ?? null,
    })
    .select("id")
    .single();

  if (crewError || !crew) {
    logger.error({ err: crewError }, "Failed to create crew");
    return NextResponse.json(
      { error: "Failed to create account. Please try again." },
      { status: 500 }
    );
  }

  // Create user row (id = Supabase Auth user id)
  const { error: userError } = await serviceClient.from("users").insert({
    id: user.id,
    crew_id: crew.id,
    phone: user.phone!,
    role: "owner",
  });

  if (userError) {
    logger.error({ err: userError, crew_id: crew.id }, "Failed to create user row");
    // Attempt to roll back crew creation
    await serviceClient.from("crews").delete().eq("id", crew.id);
    return NextResponse.json(
      { error: "Failed to create account. Please try again." },
      { status: 500 }
    );
  }

  // 6. Embed crew_id into Supabase Auth user_metadata
  // This ensures subsequent JWTs include crew_id for RLS via auth.crew_id()
  const { error: metaError } = await serviceClient.auth.admin.updateUserById(
    user.id,
    {
      user_metadata: {
        ...user.user_metadata,
        crew_id: crew.id,
      },
      app_metadata: {
        crew_id: crew.id,  // app_metadata is included in JWT automatically
        role: "owner",
      },
    }
  );

  if (metaError) {
    logger.error({ err: metaError, crew_id: crew.id }, "Failed to set user metadata");
    // Non-fatal: crew and user rows exist; user can still log in after token refresh
    // Log for manual remediation
  }

  logger.info(
    {
      action: "onboarding_complete",
      crew_id: crew.id,
      trade_type,
      licence_verified: licenceVerified,
    },
    "Crew onboarded"
  );

  const res: OnboardingRes = {
    crew_id: crew.id,
    licence_verified: licenceVerified,
    licence_verified_at: licenceVerifiedAt,
  };

  return NextResponse.json(res, { status: 201 });
}
