/**
 * POST /api/notifications/push/subscribe — save VAPID push subscription (FR-032)
 *
 * Stack contract: frontend.pwa=true, STACK_GAP-003
 * Called by the PWA after the user grants push permission.
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveAuth, isAuthError } from "@/lib/auth/guard";
import { createServiceClient } from "@/lib/db/supabase-server";
import { PushSubscribeReqSchema } from "@/lib/schemas/quotes";
import { rateLimiters } from "@/lib/services/rate-limit";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  const auth = await resolveAuth(req);
  if (isAuthError(auth)) return auth.error;
  const { userId } = auth.ctx;

  // Rate limit per crew
  const { success } = await rateLimiters.pushSubscribe.limit(userId);
  if (!success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parse = PushSubscribeReqSchema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parse.error.flatten() },
      { status: 422 }
    );
  }

  const serviceClient = createServiceClient();

  // Upsert subscription (UNIQUE constraint on user_id + endpoint)
  const { error } = await serviceClient
    .from("push_subscriptions")
    .upsert(
      {
        user_id: userId,
        endpoint: parse.data.endpoint,
        p256dh: parse.data.keys.p256dh,
        auth_key: parse.data.keys.auth,
      },
      { onConflict: "user_id, endpoint" }
    );

  if (error) {
    logger.error({ err: error, userId }, "push.subscribe.error");
    return NextResponse.json({ error: "Failed to save subscription" }, { status: 500 });
  }

  logger.info({ userId }, "push.subscribed");
  return NextResponse.json({ ok: true });
}

// DELETE /api/notifications/push/subscribe — remove a push subscription
export async function DELETE(req: NextRequest) {
  const auth = await resolveAuth(req);
  if (isAuthError(auth)) return auth.error;
  const { userId } = auth.ctx;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { endpoint } = (body ?? {}) as { endpoint?: string };
  if (!endpoint) {
    return NextResponse.json({ error: "endpoint is required" }, { status: 400 });
  }

  const serviceClient = createServiceClient();
  await serviceClient
    .from("push_subscriptions")
    .delete()
    .eq("user_id", userId)
    .eq("endpoint", endpoint);

  return new NextResponse(null, { status: 204 });
}
