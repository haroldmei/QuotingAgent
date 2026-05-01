/**
 * Route handler auth guards
 * Stack contract: auth.default=supabase-auth, auth.multi_tenant.rls=required
 *
 * Provides helpers for route handlers to:
 *   1. Verify the caller has a valid Supabase JWT
 *   2. Extract crew_id from JWT app_metadata
 *   3. Verify RLS-scoped ownership on a resource
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/db/supabase-server";
import { logger } from "@/lib/logger";

export interface AuthContext {
  userId: string;
  crewId: string;
}

/**
 * Resolve the authenticated caller's context from the request cookies.
 * Returns AuthContext on success, or a 401/403 NextResponse on failure.
 */
export async function resolveAuth(
  _req: NextRequest
): Promise<{ ctx: AuthContext } | { error: NextResponse }> {
  const supabase = await createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const crewId = user.app_metadata?.crew_id as string | undefined;
  if (!crewId) {
    logger.warn({ userId: user.id }, "auth.guard.no_crew_id");
    return {
      error: NextResponse.json(
        { error: "Onboarding not complete" },
        { status: 403 }
      ),
    };
  }

  return { ctx: { userId: user.id, crewId } };
}

/**
 * Type guard — narrow the result of resolveAuth.
 */
export function isAuthError(
  result: { ctx: AuthContext } | { error: NextResponse }
): result is { error: NextResponse } {
  return "error" in result;
}
