/**
 * GET /api/webhooks/twilio/read — read-receipt tracking pixel (FR-018)
 *
 * Called when the customer opens the SMS link and the quote view page loads.
 * Returns a 1×1 GIF (tracking pixel equivalent).
 * Records sms_event {opened} and updates lead status → "opened".
 *
 * The actual read tracking is primarily done in /api/quotes/[id]/view
 * (via the signed token). This endpoint handles the Twilio /q/{token}/r.gif path.
 *
 * Stack contract: sms.read_receipt=webhook
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/db/supabase-server";
import { logger } from "@/lib/logger";

// Minimal 1×1 transparent GIF
const TRACKING_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

export async function GET(req: NextRequest) {
  // Extract quote_id from query param (set by the quote view page)
  const quoteId = req.nextUrl.searchParams.get("q");

  if (quoteId) {
    const serviceClient = createServiceClient();

    // Non-blocking fire-and-forget
    Promise.resolve().then(async () => {
      try {
        const { data: quote } = await serviceClient
          .from("quotes")
          .select("lead_id, status")
          .eq("id", quoteId)
          .single();

        if (quote && ["sent", "delivered"].includes(quote.status)) {
          await Promise.all([
            serviceClient.from("sms_events").insert({
              quote_id: quoteId,
              event_type: "opened",
            }),
            serviceClient
              .from("leads")
              .update({ status: "opened" })
              .eq("id", quote.lead_id),
          ]);
          logger.info({ quoteId, leadId: quote.lead_id }, "tracking_pixel.read_event_recorded");
        }
      } catch (err) {
        logger.warn({ err, quoteId }, "tracking_pixel.read_event_failed");
      }
    });
  }

  // Return 1×1 transparent GIF
  return new NextResponse(TRACKING_GIF, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "Pragma": "no-cache",
    },
  });
}
