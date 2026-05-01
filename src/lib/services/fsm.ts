/**
 * FSM (Field Service Management) connector
 * Stack contract: external_integrations.fsm.servicem8=webhook-and-rest
 *                 external_integrations.fsm.tradify=webhook-and-rest
 * FR-027 (ServiceM8), FR-028 (Tradify)
 *
 * OAuth tokens are encrypted at rest using AES-256-GCM with a key in GCP Secret Manager.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { logger } from "@/lib/logger";

export type FsmProvider = "servicem8" | "tradify";

// ---------------------------------------------------------------------------
// Token encryption / decryption (AES-256-GCM)
// ---------------------------------------------------------------------------

function getEncryptionKey(): Buffer {
  const key = process.env.FSM_TOKEN_ENCRYPTION_KEY ?? "";
  if (!key || key.length !== 64) {
    throw new Error("FSM_TOKEN_ENCRYPTION_KEY must be a 32-byte hex string (64 hex chars)");
  }
  return Buffer.from(key, "hex");
}

export function encryptOAuthToken(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(12); // 96-bit nonce for GCM
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Format: iv_hex:authTag_hex:ciphertext_hex
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptOAuthToken(ciphertext: string): string {
  const key = getEncryptionKey();
  const parts = ciphertext.split(":");
  if (parts.length !== 3) throw new Error("Invalid encrypted token format");
  const [ivHex, authTagHex, ctHex] = parts;
  const iv = Buffer.from(ivHex!, "hex");
  const authTag = Buffer.from(authTagHex!, "hex");
  const ct = Buffer.from(ctHex!, "hex");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(ct, undefined, "utf8") + decipher.final("utf8");
}

// ---------------------------------------------------------------------------
// ServiceM8 OAuth URLs
// ---------------------------------------------------------------------------

export function getServiceM8AuthUrl(state: string, redirectUri: string): string {
  const clientId = process.env.SERVICEM8_CLIENT_ID;
  if (!clientId) throw new Error("SERVICEM8_CLIENT_ID not configured");
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "manage_jobs,manage_customers",
    state,
  });
  return `https://go.servicem8.com/oauth/authorize?${params.toString()}`;
}

export async function exchangeServiceM8Code(
  code: string,
  redirectUri: string
): Promise<{ accessToken: string; refreshToken: string; expiresAt: Date }> {
  const clientId = process.env.SERVICEM8_CLIENT_ID;
  const clientSecret = process.env.SERVICEM8_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("ServiceM8 credentials not configured");

  const res = await fetch("https://go.servicem8.com/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!res.ok) {
    throw new Error(`ServiceM8 token exchange failed: ${res.status}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}

// ---------------------------------------------------------------------------
// Tradify OAuth URLs
// ---------------------------------------------------------------------------

export function getTradifyAuthUrl(state: string, redirectUri: string): string {
  const clientId = process.env.TRADIFY_CLIENT_ID;
  if (!clientId) throw new Error("TRADIFY_CLIENT_ID not configured");
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "jobs customers",
    state,
  });
  return `https://tradifyhq.com/oauth/authorize?${params.toString()}`;
}

export async function exchangeTradifyCode(
  code: string,
  redirectUri: string
): Promise<{ accessToken: string; refreshToken: string; expiresAt: Date }> {
  const clientId = process.env.TRADIFY_CLIENT_ID;
  const clientSecret = process.env.TRADIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Tradify credentials not configured");

  const res = await fetch("https://tradifyhq.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!res.ok) {
    throw new Error(`Tradify token exchange failed: ${res.status}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}

// ---------------------------------------------------------------------------
// FSM job creation
// ---------------------------------------------------------------------------

export interface FsmJobPayload {
  customerName: string;
  customerMobile: string | null;
  address: string | null;
  lineItemsNotes: string;
  quotedTotalAud: number;
  licenceNumber: string;
  quoteRef: string;
}

export async function createServiceM8Job(
  accessToken: string,
  payload: FsmJobPayload
): Promise<void> {
  const res = await fetch("https://api.servicem8.com/api_1.0/job.json", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      status: "Quote",
      job_address: payload.address ?? "",
      contact_name: payload.customerName,
      notes: `${payload.lineItemsNotes}\n\nQuote Total (inc GST): A$${payload.quotedTotalAud.toFixed(2)}\nNSW Licence: ${payload.licenceNumber}\nQuote Ref: ${payload.quoteRef}`,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    logger.error({ status: res.status, body }, "fsm.servicem8.create_job_error");
    throw new Error(`ServiceM8 job creation failed: ${res.status}`);
  }

  logger.info({ provider: "servicem8", quoteRef: payload.quoteRef }, "fsm.job_created");
}

export async function createTradifyJob(
  accessToken: string,
  payload: FsmJobPayload
): Promise<void> {
  const res = await fetch("https://app.tradifyhq.com/api/jobs", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: `Quote ${payload.quoteRef} — ${payload.address ?? ""}`,
      client_name: payload.customerName,
      client_phone: payload.customerMobile,
      site_address: payload.address,
      description: `${payload.lineItemsNotes}\n\nTotal: A$${payload.quotedTotalAud.toFixed(2)}\nNSW Licence: ${payload.licenceNumber}`,
      status: "quote",
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    logger.error({ status: res.status, body }, "fsm.tradify.create_job_error");
    throw new Error(`Tradify job creation failed: ${res.status}`);
  }

  logger.info({ provider: "tradify", quoteRef: payload.quoteRef }, "fsm.job_created");
}
