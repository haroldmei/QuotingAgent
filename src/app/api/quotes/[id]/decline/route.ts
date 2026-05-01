/**
 * POST /api/quotes/[id]/decline — customer declines quote (FR-022)
 * No authentication required — verified via signed HMAC token.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/db/supabase-server";
import { DeclineReqSchema } from "@/lib/schemas/quotes";
import { verifyQuoteToken } from "@/lib/services/hmac";
import { rateLimiters } from "@/lib/services/rate-limit";
import { sendPushToUser } from "@/lib/push/web-push";
import { logger } from "@/lib/logger";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { id: quoteId } = await params;

  // Rate limit by IP
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { success: rlOk } = await rateLimiters.quoteAccept.limit(ip);
  if (!rlOk) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parse = DeclineReqSchema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parse.error.flatten() },
      { status: 422 }
    );
  }

  const secret = process.env.QUOTE_SIGNING_HMAC_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const tokenResult = verifyQuoteToken(parse.data.signed_token, secret);
  if (!tokenResult || tokenResult.quoteId !== quoteId) {
    return NextResponse.json({ error: "Invalid or expired quote link" }, { status: 403 });
  }

  const serviceClient = createServiceClient();

  const { data: quote } = await serviceClient
    .from("quotes")
    .select("id, lead_id, crew_id, status, leads(customer_name, address)")
    .eq("id", quoteId)
    .single();

  if (!quote) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }

  if (quote.status === "accepted") {
    return NextResponse.json({ error: "Quote has already been accepted" }, { status: 409 });
  }

  if (quote.status === "declined") {
    return NextResponse.json({ declined_at: new Date().toISOString(), already_declined: true });
  }

  // Update quote + lead status
  const now = new Date().toISOString();

  await serviceClient
    .from("quotes")
    .update({ status: "declined" })
    .eq("id", quoteId);

  await serviceClient
    .from("leads")
    .update({ status: "lost" })
    .eq("id", quote.lead_id);

  const lead = (quote as unknown as { leads: { customer_name: string; address: string | null } | null }).leads;

  // Push notification to tradie
  try {
    const { data: crewUsers } = await serviceClient
      .from("users")
      .select("id")
      .eq("crew_id", quote.crew_id);

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
          const declineMsg = parse.data.reason
            ? `Declined: "${parse.data.reason.slice(0, 100)}"`
            : "Quote declined";
          await sendPushToUser(subs, {
            title: "Quote Declined",
            body: `${lead?.customer_name ?? "Customer"}: ${declineMsg}`,
            url: `/leads/${quote.lead_id}`,
            tag: `quote-declined-${quoteId}`,
          });
        }
      }
    }
  } catch (pushErr) {
    logger.warn({ err: pushErr }, "quote.decline.push_failed");
  }

  logger.info(
    { quoteId, leadId: quote.lead_id, reason: parse.data.reason ? "[redacted]" : null },
    "quote.declined"
  );

  return NextResponse.json({ declined_at: now });
}
