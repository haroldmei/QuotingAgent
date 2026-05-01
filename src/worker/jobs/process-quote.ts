/**
 * process-quote BullMQ job handler
 * Stack contract: ai.provider=anthropic, ai.models.vision_quoting=claude-opus-4-7,
 *                 ai.latency_budget_seconds=20, queue.engine=bullmq
 * FR-011: AI vision → extraction → persist quote rows, push notification
 * FR-012: cost guard + model selection
 * FR-030: rate-card learning from crew's historical jobs
 *
 * Flow:
 *   1. Load photos + crew data from DB
 *   2. Generate signed read URLs for GCS photos
 *   3. Check for ≥5 completed jobs → build margin summary
 *   4. Call generateQuote() (vision + extraction passes)
 *   5. Persist quote_line_items + quote_ai_usage
 *   6. Update quote + lead status
 *   7. Send push notification to tradie
 */

import pino from "pino";
import { createServiceClient } from "@/lib/db/supabase-server";
import { generateQuote } from "@/lib/ai/quote-generator";
import { computeQuoteTotals } from "@/lib/services/quote-calc";
import { generateSignedGetUrl } from "@/lib/gcs/client";
import { sendPushToUser } from "@/lib/push/web-push";

export interface ProcessQuoteJobData {
  quoteId: string;
  leadId: string;
  crewId: string;
  userId: string | null;
  contextNote: string | null;
  tradeType: string;
  defaultLabourRateAud: number;
  hasLearnedRateCard: boolean;
  photoCount: number;
}

export async function processQuoteJob(
  data: ProcessQuoteJobData,
  logger: pino.Logger
): Promise<void> {
  const { quoteId, leadId, crewId, userId, contextNote, tradeType, defaultLabourRateAud } = data;
  const serviceClient = createServiceClient();

  // 1. Load photos
  const { data: photos } = await serviceClient
    .from("photos")
    .select("id, gcs_path")
    .eq("lead_id", leadId);

  if (!photos || photos.length === 0) {
    throw new Error(`No photos found for lead ${leadId}`);
  }

  // 2. Generate signed GCS read URLs (15-minute expiry for the AI call)
  const photoUrls = await Promise.all(
    photos.map((p: { id: string; gcs_path: string }) =>
      generateSignedGetUrl(p.gcs_path, 15 * 60)
    )
  );

  // 3. Build margin summary from completed jobs (FR-030)
  let marginSummary: string | null = null;
  if (data.hasLearnedRateCard) {
    const { data: completions } = await serviceClient
      .from("job_completions")
      .select("quoted_amount_aud, invoiced_amount_aud, trade_type, completed_at")
      .eq("crew_id", crewId)
      .not("invoiced_amount_aud", "is", null)
      .order("completed_at", { ascending: false })
      .limit(20);

    if (completions && completions.length >= 5) {
      const deltas = completions
        .filter((c: { quoted_amount_aud: string; invoiced_amount_aud: string | null }) => c.invoiced_amount_aud)
        .map((c: { quoted_amount_aud: string; invoiced_amount_aud: string | null }) => {
          const quoted = Number(c.quoted_amount_aud);
          const invoiced = Number(c.invoiced_amount_aud);
          return quoted > 0 ? (invoiced - quoted) / quoted : 0;
        });

      const avgDelta = deltas.reduce((a: number, b: number) => a + b, 0) / deltas.length;
      const direction = avgDelta > 0 ? "over" : "under";
      const pct = Math.abs(avgDelta * 100).toFixed(1);

      marginSummary = `This tradie's last ${completions.length} jobs: invoiced an average of ${pct}% ${direction} the quoted amount. Adjust labour rates accordingly.`;
      logger.info({ crewId, avgDelta }, "worker.margin_summary.built");
    }
  }

  // 4. Generate quote via AI
  const result = await generateQuote({
    quoteId,
    crewId,
    userId,
    tradeType: tradeType as "roofer" | "painter" | "electrician" | "plumber" | "landscaper",
    contextNote,
    photoUrls,
    defaultLabourRateAud,
    marginSummary,
  });

  // 5. Persist line items
  const lineItemInserts = result.quote.lines.map((line, index) => ({
    quote_id: quoteId,
    description: line.description,
    qty: line.qty.toString(),
    unit: line.unit,
    unit_price_aud: line.unit_price_aud.toString(),
    confidence_score: line.confidence_score,
    kind: line.kind,
    sort_order: index,
  }));

  if (lineItemInserts.length > 0) {
    await serviceClient.from("quote_line_items").insert(lineItemInserts);
  }

  // 6. Compute totals
  const { subtotalAud, gstAud, totalAud } = computeQuoteTotals(
    result.quote.lines.map((l) => ({ qty: l.qty, unit_price_aud: l.unit_price_aud }))
  );

  // 7. Update quote with totals, AI usage, rate card source
  const costOverrun = result.totalCostAud > 0.3;

  await serviceClient
    .from("quotes")
    .update({
      status: "draft",
      subtotal_aud: subtotalAud.toString(),
      gst_aud: gstAud.toString(),
      total_aud: totalAud.toString(),
      rate_card_source: result.rateCardSource,
    })
    .eq("id", quoteId);

  // Persist quote_ai_usage
  await serviceClient.from("quote_ai_usage").upsert(
    {
      quote_id: quoteId,
      model_vision: result.modelVision,
      model_extraction: result.modelExtraction,
      input_tokens: Math.round(result.totalCostAud / 0.000015), // approximation
      output_tokens: 0,
      cost_aud: result.totalCostAud.toString(),
      cost_overrun: costOverrun,
    },
    { onConflict: "quote_id" }
  );

  // 8. Update lead status → "draft_ready"
  await serviceClient
    .from("leads")
    .update({ status: "draft_ready" })
    .eq("id", leadId);

  logger.info(
    {
      quoteId,
      leadId,
      crewId,
      lineItemCount: result.quote.lines.length,
      totalAud,
      costAud: result.totalCostAud,
      rateCardSource: result.rateCardSource,
      requiresReview: result.quote.requires_review,
    },
    "worker.process-quote.persisted"
  );

  // 9. Send push notification to tradie
  try {
    const { data: crewUsers } = await serviceClient
      .from("users")
      .select("id")
      .eq("crew_id", crewId);

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

          const hasLowConfidence = result.confidence.requiresReview;
          const notification = hasLowConfidence
            ? {
                title: "Quote Draft Ready — Review Required",
                body: `${result.quote.lines.length} line items — some need review`,
                url: `/leads/${leadId}`,
                tag: `quote-draft-${quoteId}`,
              }
            : {
                title: "Quote Draft Ready",
                body: `${result.quote.lines.length} line items • A$${totalAud.toFixed(2)}`,
                url: `/leads/${leadId}`,
                tag: `quote-draft-${quoteId}`,
              };

          await sendPushToUser(subs, notification);
        }
      }
    }
  } catch (pushErr) {
    // Non-fatal
    logger.warn({ err: pushErr instanceof Error ? pushErr.message : String(pushErr) }, "worker.process-quote.push_failed");
  }
}
