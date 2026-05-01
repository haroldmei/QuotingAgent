/**
 * POST /api/crew/licence-validate
 * Re-validate NSW contractor licence against Service NSW REST API.
 *
 * Stack contract:
 *   security.nsw_licence_binding=required
 *   external_integrations.service_nsw.method=rest
 *   security.rate_limiting=required → 30/hr per crew (NFR-012)
 *
 * Used:
 *   - At onboarding profile step (FR-002) via the "Validate licence" button
 *   - From settings page for manual re-validation
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient, createServiceClient } from "@/lib/db/supabase-server";
import { createRateLimiter, getRedisOptional } from "@/lib/services/rate-limit";
import {
  LicenceValidateReqSchema,
  type LicenceValidateRes,
} from "@/lib/schemas/auth";
import { validateNswLicence } from "@/lib/auth/nsw-licence";
import { logger } from "@/lib/logger";

const licenceLimiter = createRateLimiter("rl:licence:validate", 30, "1h");

export async function POST(req: NextRequest) {
  // Auth
  const supabase = await createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const crewId = user.app_metadata?.crew_id as string | undefined;
  if (!crewId) {
    return NextResponse.json(
      { error: "Onboarding not complete" },
      { status: 403 }
    );
  }

  // Rate limit by crew
  const { success, reset } = await licenceLimiter.limit(crewId);
  if (!success) {
    const retryAfter = Math.ceil((reset - Date.now()) / 1000);
    return NextResponse.json(
      { error: "Too many validation requests." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  // Parse body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parse = LicenceValidateReqSchema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parse.error.flatten() },
      { status: 422 }
    );
  }

  const { nsw_licence_number } = parse.data;

  // Check Redis cache (24h TTL per §7.2 of system design); null in staging
  const redis = getRedisOptional();
  const cacheKey = `licence:${nsw_licence_number}`;
  if (redis) {
    const cached = await redis.get<LicenceValidateRes>(cacheKey);
    if (cached) {
      return NextResponse.json(cached, { status: 200 });
    }
  }

  // Call Service NSW API
  let result: LicenceValidateRes;
  try {
    const apiResult = await validateNswLicence(nsw_licence_number);
    result = {
      valid: apiResult.valid,
      expires_at: apiResult.expires_at ?? null,
      licence_holder_name: apiResult.licence_holder_name ?? null,
      error: apiResult.error,
    };
  } catch (err) {
    logger.error({ err }, "Service NSW API error during licence re-validation");
    return NextResponse.json(
      {
        error:
          "NSW licence verification service is currently unavailable. Please try again.",
      },
      { status: 503 }
    );
  }

  // Cache the result for 24h
  if (result.valid && redis) {
    await redis.set(cacheKey, result, { ex: 86400 });
  }

  // If valid, update the crew record
  if (result.valid) {
    const serviceClient = createServiceClient();
    await serviceClient
      .from("crews")
      .update({
        licence_verified: true,
        licence_verified_at: new Date().toISOString(),
        nsw_licence_number,
      })
      .eq("id", crewId);

    logger.info(
      { action: "licence_revalidated", crew_id: crewId },
      "Licence re-validated"
    );
  }

  return NextResponse.json(result, { status: 200 });
}
