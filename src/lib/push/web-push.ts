/**
 * Web Push (VAPID) helper
 * Stack contract: frontend.pwa=true, STACK_GAP-003 resolved: web-push npm + VAPID via gcp-secret-manager
 * FR-032: Push notifications to tradie for quote events
 */

import webpush from "web-push";
import { logger } from "@/lib/logger";

let _initialized = false;

function ensureInitialized(): void {
  if (_initialized) return;
  const vapidPublic = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT ?? "mailto:app@quotingagent.com.au";

  if (!vapidPublic || !vapidPrivate) {
    throw new Error("VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY not configured");
  }

  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);
  _initialized = true;
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

export interface PushSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/**
 * Send a Web Push notification to a single subscription.
 * Returns true on success, false on 404/410 (expired subscription).
 * Throws on other errors.
 */
export async function sendPushNotification(
  subscription: PushSubscription,
  payload: PushPayload
): Promise<boolean> {
  ensureInitialized();

  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: subscription.keys,
      },
      JSON.stringify(payload),
      {
        urgency: "normal",
        TTL: 60 * 60, // 1 hour TTL
      }
    );
    logger.info({ tag: payload.tag }, "push.sent");
    return true;
  } catch (err: unknown) {
    const status = (err as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) {
      // Subscription expired — caller should delete it from DB
      logger.info({ tag: payload.tag }, "push.subscription_expired");
      return false;
    }
    logger.error({ err, tag: payload.tag }, "push.send_error");
    throw err;
  }
}

/**
 * Send a push notification to all subscriptions for a user.
 * Expired subscriptions (404/410) are returned so the caller can clean them up.
 */
export async function sendPushToUser(
  subscriptions: PushSubscription[],
  payload: PushPayload
): Promise<{ expiredEndpoints: string[] }> {
  const expiredEndpoints: string[] = [];

  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      const alive = await sendPushNotification(sub, payload);
      if (!alive) {
        expiredEndpoints.push(sub.endpoint);
      }
    })
  );

  return { expiredEndpoints };
}

/** Reset initialization state (for tests). */
export const __INTERNAL__ = {
  reset: () => { _initialized = false; },
};
