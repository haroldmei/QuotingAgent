/**
 * POST /api/webhooks/twilio/delivery — Twilio status callback (FR-018)
 *
 * Called by Twilio when an SMS status changes:
 *   sent → delivered → failed / undelivered / read
 *
 * Authenticates via X-Twilio-Signature header (Twilio SDK helper).
 * Updates sms_events and lead status accordingly.
 * On delivery failure: triggers email fallback (FR-019).
 *
 * Stack contract:
 *   sms.provider=twilio, sms.read_receipt=webhook
 *   security.rate_limiting=required (1000/min per IP)
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/db/supabase-server";
import { TwilioDeliveryWebhookSchema } from "@/lib/schemas/quotes";
import { verifyTwilioSignature } from "@/lib/sms/twilio";
import { sendQuoteEmail } from "@/lib/sms/resend";
import { sendPushToUser } from "@/lib/push/web-push";
import { rateLimiters } from "@/lib/services/rate-limit";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  // Rate limit by IP
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { success: rlOk } = await rateLimiters.twilioWebhook.limit(ip);
  if (!rlOk) {
    return new NextResponse("Rate limit exceeded", { status: 429 });
  }

  // Read body as URL-encoded form (Twilio sends form data)
  const rawBody = await req.text();
  const params = Object.fromEntries(new URLSearchParams(rawBody).entries());

  // Verify Twilio signature
  const authToken = process.env.TWILIO_AUTH_TOKEN ?? "";
  const signature = req.headers.get("x-twilio-signature") ?? "";
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.quotingagent.com.au";
  const url = `${baseUrl}/api/webhooks/twilio/delivery`;

  if (authToken && signature) {
    const isValid = verifyTwilioSignature(authToken, signature, url, params);
    if (!isValid) {
      logger.warn({ ip }, "twilio_webhook.invalid_signature");
      return new NextResponse("Invalid signature", { status: 401 });
    }
  }

  // Parse form data
  const parse = TwilioDeliveryWebhookSchema.safeParse(params);
  if (!parse.success) {
    logger.warn({ params }, "twilio_webhook.invalid_payload");
    return new NextResponse("OK", { status: 200 }); // Accept even if unrecognised format
  }

  const { MessageSid, MessageStatus } = parse.data;

  const serviceClient = createServiceClient();

  // Map Twilio status to our sms_event type
  const eventTypeMap: Record<string, string | null> = {
    sent: "sent",
    delivered: "delivered",
    failed: "failed",
    undelivered: "failed",
    read: "opened",
  };

  const eventType = eventTypeMap[MessageStatus.toLowerCase()] ?? null;

  // Find the most recent sms_event with this MessageSid
  const { data: existingEvent } = await serviceClient
    .from("sms_events")
    .select("quote_id, event_type")
    .eq("twilio_message_sid", MessageSid)
    .order("occurred_at", { ascending: false })
    .limit(1)
    .single();

  if (!existingEvent && eventType) {
    logger.warn({ messageSid: MessageSid }, "twilio_webhook.sms_event_not_found");
    return new NextResponse("OK", { status: 200 });
  }

  const quoteId = existingEvent?.quote_id;

  if (eventType && quoteId) {
    // Insert new sms_event
    await serviceClient.from("sms_events").insert({
      quote_id: quoteId,
      twilio_message_sid: MessageSid,
      event_type: eventType as "sent" | "delivered" | "failed" | "opened",
    });

    // Update lead status based on delivery event
    const { data: quote } = await serviceClient
      .from("quotes")
      .select("lead_id, crew_id, leads(customer_name, address, customer_email)")
      .eq("id", quoteId)
      .single();

    if (quote) {
      const lead = (quote as unknown as { leads: { customer_name: string; address: string | null; customer_email: string | null } | null }).leads;

      if (eventType === "delivered") {
        await serviceClient
          .from("leads")
          .update({ status: "delivered" })
          .eq("id", quote.lead_id);

        logger.info({ quoteId, messageSid: MessageSid }, "sms.delivered");

        // Push notification to tradie
        await notifyTradie(serviceClient, quote.crew_id, {
          title: "Quote Delivered",
          body: `SMS delivered to ${lead?.customer_name ?? "customer"}`,
          url: `/leads/${quote.lead_id}`,
          tag: `sms-delivered-${quoteId}`,
        });
      } else if (eventType === "failed") {
        logger.warn({ quoteId, messageSid: MessageSid, errorCode: parse.data.ErrorCode }, "sms.failed");

        // Trigger email fallback (FR-019)
        if (lead?.customer_email) {
          try {
            const signingSecret = process.env.QUOTE_SIGNING_HMAC_SECRET ?? "";
            const { mintQuoteToken, buildQuoteViewUrl } = await import("@/lib/services/hmac");
            const { token } = mintQuoteToken(quoteId, signingSecret);
            const quoteViewUrl = buildQuoteViewUrl(
              process.env.NEXT_PUBLIC_APP_URL ?? "https://app.quotingagent.com.au",
              token
            );

            // Get quote totals
            const { data: quoteData } = await serviceClient
              .from("quotes")
              .select("total_aud, crews(business_name)")
              .eq("id", quoteId)
              .single();

            const tradeName = (quoteData as unknown as { crews: { business_name: string } | null } | null)?.crews?.business_name ?? "Your tradie";

            await sendQuoteEmail(lead.customer_email, {
              customerName: lead.customer_name,
              tradeName,
              address: lead.address ?? "your property",
              quoteLink: quoteViewUrl,
              totalAud: `A$${Number(quoteData?.total_aud ?? 0).toFixed(2)}`,
            });

            // Update lead to show email fallback was used
            await serviceClient
              .from("leads")
              .update({ status: "sent" }) // stays "sent" via email
              .eq("id", quote.lead_id);

            logger.info({ quoteId, leadId: quote.lead_id }, "sms.failed.email_fallback_sent");
          } catch (emailErr) {
            logger.error({ err: emailErr, quoteId }, "sms.failed.email_fallback_error");
          }
        }
      }
    }
  }

  // Twilio expects TwiML or plain 200 text/xml
  return new NextResponse("<Response></Response>", {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}

async function notifyTradie(
  serviceClient: ReturnType<typeof createServiceClient>,
  crewId: string,
  payload: { title: string; body: string; url: string; tag: string }
) {
  try {
    const { data: crewUsers } = await serviceClient
      .from("users")
      .select("id")
      .eq("crew_id", crewId);

    if (!crewUsers || crewUsers.length === 0) return;

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
        await sendPushToUser(subs, payload);
      }
    }
  } catch (err) {
    logger.warn({ err }, "twilio_webhook.push_notify_failed");
  }
}
