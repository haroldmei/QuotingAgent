/**
 * POST /api/quotes/[id]/accept — customer one-tap acceptance (FR-021)
 * No authentication required — verified via signed HMAC token.
 *
 * Records: customer_name, quote_id, timestamp, IP, user-agent (legal audit trail)
 * Idempotent on quote_id (UNIQUE constraint on quote_acceptances.quote_id)
 *
 * Stack contract:
 *   security.rate_limiting=required (per IP, 10/min)
 *   database.row_level_security=required (quote_acceptances has no RLS — immutable)
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/db/supabase-server";
import { AcceptReqSchema } from "@/lib/schemas/quotes";
import { verifyQuoteToken } from "@/lib/services/hmac";
import { rateLimiters } from "@/lib/services/rate-limit";
import { sendPushToUser } from "@/lib/push/web-push";
import { Queue } from "bullmq";
import { logger } from "@/lib/logger";

type Params = { params: Promise<{ id: string }> };

let _fsmQueue: Queue | null = null;

function getFsmQueue(): Queue {
  if (_fsmQueue) return _fsmQueue;
  _fsmQueue = new Queue("fsm-push", {
    connection: {
      host: new URL(process.env.UPSTASH_REDIS_REST_URL ?? "redis://localhost:6379").hostname,
      port: 6379,
      password: process.env.UPSTASH_REDIS_REST_TOKEN,
      tls: process.env.UPSTASH_REDIS_REST_URL?.startsWith("https") ? {} : undefined,
    },
  });
  return _fsmQueue;
}

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

  const parse = AcceptReqSchema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parse.error.flatten() },
      { status: 422 }
    );
  }

  // Verify signed token
  const secret = process.env.QUOTE_SIGNING_HMAC_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const tokenResult = verifyQuoteToken(parse.data.signed_token, secret);
  if (!tokenResult || tokenResult.quoteId !== quoteId) {
    return NextResponse.json({ error: "Invalid or expired quote link" }, { status: 403 });
  }

  const serviceClient = createServiceClient();

  // Load quote + lead for audit record
  const { data: quote } = await serviceClient
    .from("quotes")
    .select("id, lead_id, crew_id, status, total_aud, leads(customer_name, customer_mobile, address, crew_id)")
    .eq("id", quoteId)
    .single();

  if (!quote) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }

  if (quote.status === "declined") {
    return NextResponse.json({ error: "Quote has already been declined" }, { status: 409 });
  }

  const lead = (quote as unknown as { leads: { customer_name: string; customer_mobile: string | null; address: string | null; crew_id: string } | null }).leads;

  const customerName =
    parse.data.customer_name ?? lead?.customer_name ?? "Customer";

  // Insert acceptance record — idempotent (UNIQUE on quote_id)
  const retentionUntil = new Date();
  retentionUntil.setFullYear(retentionUntil.getFullYear() + 7);

  const { data: acceptance, error: acceptError } = await serviceClient
    .from("quote_acceptances")
    .insert({
      quote_id: quoteId,
      ip_address: ip,
      user_agent: req.headers.get("user-agent") ?? "",
      customer_name_snapshot: customerName,
      retention_until: retentionUntil.toISOString().slice(0, 10),
    })
    .select()
    .single();

  if (acceptError) {
    // Check if it's a duplicate (idempotent)
    if (acceptError.code === "23505") {
      // Already accepted — return existing
      const { data: existing } = await serviceClient
        .from("quote_acceptances")
        .select("accepted_at")
        .eq("quote_id", quoteId)
        .single();
      return NextResponse.json({ accepted_at: existing?.accepted_at, already_accepted: true });
    }
    logger.error({ err: acceptError, quoteId }, "quote.accept.error");
    return NextResponse.json({ error: "Failed to record acceptance" }, { status: 500 });
  }

  // Update quote status → "accepted"
  await serviceClient
    .from("quotes")
    .update({ status: "accepted" })
    .eq("id", quoteId);

  // Update lead status → "won"
  await serviceClient
    .from("leads")
    .update({ status: "won" })
    .eq("id", quote.lead_id);

  // Cancel pending followup SMS jobs
  try {
    const queue = getFsmQueue();
    // Note: BullMQ job IDs are deterministic (followup-d3-{leadId}, followup-d7-{leadId})
    // We'll try to remove them — non-fatal if they don't exist
    await Promise.allSettled([
      queue.remove(`followup-d3-${quote.lead_id}`),
      queue.remove(`followup-d7-${quote.lead_id}`),
    ]);
  } catch {
    // Non-fatal
  }

  // Enqueue FSM push job (if FSM connected)
  try {
    const { data: fsmConnection } = await serviceClient
      .from("fsm_connections")
      .select("id, provider")
      .eq("crew_id", quote.crew_id)
      .limit(1)
      .single();

    if (fsmConnection) {
      const queue = getFsmQueue();
      await queue.add(
        "fsm-push",
        {
          quoteId,
          leadId: quote.lead_id,
          crewId: quote.crew_id,
          provider: fsmConnection.provider,
          customerName,
          address: lead?.address ?? "",
          quotedTotalAud: Number(quote.total_aud ?? 0),
        },
        { attempts: 3, backoff: { type: "exponential", delay: 5000 } }
      );
    }
  } catch (fsmErr) {
    logger.warn({ err: fsmErr, quoteId }, "quote.accept.fsm_enqueue_failed");
  }

  // Send push notification to tradie: "Quote accepted!"
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
          await sendPushToUser(subs, {
            title: "Quote Accepted! 🎉",
            body: `${customerName} accepted the quote for ${lead?.address ?? "your property"}`,
            url: `/leads/${quote.lead_id}`,
            tag: `quote-accepted-${quoteId}`,
          });
        }
      }
    }
  } catch (pushErr) {
    logger.warn({ err: pushErr }, "quote.accept.push_failed");
  }

  logger.info({ quoteId, leadId: quote.lead_id, crewId: quote.crew_id }, "quote.accepted");

  return NextResponse.json({ accepted_at: acceptance.accepted_at });
}
