/**
 * PATCH /api/quotes/[id]/line-items/[lineId] — edit a quote line item (FR-015)
 * Recalculates subtotal, GST, and total on every edit (auto-save).
 *
 * Stack contract: backend.validators=zod, security.nsw_licence_binding=required
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveAuth, isAuthError } from "@/lib/auth/guard";
import { createServerClient } from "@/lib/db/supabase-server";
import { LineItemPatchReqSchema } from "@/lib/schemas/quotes";
import { computeQuoteTotals } from "@/lib/services/quote-calc";
import { logger } from "@/lib/logger";

type Params = { params: Promise<{ id: string; lineId: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await resolveAuth(req);
  if (isAuthError(auth)) return auth.error;
  const { crewId } = auth.ctx;
  const { id: quoteId, lineId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parse = LineItemPatchReqSchema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parse.error.flatten() },
      { status: 422 }
    );
  }

  const supabase = await createServerClient();

  // Verify quote ownership (RLS via crew_id)
  const { data: quote } = await supabase
    .from("quotes")
    .select("id, crew_id, status")
    .eq("id", quoteId)
    .eq("crew_id", crewId)
    .single();

  if (!quote) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }

  // Don't allow edits on sent/accepted/declined quotes
  if (["sent", "accepted", "declined"].includes(quote.status)) {
    return NextResponse.json(
      { error: `Cannot edit a quote in '${quote.status}' status` },
      { status: 409 }
    );
  }

  // Update the line item — build typed update object
  const updatePayload: Partial<{ description: string; qty: string; unit: string; unit_price_aud: string }> = {};
  if (parse.data.description !== undefined) updatePayload.description = parse.data.description;
  if (parse.data.qty !== undefined) updatePayload.qty = parse.data.qty.toString();
  if (parse.data.unit !== undefined) updatePayload.unit = parse.data.unit;
  if (parse.data.unit_price_aud !== undefined) updatePayload.unit_price_aud = parse.data.unit_price_aud.toString();

  const { error: lineError } = await supabase
    .from("quote_line_items")
    .update(updatePayload)
    .eq("id", lineId)
    .eq("quote_id", quoteId);

  if (lineError) {
    logger.error({ err: lineError, quoteId, lineId }, "quote_line_item.patch.error");
    return NextResponse.json({ error: "Failed to update line item" }, { status: 500 });
  }

  // Recalculate totals from all line items
  const { data: allItems } = await supabase
    .from("quote_line_items")
    .select("qty, unit_price_aud")
    .eq("quote_id", quoteId);

  const items = (allItems ?? []).map((item) => ({
    qty: Number(item.qty),
    unit_price_aud: Number(item.unit_price_aud),
  }));

  const { subtotalAud, gstAud, totalAud } = computeQuoteTotals(items);

  // Update quote totals
  await supabase
    .from("quotes")
    .update({
      subtotal_aud: subtotalAud.toString(),
      gst_aud: gstAud.toString(),
      total_aud: totalAud.toString(),
    })
    .eq("id", quoteId);

  // Return the updated quote with all line items
  const { data: updatedQuote } = await supabase
    .from("quotes")
    .select("*, quote_line_items(*)")
    .eq("id", quoteId)
    .single();

  logger.info({ quoteId, lineId, subtotalAud, gstAud, totalAud }, "quote.line_item.updated");

  return NextResponse.json(updatedQuote);
}
