/**
 * POST /api/webhooks/da-lead — DA aggregator webhook ingest (FR-006)
 *
 * Receives DA (Development Application) notifications from the external DA aggregator.
 * Authenticates via HMAC-SHA256 signature (X-DA-Signature header).
 * Deduplicates by (crew_id, da_reference) — silently discards duplicates.
 *
 * Stack contract:
 *   security.rate_limiting=required (1000/min per IP — DDoS guard)
 *   backend.validators=zod
 *
 * NOTE: The crew routing for multi-tenant DA webhook depends on the
 * DA aggregator including a `crew_id` in the payload, or a pre-configured
 * per-crew webhook secret. For V1 we route to the crew matching the HMAC secret.
 * (OI-002 — DA aggregator contract to be confirmed.)
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/db/supabase-server";
import { DaWebhookReqSchema } from "@/lib/schemas/leads";
import { verifyDaWebhookSignature } from "@/lib/services/hmac";
import { rateLimiters } from "@/lib/services/rate-limit";
import { sendPushToUser } from "@/lib/push/web-push";
import { logger } from "@/lib/logger";

export const runtime = "nodejs"; // Need crypto module

export async function POST(req: NextRequest) {
  // Rate limit by IP — DDoS guard
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { success: rlOk } = await rateLimiters.daWebhook.limit(ip);
  if (!rlOk) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  // Read raw body for HMAC verification
  const rawBody = await req.text();
  const signature = req.headers.get("x-da-signature") ?? "";
  const secret = process.env.DA_WEBHOOK_HMAC_SECRET ?? "";

  // Verify HMAC signature
  if (!verifyDaWebhookSignature(secret, rawBody, signature)) {
    logger.warn({ ip }, "da_webhook.invalid_signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // Parse and validate payload
  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    logger.warn({ ip }, "da_webhook.invalid_json");
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const parse = DaWebhookReqSchema.safeParse(body);
  if (!parse.success) {
    logger.warn({ errors: parse.error.flatten() }, "da_webhook.validation_failed");
    return NextResponse.json(
      { error: "Invalid payload", details: parse.error.flatten() },
      { status: 400 }
    );
  }

  const { da_reference, address, description, council, received_at, customer_name, customer_mobile } = parse.data;

  const serviceClient = createServiceClient();

  // Determine crew routing
  // V1: The DA aggregator is configured per-crew; the HMAC secret is crew-specific.
  // We identify the crew by looking up which crew has this HMAC secret configured.
  // For V1 simplicity: use a single DA_CREW_ID env var (OI-002 resolution point).
  const crewId = process.env.DA_CREW_ID;
  if (!crewId) {
    logger.error({ da_reference }, "da_webhook.no_crew_id_configured");
    // Accept the webhook (return 200) so the aggregator doesn't retry indefinitely
    return NextResponse.json({ accepted: true, note: "No crew configured for DA webhook" });
  }

  // Deduplication: check if lead already exists for this (crew_id, da_reference)
  const { data: existing } = await serviceClient
    .from("leads")
    .select("id")
    .eq("crew_id", crewId)
    .eq("da_reference", da_reference)
    .single();

  if (existing) {
    logger.info({ da_reference, leadId: existing.id }, "da_webhook.duplicate_discarded");
    return NextResponse.json({ accepted: true, duplicate: true });
  }

  // Create lead
  const { data: lead, error } = await serviceClient
    .from("leads")
    .insert({
      crew_id: crewId,
      source: "da",
      da_reference,
      address,
      description: description
        ? description.slice(0, 280)
        : council
        ? `DA from ${council}`
        : null,
      customer_name: customer_name ?? "DA Lead",
      customer_mobile: customer_mobile ?? null,
    })
    .select("id")
    .single();

  if (error || !lead) {
    logger.error({ err: error, da_reference }, "da_webhook.lead_create_error");
    return NextResponse.json({ error: "Failed to create lead" }, { status: 500 });
  }

  logger.info({ leadId: lead.id, da_reference, crewId }, "da_webhook.lead_created");

  // Push notification to all crew users
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
          await sendPushToUser(subs, {
            title: "New DA Lead",
            body: `New development application: ${address}`,
            url: `/leads/${lead.id}`,
            tag: `da-lead-${lead.id}`,
          });
        }
      }
    }
  } catch (pushErr) {
    logger.warn({ err: pushErr, leadId: lead.id }, "da_webhook.push_failed");
  }

  return NextResponse.json({ accepted: true, lead_id: lead.id });
}
