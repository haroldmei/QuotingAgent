/**
 * GET /api/fsm/[provider]/oauth/start — redirect to FSM OAuth (FR-027, FR-028)
 * Supported providers: servicem8, tradify
 *
 * Stack contract: external_integrations.fsm.servicem8=webhook-and-rest
 *                 external_integrations.fsm.tradify=webhook-and-rest
 *                 security.rate_limiting=required
 */

import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { resolveAuth, isAuthError } from "@/lib/auth/guard";
import { getRedis } from "@/lib/services/rate-limit";
import { rateLimiters } from "@/lib/services/rate-limit";
import { getServiceM8AuthUrl, getTradifyAuthUrl } from "@/lib/services/fsm";

type Params = { params: Promise<{ provider: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await resolveAuth(req);
  if (isAuthError(auth)) return auth.error;
  const { crewId } = auth.ctx;
  const { provider } = await params;

  // Rate limit
  const { success } = await rateLimiters.fsmOAuth.limit(crewId);
  if (!success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  if (!["servicem8", "tradify"].includes(provider)) {
    return NextResponse.json({ error: "Unknown FSM provider" }, { status: 400 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.quotingagent.com.au";
  const redirectUri = `${baseUrl}/api/fsm/${provider}/oauth/callback`;

  // Generate CSRF state token — store in Redis for 10 minutes
  const state = randomBytes(16).toString("hex");
  const stateKey = `fsm:oauth:state:${state}`;
  const redis = getRedis();
  await redis.set(stateKey, JSON.stringify({ crewId, provider }), { ex: 600 });

  let authUrl: string;
  try {
    if (provider === "servicem8") {
      authUrl = getServiceM8AuthUrl(state, redirectUri);
    } else {
      authUrl = getTradifyAuthUrl(state, redirectUri);
    }
  } catch (err) {
    return NextResponse.json(
      { error: `${provider} OAuth not configured. Check environment variables.` },
      { status: 503 }
    );
  }

  return NextResponse.redirect(authUrl, { status: 302 });
}
