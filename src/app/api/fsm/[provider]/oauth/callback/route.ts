/**
 * GET /api/fsm/[provider]/oauth/callback — exchange OAuth code, encrypt + save token (FR-027/028)
 *
 * Flow:
 *   1. Verify CSRF state token (from Redis)
 *   2. Exchange auth code for access + refresh tokens
 *   3. Encrypt tokens with AES-256-GCM
 *   4. Upsert fsm_connections row
 *   5. Redirect to /settings?fsm=connected
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/db/supabase-server";
import { getRedis } from "@/lib/services/rate-limit";
import {
  exchangeServiceM8Code,
  exchangeTradifyCode,
  encryptOAuthToken,
} from "@/lib/services/fsm";
import { logger } from "@/lib/logger";

type Params = { params: Promise<{ provider: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { provider } = await params;
  const sp = req.nextUrl.searchParams;
  const code = sp.get("code");
  const state = sp.get("state");
  const error = sp.get("error");

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.quotingagent.com.au";

  if (error) {
    logger.warn({ provider, error }, "fsm.oauth.callback_error");
    return NextResponse.redirect(`${baseUrl}/settings?fsm=error&reason=${encodeURIComponent(error)}`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${baseUrl}/settings?fsm=error&reason=missing_params`);
  }

  // Verify CSRF state
  const redis = getRedis();
  const stateKey = `fsm:oauth:state:${state}`;
  const stateData = await redis.get<{ crewId: string; provider: string }>(stateKey);

  if (!stateData || stateData.provider !== provider) {
    logger.warn({ provider, state }, "fsm.oauth.invalid_state");
    return NextResponse.redirect(`${baseUrl}/settings?fsm=error&reason=invalid_state`);
  }

  const { crewId } = stateData;
  // Delete the state token — single use
  await redis.del(stateKey);

  const redirectUri = `${baseUrl}/api/fsm/${provider}/oauth/callback`;

  let accessToken: string;
  let refreshToken: string;
  let expiresAt: Date;

  try {
    if (provider === "servicem8") {
      const result = await exchangeServiceM8Code(code, redirectUri);
      accessToken = result.accessToken;
      refreshToken = result.refreshToken;
      expiresAt = result.expiresAt;
    } else if (provider === "tradify") {
      const result = await exchangeTradifyCode(code, redirectUri);
      accessToken = result.accessToken;
      refreshToken = result.refreshToken;
      expiresAt = result.expiresAt;
    } else {
      return NextResponse.redirect(`${baseUrl}/settings?fsm=error&reason=unknown_provider`);
    }
  } catch (exchangeErr) {
    logger.error({ err: exchangeErr, provider }, "fsm.oauth.exchange_failed");
    return NextResponse.redirect(`${baseUrl}/settings?fsm=error&reason=exchange_failed`);
  }

  // Encrypt tokens
  const tokenPayload = JSON.stringify({ accessToken, refreshToken });
  let encryptedToken: string;
  try {
    encryptedToken = encryptOAuthToken(tokenPayload);
  } catch (encErr) {
    logger.error({ err: encErr, provider }, "fsm.oauth.encrypt_failed");
    return NextResponse.redirect(`${baseUrl}/settings?fsm=error&reason=server_error`);
  }

  // Upsert fsm_connections
  const serviceClient = createServiceClient();
  const { error: upsertError } = await serviceClient
    .from("fsm_connections")
    .upsert(
      {
        crew_id: crewId,
        provider: provider as "servicem8" | "tradify",
        encrypted_oauth_token: encryptedToken,
        expires_at: expiresAt.toISOString(),
      },
      { onConflict: "crew_id, provider" }
    );

  if (upsertError) {
    logger.error({ err: upsertError, provider, crewId }, "fsm.oauth.save_failed");
    return NextResponse.redirect(`${baseUrl}/settings?fsm=error&reason=save_failed`);
  }

  logger.info({ provider, crewId }, "fsm.oauth.connected");
  return NextResponse.redirect(`${baseUrl}/settings?fsm=connected&provider=${provider}`);
}
