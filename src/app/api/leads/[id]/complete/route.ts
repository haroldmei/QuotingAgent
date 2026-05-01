/**
 * POST /api/leads/[id]/complete — mark job complete and capture invoiced amount (FR-029)
 * Stack contract: backend.validators=zod, auth.default=supabase-auth
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveAuth, isAuthError } from "@/lib/auth/guard";
import { createServerClient } from "@/lib/db/supabase-server";
import { JobCompletionReqSchema } from "@/lib/schemas/leads";
import { logger } from "@/lib/logger";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await resolveAuth(req);
  if (isAuthError(auth)) return auth.error;
  const { crewId, userId } = auth.ctx;
  const { id } = await params;

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

  if (lead.status !== "won") {
    return NextResponse.json(
      { error: "Lead must be in 'won' status to mark complete" },
      { status: 409 }
    );
  }

  // Get the most recent quote total for this lead
  const { data: latestQuote } = await supabase
    .from("quotes")
    .select("total_aud")
    .eq("lead_id", id)
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
