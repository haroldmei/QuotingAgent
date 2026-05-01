/**
 * POST /api/quotes/[id]/send — generate PDF + send SMS via Twilio (FR-016, FR-017)
 *
 * Flow:
 *   1. Verify crew licence_verified (NFR-019)
 *   2. Snapshot licence_number + statutory_warranty_text into quote
 *   3. Update quote status → "approved"
 *   4. Generate PDF + store in GCS + mint signed URL
 *   5. Build SMS body + mint quote view signed token
 *   6. Send SMS via Twilio AU long-code
 *   7. Insert sms_event {sent}
 *   8. Update lead status → "sent"
 *   9. Schedule D+3 / D+7 followup SMS (BullMQ delayed jobs)
 *   10. Return { status, sms_event_id, pdf_signed_url }
 *
 * On Twilio failure: email fallback via Resend (FR-019)
 *
 * Stack contract:
 *   sms.provider=twilio, sms.au_long_code=required
 *   cloud.blob_storage=gcs (PDF storage)
 *   security.nsw_licence_binding=required
 *   security.rate_limiting=required (100/day per crew)
 */

import { NextRequest, NextResponse } from "next/server";
import { Queue } from "bullmq";
import { resolveAuth, isAuthError } from "@/lib/auth/guard";
import { createServerClient, createServiceClient } from "@/lib/db/supabase-server";
import { SendReqSchema } from "@/lib/schemas/quotes";
import { generateAndStorePdf, NSW_STATUTORY_WARRANTY_TEXT } from "@/lib/services/pdf";
import { sendSms, buildQuoteSmsBody } from "@/lib/sms/twilio";
import { sendQuoteEmail } from "@/lib/sms/resend";
import { mintQuoteToken, buildQuoteViewUrl } from "@/lib/services/hmac";
import { rateLimiters } from "@/lib/services/rate-limit";
import { sendPushToUser } from "@/lib/push/web-push";
import { logger } from "@/lib/logger";

type Params = { params: Promise<{ id: string }> };

let _followupQueue: Queue | null = null;

function getFollowupQueue(): Queue {
  if (_followupQueue) return _followupQueue;
  _followupQueue = new Queue("followup-sms", {
    connection: {
      host: new URL(process.env.UPSTASH_REDIS_REST_URL ?? "redis://localhost:6379").hostname,
      port: 6379,
      password: process.env.UPSTASH_REDIS_REST_TOKEN,
      tls: process.env.UPSTASH_REDIS_REST_URL?.startsWith("https") ? {} : undefined,
    },
  });
  return _followupQueue;
}

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await resolveAuth(req);
  if (isAuthError(auth)) return auth.error;
  const { crewId } = auth.ctx;
  const { id: quoteId } = await params;

  // Rate limit: 100/day per crew
  const { success } = await rateLimiters.quoteSend.limit(crewId);
  if (!success) {
    return NextResponse.json({ error: "Daily send limit reached (100/day)" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json().catch(() => ({}));
  } catch {
    body = {};
  }

  const parse = SendReqSchema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parse.error.flatten() },
      { status: 422 }
    );
  }

  const supabase = await createServerClient();
  const serviceClient = createServiceClient();

  // Load quote + lead + crew
  const { data: quote } = await supabase
    .from("quotes")
    .select("*, quote_line_items(*), leads(id, customer_name, customer_mobile, customer_email, address, sms_disabled_followup, crew_id)")
    .eq("id", quoteId)
    .eq("crew_id", crewId)
    .single();

  if (!quote) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }

  if (!["draft", "approved"].includes(quote.status)) {
    return NextResponse.json(
      { error: `Quote is already in '${quote.status}' status` },
      { status: 409 }
    );
  }

  const lead = (quote as unknown as { leads: { id: string; customer_name: string; customer_mobile: string | null; customer_email: string | null; address: string | null; sms_disabled_followup: boolean; crew_id: string } | null }).leads;

  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  // Load crew for licence + business info
  const { data: crew } = await supabase
    .from("crews")
    .select("business_name, nsw_licence_number, licence_verified, abn, trade_type")
    .eq("id", crewId)
    .single();

  if (!crew) {
    return NextResponse.json({ error: "Crew not found" }, { status: 404 });
  }

  // Block send if licence not verified (NFR-019, FR-024)
  if (!crew.licence_verified) {
    return NextResponse.json(
      { error: "NSW contractor licence must be verified before sending quotes" },
      { status: 403 }
    );
  }

  // Snapshot licence + warranty into quote
  const licenceSnapshot = crew.nsw_licence_number;
  const warrantyText = NSW_STATUTORY_WARRANTY_TEXT;

  await supabase
    .from("quotes")
    .update({
      status: "approved",
      licence_number_snapshot: licenceSnapshot,
      licence_verified_snapshot: true,
      statutory_warranty_text: warrantyText,
    })
    .eq("id", quoteId);

  // Build PDF data
  const quoteRef = `Q-${quoteId.slice(0, 8).toUpperCase()}`;
  const lineItems = ((quote as unknown as { quote_line_items: Array<{ description: string; qty: string; unit: string; unit_price_aud: string; kind: string }> }).quote_line_items ?? []).map((item) => ({
    description: item.description,
    qty: Number(item.qty),
    unit: item.unit,
    unit_price_aud: Number(item.unit_price_aud),
    kind: item.kind,
  }));

  const subtotalAud = Number(quote.subtotal_aud ?? 0);
  const gstAud = Number(quote.gst_aud ?? 0);
  const totalAud = Number(quote.total_aud ?? 0);

  // Generate PDF
  let gcsPath: string;
  let pdfSignedUrl: string;
  let pdfExpiresAt: string;

  try {
    const pdfResult = await generateAndStorePdf({
      quoteId,
      quoteRef,
      quoteDate: new Date().toISOString().slice(0, 10),
      businessName: crew.business_name,
      abn: crew.abn,
      nswLicenceNumber: licenceSnapshot,
      customerName: lead.customer_name,
      address: lead.address ?? "",
      lineItems,
      subtotalAud,
      gstAud,
      totalAud,
      statutoryWarrantyText: warrantyText,
    });
    gcsPath = pdfResult.gcsPath;
    pdfSignedUrl = pdfResult.signedUrl;
    pdfExpiresAt = pdfResult.expiresAt;
  } catch (pdfErr) {
    logger.error({ err: pdfErr, quoteId }, "pdf.generation.error");
    return NextResponse.json({ error: "Failed to generate PDF" }, { status: 500 });
  }

  // Update quote with PDF info
  await supabase
    .from("quotes")
    .update({
      pdf_gcs_path: gcsPath,
      pdf_signed_url: pdfSignedUrl,
      pdf_signed_url_expires_at: pdfExpiresAt,
      status: "sent",
      sent_at: new Date().toISOString(),
    })
    .eq("id", quoteId);

  // Mint signed quote view token (FR-020)
  const signingSecret = process.env.QUOTE_SIGNING_HMAC_SECRET;
  if (!signingSecret) {
    logger.error({ quoteId }, "QUOTE_SIGNING_HMAC_SECRET not configured");
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const { token: signedToken } = mintQuoteToken(quoteId, signingSecret);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.quotingagent.com.au";
  const quoteViewUrl = buildQuoteViewUrl(baseUrl, signedToken);

  // Build SMS body
  const smsBody =
    parse.data.sms_body ||
    buildQuoteSmsBody(
      crew.business_name,
      lead.customer_name,
      lead.address ?? "your property",
      quoteViewUrl
    );

  let smsEventId: string | null = null;
  let sentByEmail = false;

  // Send SMS or email fallback
  const hasMobile = !!lead.customer_mobile;

  if (hasMobile) {
    try {
      const callbackUrl = `${baseUrl}/api/webhooks/twilio/delivery`;
      const smsResult = await sendSms(lead.customer_mobile!, smsBody, callbackUrl);

      // Record sms_event {sent}
      const { data: smsEvent } = await serviceClient
        .from("sms_events")
        .insert({
          quote_id: quoteId,
          twilio_message_sid: smsResult.messageSid,
          event_type: "sent",
        })
        .select("id")
        .single();

      smsEventId = smsEvent?.id ?? null;

      logger.info({ quoteId, messageSid: smsResult.messageSid }, "quote.sms.sent");
    } catch (smsErr) {
      logger.warn({ err: smsErr, quoteId }, "quote.sms.failed — attempting email fallback");
      // SMS failed → email fallback (FR-019)
      if (lead.customer_email) {
        try {
          await sendQuoteEmail(lead.customer_email, {
            customerName: lead.customer_name,
            tradeName: crew.business_name,
            address: lead.address ?? "your property",
            quoteLink: quoteViewUrl,
            totalAud: `A$${totalAud.toFixed(2)}`,
          });
          sentByEmail = true;
        } catch (emailErr) {
          logger.error({ err: emailErr, quoteId }, "quote.email_fallback.failed");
        }
      }
    }
  } else if (lead.customer_email) {
    // No mobile — send by email directly
    try {
      await sendQuoteEmail(lead.customer_email, {
        customerName: lead.customer_name,
        tradeName: crew.business_name,
        address: lead.address ?? "your property",
        quoteLink: quoteViewUrl,
        totalAud: `A$${totalAud.toFixed(2)}`,
      });
      sentByEmail = true;
    } catch (emailErr) {
      logger.error({ err: emailErr, quoteId }, "quote.email.failed");
    }
  }

  // Update lead status → "sent" (or "sent_by_email" variant)
  await supabase
    .from("leads")
    .update({ status: "sent" })
    .eq("id", lead.id);

  // Schedule D+3 / D+7 followup SMS unless disabled
  if (!lead.sms_disabled_followup && hasMobile) {
    try {
      const queue = getFollowupQueue();
      const d3Delay = 3 * 24 * 60 * 60 * 1000;
      const d7Delay = 7 * 24 * 60 * 60 * 1000;

      await Promise.all([
        queue.add(
          "followup-sms",
          { leadId: lead.id, quoteId, stage: "d3", crewId, customerMobile: lead.customer_mobile, customerName: lead.customer_name, address: lead.address, tradeName: crew.business_name, quoteViewUrl },
          { delay: d3Delay, jobId: `followup-d3-${lead.id}`, removeOnComplete: 50 }
        ),
        queue.add(
          "followup-sms",
          { leadId: lead.id, quoteId, stage: "d7", crewId, customerMobile: lead.customer_mobile, customerName: lead.customer_name, address: lead.address, tradeName: crew.business_name, quoteViewUrl },
          { delay: d7Delay, jobId: `followup-d7-${lead.id}`, removeOnComplete: 50 }
        ),
      ]);

      // Record followup_schedules in DB
      await serviceClient.from("followup_schedules").insert([
        { lead_id: lead.id, stage: "d3", fire_at: new Date(Date.now() + d3Delay).toISOString() },
        { lead_id: lead.id, stage: "d7", fire_at: new Date(Date.now() + d7Delay).toISOString() },
      ]);

      logger.info({ leadId: lead.id }, "quote.followup.scheduled");
    } catch (followupErr) {
      // Non-fatal — log and continue
      logger.warn({ err: followupErr, leadId: lead.id }, "quote.followup.schedule_failed");
    }
  }

  // Send push notification to tradie: "Quote sent"
  try {
    const { data: pushSubs } = await serviceClient
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth_key")
      .eq("user_id", auth.ctx.userId);

    if (pushSubs && pushSubs.length > 0) {
      const subs = pushSubs.map((s: { endpoint: string; p256dh: string; auth_key: string }) => ({
        endpoint: s.endpoint,
        keys: { p256dh: s.p256dh, auth: s.auth_key },
      }));
      await sendPushToUser(subs, {
        title: "Quote Sent",
        body: `Quote sent to ${lead.customer_name} for ${lead.address ?? "your property"}`,
        url: `/leads/${lead.id}`,
        tag: `quote-sent-${quoteId}`,
      });
    }
  } catch (pushErr) {
    logger.warn({ err: pushErr }, "quote.send.push_failed");
  }

  return NextResponse.json({
    status: sentByEmail ? "sent_by_email" : "sent",
    sms_event_id: smsEventId,
    pdf_signed_url: pdfSignedUrl,
    quote_view_url: quoteViewUrl,
    sent_by_email: sentByEmail,
  });
}
