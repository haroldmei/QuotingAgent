/**
 * GET   /api/quotes/[id] — fetch quote with line items (FR-015)
 * PATCH /api/quotes/[id] — update quote metadata
 *
 * RLS enforced: crew_id = auth.crew_id()
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveAuth, isAuthError } from "@/lib/auth/guard";
import { createServerClient } from "@/lib/db/supabase-server";
import type { QuoteStatus } from "@/lib/db/database.types";
import { logger } from "@/lib/logger";

type Params = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// GET /api/quotes/[id]
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest, { params }: Params) {
  const auth = await resolveAuth(req);
  if (isAuthError(auth)) return auth.error;
  const { crewId } = auth.ctx;
  const { id } = await params;

  const supabase = await createServerClient();

  // Accept either a quote_id or a lead_id. The leads list currently links via
  // lead_id (`/quotes/{lead.id}/sent`); migrating those CTAs over time, but
  // until then the API is the canonical place to handle the dual-key lookup.
  let { data: quote, error } = await supabase
    .from("quotes")
    .select("*, quote_line_items(*), sms_events(*)")
    .eq("id", id)
    .eq("crew_id", crewId)
    .maybeSingle();

  if (!quote) {
    const fallback = await supabase
      .from("quotes")
      .select("*, quote_line_items(*), sms_events(*)")
      .eq("lead_id", id)
      .eq("crew_id", crewId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    quote = fallback.data;
    error = fallback.error;
  }

  if (error || !quote) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }

  return NextResponse.json(quote);
}

// ---------------------------------------------------------------------------
// PATCH /api/quotes/[id] — update line items
// Delegates heavy lifting to /api/quotes/[id]/line-items/[lineId]
// This route handles high-level quote status transitions only
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

  // Only allow status transitions on this route
  const allowedStatuses = ["draft", "approved"] as const;
  type AllowedStatus = typeof allowedStatuses[number];

  const { status } = (body ?? {}) as { status?: string };
  if (status && !allowedStatuses.includes(status as AllowedStatus)) {
    return NextResponse.json(
      { error: `Invalid status. Allowed: ${allowedStatuses.join(", ")}` },
      { status: 400 }
    );
  }

  const supabase = await createServerClient();
  const updates: Partial<{ status: QuoteStatus }> = {};
  if (status) updates.status = status as QuoteStatus;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const { error } = await supabase
    .from("quotes")
    .update(updates)
    .eq("id", id)
    .eq("crew_id", crewId);

  if (error) {
    logger.error({ err: error, quoteId: id }, "quote.patch.error");
    return NextResponse.json({ error: "Quote not found or update failed" }, { status: 404 });
  }

  // Fetch updated quote + line items separately (no FK types)
  const { data: quote } = await supabase
    .from("quotes")
    .select("*")
    .eq("id", id)
    .single();

  const { data: lineItems } = await supabase
    .from("quote_line_items")
    .select("*")
    .eq("quote_id", id)
    .order("sort_order");

  return NextResponse.json({ ...quote, quote_line_items: lineItems ?? [] });
}
