/**
 * GET  /api/leads — list leads for authenticated crew (FR-004)
 * POST /api/leads — create manual lead (FR-007)
 *
 * Stack contract:
 *   auth.default=supabase-auth (RLS via crew_id in JWT)
 *   backend.orm=prisma (NOTE: using Supabase client directly here per auth-engineer setup)
 *   backend.validators=zod
 *   security.rate_limiting=required → Upstash (NFR-012)
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveAuth, isAuthError } from "@/lib/auth/guard";
import { createServerClient } from "@/lib/db/supabase-server";
import { ManualLeadReqSchema, LeadListQuerySchema } from "@/lib/schemas/leads";
import { rateLimiters } from "@/lib/services/rate-limit";
import { logger } from "@/lib/logger";

// ---------------------------------------------------------------------------
// GET /api/leads
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest) {
  const auth = await resolveAuth(req);
  if (isAuthError(auth)) return auth.error;
  const { crewId } = auth.ctx;

  // Rate limit
  const { success } = await rateLimiters.leadList.limit(crewId);
  if (!success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  // Parse query params
  const sp = req.nextUrl.searchParams;
  const parseResult = LeadListQuerySchema.safeParse({
    cursor: sp.get("cursor") ?? undefined,
    status: sp.get("status") ?? undefined,
    limit: sp.get("limit") ?? "20",
  });

  if (!parseResult.success) {
    return NextResponse.json(
      { error: "Invalid query parameters", details: parseResult.error.flatten() },
      { status: 400 }
    );
  }
  const { cursor, status, limit } = parseResult.data;

  const supabase = await createServerClient();
  let query = supabase
    .from("leads")
    .select("*", { count: "exact" })
    .eq("crew_id", crewId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status) {
    query = query.eq("status", status);
  }

  if (cursor) {
    // Keyset pagination: cursor = created_at of last item
    query = query.lt("created_at", cursor);
  }

  const { data: leads, error, count } = await query;

  if (error) {
    logger.error({ err: error, crewId }, "leads.list.error");
    return NextResponse.json({ error: "Failed to fetch leads" }, { status: 500 });
  }

  const items = leads ?? [];
  const nextCursor =
    items.length === limit
      ? items[items.length - 1]?.created_at ?? null
      : null;

  return NextResponse.json({
    items,
    next_cursor: nextCursor,
    total: count ?? 0,
  });
}

// ---------------------------------------------------------------------------
// POST /api/leads — manual lead creation
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  const auth = await resolveAuth(req);
  if (isAuthError(auth)) return auth.error;
  const { crewId } = auth.ctx;

  // Rate limit
  const { success } = await rateLimiters.leadCreate.limit(crewId);
  if (!success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parse = ManualLeadReqSchema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parse.error.flatten() },
      { status: 422 }
    );
  }

  const supabase = await createServerClient();
  const { data: lead, error } = await supabase
    .from("leads")
    .insert({
      crew_id: crewId,
      source: "manual",
      customer_name: parse.data.customer_name,
      customer_mobile: parse.data.customer_mobile ?? null,
      customer_email: parse.data.customer_email ?? null,
      address: parse.data.address ?? null,
      description: parse.data.description ?? null,
    })
    .select()
    .single();

  if (error || !lead) {
    logger.error({ err: error, crewId }, "leads.create.error");
    return NextResponse.json({ error: "Failed to create lead" }, { status: 500 });
  }

  logger.info({ leadId: lead.id, crewId }, "leads.created");
  return NextResponse.json(lead, { status: 201 });
}
