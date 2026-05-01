/**
 * Server-side PostHog analytics — posthog-node.
 *
 * Stack contract:
 *   analytics.product=posthog
 *
 * Server-side capture is used for events that originate in API routes or the
 * BullMQ worker where there is no browser context. Server events are always
 * fired on explicit user actions (lead webhook received, quote sent, etc.) —
 * they are NOT subject to browser consent because no user-identifying cookie
 * is written server-side. The distinctId is always a hashed ID.
 *
 * This module is intentionally NOT gated on hasAnalyticsConsent() because:
 *   1. It runs server-side where localStorage is unavailable.
 *   2. Events are tied to explicit workflow steps (not page views or passive tracking).
 *   3. No PII is ever sent — all IDs are hashed before reaching PostHog.
 */

import { PostHog } from "posthog-node";
import type { EventName, WedgeEventProps } from "./events";

let _client: PostHog | null = null;

function getClient(): PostHog | null {
  if (_client) return _client;

  const key = process.env.POSTHOG_API_KEY ?? process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

  if (!key) return null;

  _client = new PostHog(key, {
    host,
    // Flush immediately — serverless functions may not survive to a scheduled flush.
    flushAt: 1,
    flushInterval: 0,
  });

  return _client;
}

/**
 * Capture a wedge event from an API route or worker process.
 *
 * @param distinctId  Hashed user/crew ID — never a raw UUID or PII.
 * @param event       Event name from EVENTS constant.
 * @param properties  Event-specific properties (see events.ts).
 */
export async function captureServerEvent(
  distinctId: string,
  event: EventName,
  properties: WedgeEventProps & Record<string, unknown>
): Promise<void> {
  const client = getClient();
  if (!client) return;

  try {
    client.capture({
      distinctId,
      event,
      properties: {
        ...properties,
        $lib: "posthog-node",
        source: "server",
      },
    });
    // Flush immediately for serverless contexts (Vercel Route Handlers).
    await client.shutdown();
    // Re-create client for next call (singleton reset after shutdown).
    _client = null;
  } catch {
    // Analytics must never break the critical path.
  }
}

/**
 * Flush and shutdown the PostHog client.
 * Call at the end of long-lived processes (e.g., Cloud Run worker shutdown).
 */
export async function shutdownAnalytics(): Promise<void> {
  if (!_client) return;
  await _client.shutdown();
  _client = null;
}
