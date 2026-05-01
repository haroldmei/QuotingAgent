/**
 * fsm-push BullMQ job handler
 * FR-027 (ServiceM8), FR-028 (Tradify)
 * Called after quote acceptance to create a job in the crew's FSM.
 */

import pino from "pino";
import { createServiceClient } from "@/lib/db/supabase-server";
import {
  decryptOAuthToken,
  createServiceM8Job,
  createTradifyJob,
  type FsmJobPayload,
} from "@/lib/services/fsm";

export interface FsmPushJobData {
  quoteId: string;
  leadId: string;
  crewId: string;
  provider: "servicem8" | "tradify";
  customerName: string;
  address: string;
  quotedTotalAud: number;
}

export async function fsmPushJob(
  data: FsmPushJobData,
  logger: pino.Logger
): Promise<void> {
  const { quoteId, leadId, crewId, provider } = data;
  const serviceClient = createServiceClient();

  // Get FSM connection
  const { data: connection } = await serviceClient
    .from("fsm_connections")
    .select("encrypted_oauth_token, expires_at")
    .eq("crew_id", crewId)
    .eq("provider", provider)
    .single();

  if (!connection) {
    logger.warn({ quoteId, provider }, "fsm_push.no_connection");
    return;
  }

  // Check token expiry
  if (connection.expires_at && new Date(connection.expires_at) < new Date()) {
    logger.warn({ quoteId, provider }, "fsm_push.token_expired");
    return;
  }

  // Decrypt token
  let accessToken: string;
  try {
    const tokenData = JSON.parse(decryptOAuthToken(connection.encrypted_oauth_token));
    accessToken = tokenData.accessToken;
  } catch (err) {
    logger.error({ err: err instanceof Error ? err.message : String(err), provider }, "fsm_push.decrypt_failed");
    throw err;
  }

  // Get quote line items
  const { data: lineItems } = await serviceClient
    .from("quote_line_items")
    .select("description, qty, unit, unit_price_aud, kind")
    .eq("quote_id", quoteId);

  const { data: crew } = await serviceClient
    .from("crews")
    .select("nsw_licence_number")
    .eq("id", crewId)
    .single();

  const lineItemNotes = lineItems && lineItems.length > 0
    ? lineItems
        .map(
          (li) =>
            `${li.description}: ${li.qty} ${li.unit} @ A$${Number(li.unit_price_aud).toFixed(2)}`
        )
        .join("\n")
    : "Line items unavailable";

  const payload: FsmJobPayload = {
    customerName: data.customerName,
    customerMobile: null,
    address: data.address,
    lineItemsNotes: lineItemNotes,
    quotedTotalAud: data.quotedTotalAud,
    licenceNumber: crew?.nsw_licence_number ?? "",
    quoteRef: `Q-${quoteId.slice(0, 8).toUpperCase()}`,
  };

  // Create job in FSM
  if (provider === "servicem8") {
    await createServiceM8Job(accessToken, payload);
  } else {
    await createTradifyJob(accessToken, payload);
  }

  logger.info({ quoteId, leadId, provider }, "fsm_push.job_created");
}
