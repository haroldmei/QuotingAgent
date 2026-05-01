/**
 * GET   /api/leads/[id] — lead detail (FR-005)
 * PATCH /api/leads/[id] — update lead (FR-005)
 *
 * RLS enforced by Supabase: crew_id = auth.crew_id()
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveAuth, isAuthError } from "@/lib/auth/guard";
import { createServerClient } from "@/lib/db/supabase-server";
import { LeadPatchReqSchema, JobCompletionReqSchema } from "@/lib/schemas/leads";
import { logger } from "@/lib/logger";

type Params = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// GET /api/leads/[id]
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest, { params }: Params) {
  const auth = await resolveAuth(req);
  if (isAuthError(auth)) return auth.error;
  const { crewId } = auth.ctx;
  const { id } = await params;

  const supabase = await createServerClient();
  const { data: lead, error } = await supabase
    .from("leads")
    .select("*, photos(*)")
    .eq("id", id)
    .eq("crew_id", crewId)
    .single();

  if (error || !lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  return NextResponse.json(lead);
}

// ---------------------------------------------------------------------------
// PATCH /api/leads/[id]
// ---------------------------------------------------------------------------
export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await resolveAuth(req);
  if (isAuthError(auth)) return auth.error;
  const { crewId } = auth.ctx;
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parse = LeadPatchReqSchema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parse.error.flatten() },
      { status: 422 }
    );
  }

  const updates = parse.data;
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const supabase = await createServerClient();

  // Verify ownership
  const { data: existing } = await supabase
    .from("leads")
    .select("id")
    .eq("id", id)
    .eq("crew_id", crewId)
    .single();

  if (!existing) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  const { data: lead, error } = await supabase
    .from("leads")
    .update(updates)
    .eq("id", id)
    .eq("crew_id", crewId)
    .select()
    .single();

  if (error || !lead) {
    logger.error({ err: error, leadId: id }, "leads.patch.error");
    return NextResponse.json({ error: "Failed to update lead" }, { status: 500 });
  }

  return NextResponse.json(lead);
}

// ---------------------------------------------------------------------------
// POST /api/leads/[id]/complete — mark job complete (FR-029)
// This is handled via a dedicated sub-route handler pattern in Next.js App Router.
// We add it here as a convenience for the PATCH handler.
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest, { params }: Params) {
  const auth = await resolveAuth(req);
  if (isAuthError(auth)) return auth.error;
  const { crewId, userId } = auth.ctx;
  const { id } = await params;

  // Check URL path to distinguish sub-routes
  const url = req.nextUrl.pathname;
  if (!url.endsWith("/complete") && !url.includes("/complete?")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json().catch(() => ({}));
  } catch {
    body = {};
  }

  const parse = JobCompletionReqSchema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parse.error.flatten() },
      { status: 422 }
    );
  }

  const supabase = await createServerClient();

  // Get lead
  const { data: lead } = await supabase
    .from("leads")
    .select("id, crew_id, status")
    .eq("id", id)
    .eq("crew_id", crewId)
    .single();

  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  // Get the most recent quote total for this lead
  const { data: latestQuote } = await supabase
    .from("quotes")
    .select("id, total_aud")
    .eq("lead_id", id)
    .eq("crew_id", crewId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  const quoteTotalAud = latestQuote?.total_aud ? Number(latestQuote.total_aud) : 0;

  // Get trade type from crew
  const { data: crew } = await supabase
    .from("crews")
    .select("trade_type")
    .eq("id", crewId)
    .single();

  if (!crew) {
    return NextResponse.json({ error: "Crew not found" }, { status: 404 });
  }

  // Insert job completion record
  const { data: completion, error } = await supabase
    .from("job_completions")
    .insert({
      lead_id: id,
      crew_id: crewId,
      quoted_amount_aud: quoteTotalAud.toString(),
      invoiced_amount_aud: parse.data.invoiced_amount_aud?.toString() ?? null,
      trade_type: crew.trade_type,
    })
    .select()
    .single();

  if (error || !completion) {
    logger.error({ err: error, leadId: id }, "leads.complete.error");
    return NextResponse.json({ error: "Failed to record completion" }, { status: 500 });
  }

  logger.info(
    { leadId: id, crewId, userId, completionId: completion.id },
    "lead.completed"
  );

  return NextResponse.json(completion, { status: 201 });
}
