/**
 * GET /api/quotes/[id]/view — public quote view (FR-020)
 * No authentication — verified via signed HMAC token in ?t= query param.
 *
 * Returns JSON with the full quote data for rendering the customer view page.
 * The actual HTML page is rendered at /q/[token] (Next.js App Router page).
 *
 * On load: fires read-receipt (sms_event {opened} + lead status → "opened")
 *
 * Stack contract:
 *   security.rate_limiting=required (60/min per IP)
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/db/supabase-server";
import { verifyQuoteToken } from "@/lib/services/hmac";
import { rateLimiters } from "@/lib/services/rate-limit";
import { sendPushToUser } from "@/lib/push/web-push";
import { logger } from "@/lib/logger";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { id: quoteId } = await params;

  // Rate limit by IP
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { success: rlOk } = await rateLimiters.quoteView.limit(ip);
  if (!rlOk) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  // Verify signed token from query param
  const token = req.nextUrl.searchParams.get("t");
  if (!token) {
    return NextResponse.json({ error: "Missing quote token" }, { status: 403 });
  }

  const secret = process.env.QUOTE_SIGNING_HMAC_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const tokenResult = verifyQuoteToken(token, secret);
  if (!tokenResult || tokenResult.quoteId !== quoteId) {
    return NextResponse.json({ error: "Invalid or expired quote link" }, { status: 403 });
  }

  const serviceClient = createServiceClient();

  const { data: quote } = await serviceClient
    .from("quotes")
    .select(
      "id, status, subtotal_aud, gst_aud, total_aud, licence_number_snapshot, statutory_warranty_text, pdf_signed_url, sent_at, leads(id, customer_name, address, crew_id), quote_line_items(description, qty, unit, unit_price_aud, kind, confidence_score, sort_order)"
    )
    .eq("id", quoteId)
    .single();

  if (!quote) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }

  // Fetch crew business info
  const lead = (quote as unknown as { leads: { id: string; customer_name: string; address: string | null; crew_id: string } | null }).leads;
  const { data: crew } = await serviceClient
    .from("crews")
    .select("business_name, abn, nsw_licence_number")
    .eq("id", lead?.crew_id ?? "")
    .single();

  // Fire read-receipt: record sms_event {opened} + update lead status
  // Only fire if status is "delivered" (avoid firing multiple times)
  if (["sent", "delivered"].includes(quote.status) && lead?.id) {
    try {
      await Promise.all([
        serviceClient.from("sms_events").insert({
          quote_id: quoteId,
          event_type: "opened",
        }),
        serviceClient
          .from("leads")
          .update({ status: "opened" })
          .eq("id", lead.id),
        serviceClient
          .from("quotes")
          .update({ status: "sent" }) // keep quote status as "sent" — lead is "opened"
          .eq("id", quoteId),
      ]);

      // Push notification to tradie: "Your quote was opened"
      const { data: crewUsers } = await serviceClient
        .from("users")
        .select("id")
        .eq("crew_id", lead.crew_id);

      if (crewUsers && crewUsers.length > 0) {
        for (const crewUser of crewUsers) {
          const { data: pushSubs } = await serviceClient
            .from("push_subscriptions")
            .select("endpoint, p256dh, auth_key")
            .eq("user_id", crewUser.id);

          if (pushSubs && pushSubs.length > 0) {
            const subs = pushSubs.map((s: { endpoint: string; p256dh: string; auth_key: string }) => ({
              endpoint: s.endpoint,
              keys: { p256dh: s.p256dh, auth: s.auth_key },
            }));
            await sendPushToUser(subs, {
              title: "Quote Opened",
              body: `${lead.customer_name} viewed your quote for ${lead.address ?? "your property"}`,
              url: `/leads/${lead.id}`,
              tag: `quote-opened-${quoteId}`,
            });
          }
        }
      }
    } catch (readErr) {
      // Non-fatal — don't block the view
      logger.warn({ err: readErr, quoteId }, "quote.view.read_receipt_failed");
    }
  }

  // Sort line items by sort_order
  const lineItems = ((quote as unknown as { quote_line_items: Array<{ description: string; qty: string; unit: string; unit_price_aud: string; kind: string; confidence_score: number; sort_order: number }> }).quote_line_items ?? []).sort((a, b) => a.sort_order - b.sort_order);

  return NextResponse.json({
    quote: {
      id: quote.id,
      status: quote.status,
      subtotal_aud: Number(quote.subtotal_aud),
      gst_aud: Number(quote.gst_aud),
      total_aud: Number(quote.total_aud),
      licence_number: quote.licence_number_snapshot,
      statutory_warranty_text: quote.statutory_warranty_text,
      pdf_url: quote.pdf_signed_url,
      sent_at: quote.sent_at,
    },
    lead: {
      customer_name: lead?.customer_name,
      address: lead?.address,
    },
    crew: {
      business_name: crew?.business_name,
      abn: crew?.abn,
      nsw_licence_number: crew?.nsw_licence_number,
    },
    line_items: lineItems.map((item) => ({
      description: item.description,
      qty: Number(item.qty),
      unit: item.unit,
      unit_price_aud: Number(item.unit_price_aud),
      kind: item.kind,
    })),
  });
}
