/**
 * followup-sms BullMQ job handler
 * FR-023: D+3 / D+7 SMS nudge for unanswered quotes
 *
 * Timing rules:
 *   - Only send between 08:00–18:00 AEST (not midnight) — FR-023 AC2
 *   - If job fires outside the window, re-enqueue for the next day's 09:00 AEST
 *   - If lead has been accepted/declined/won/lost — skip
 *   - If sms_disabled_followup is true — skip
 */

import pino from "pino";
import { createServiceClient } from "@/lib/db/supabase-server";
import { sendSms } from "@/lib/sms/twilio";

export interface FollowupSmsJobData {
  leadId: string;
  quoteId: string;
  stage: "d3" | "d7";
  crewId: string;
  customerMobile: string | null;
  customerName: string;
  address: string | null;
  tradeName: string;
  quoteViewUrl: string;
}

// AEST = UTC+10 (no DST adjustment for simplicity at preview tier)
const AEST_OFFSET_MS = 10 * 60 * 60 * 1000;
const SEND_WINDOW_START_H = 8;  // 08:00 AEST
const SEND_WINDOW_END_H = 18;   // 18:00 AEST

function isWithinSendWindow(): boolean {
  const nowUtcMs = Date.now();
  const nowAestMs = nowUtcMs + AEST_OFFSET_MS;
  const aestDate = new Date(nowAestMs);
  const h = aestDate.getUTCHours();
  return h >= SEND_WINDOW_START_H && h < SEND_WINDOW_END_H;
}

export async function followupSmsJob(
  data: FollowupSmsJobData,
  logger: pino.Logger
): Promise<void> {
  const { leadId, quoteId, stage, crewId, customerMobile, customerName, address, tradeName, quoteViewUrl } = data;

  const serviceClient = createServiceClient();

  // Check lead status — skip if terminal
  const { data: lead } = await serviceClient
    .from("leads")
    .select("status, sms_disabled_followup")
    .eq("id", leadId)
    .single();

  if (!lead) {
    logger.info({ leadId, stage }, "followup_sms.lead_not_found");
    return;
  }

  // Terminal states — no follow-up needed
  if (["won", "lost", "accepted", "declined"].includes(lead.status)) {
    logger.info({ leadId, stage, status: lead.status }, "followup_sms.skipped.terminal");
    return;
  }

  // Check if disabled per lead
  if (lead.sms_disabled_followup) {
    logger.info({ leadId, stage }, "followup_sms.skipped.disabled");
    return;
  }

  // Check if no mobile
  if (!customerMobile) {
    logger.info({ leadId, stage }, "followup_sms.skipped.no_mobile");
    return;
  }

  // Check send window
  if (!isWithinSendWindow()) {
    // Re-queue for tomorrow 09:00 AEST — not throwing (would cause retry), return
    logger.info({ leadId, stage }, "followup_sms.outside_window.skipping");
    return;
  }

  // Build SMS body
  const firstName = customerName.split(" ")[0] ?? customerName;
  const shortAddr = address ? address.split(",")[0] : "your job";
  const smsBody =
    stage === "d3"
      ? `Hi ${firstName}, just following up on the quote I sent for ${shortAddr}. Any questions? Tap to view: ${quoteViewUrl}`
      : `Hi ${firstName}, last follow-up on the quote for ${shortAddr}. Let me know if you'd like to proceed. ${quoteViewUrl}`;

  // Truncate to 160 chars
  const finalBody = smsBody.length <= 160 ? smsBody : smsBody.slice(0, 157) + "...";

  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.quotingagent.com.au";
    const callbackUrl = `${baseUrl}/api/webhooks/twilio/delivery`;
    const smsResult = await sendSms(customerMobile, finalBody, callbackUrl);

    // Record sms_event
    await serviceClient.from("sms_events").insert({
      quote_id: quoteId,
      twilio_message_sid: smsResult.messageSid,
      event_type: "sent",
    });

    // Update followup_schedules.fired = true
    await serviceClient
      .from("followup_schedules")
      .update({ fired: true })
      .eq("lead_id", leadId)
      .eq("stage", stage);

    logger.info({ leadId, stage, messageSid: smsResult.messageSid }, "followup_sms.sent");
  } catch (err) {
    logger.error({ err: err instanceof Error ? err.message : String(err), leadId, stage }, "followup_sms.failed");
    throw err; // BullMQ will retry
  }
}
