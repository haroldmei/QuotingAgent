/**
 * Client-side PostHog analytics — consent-gated.
 *
 * Stack contract:
 *   analytics.product=posthog
 *   analytics.consent=required-before-load
 *   feature_flags.provider=posthog-flags
 *
 * PostHog is initialised lazily — only after the user opts into analytics
 * cookies via CookieConsent. No events fire before opt-in.
 *
 * Import this module only in client components ("use client").
 */

"use client";

import posthog from "posthog-js";
import { hasAnalyticsConsent } from "./consent";
import type { EventName, WedgeEventProps } from "./events";

let _initialised = false;

/**
 * Initialise PostHog. Called by AnalyticsProvider once the user has
 * consented. Idempotent — safe to call multiple times.
 */
export function initPostHog(): void {
  if (_initialised) return;
  if (typeof window === "undefined") return;
  if (!hasAnalyticsConsent()) return;

  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

  if (!key) {
    // PostHog key not set — analytics disabled (expected in local dev without key).
    return;
  }

  posthog.init(key, {
    api_host: host,
    // Opt out by default; AnalyticsProvider opts in after consent check.
    opt_out_capturing_by_default: true,
    // Disable automatic page-view capture — we fire page_viewed explicitly so
    // we can include the correct path and skip non-wedge routes.
    capture_pageview: false,
    // Persist flags in memory (no extra cookie) while we are in consent-gated mode.
    persistence: "memory",
    // Disable session recording unless explicitly enabled.
    disable_session_recording: true,
    loaded: (ph) => {
      if (hasAnalyticsConsent()) {
        ph.opt_in_capturing();
      }
    },
  });

  _initialised = true;
}

/**
 * Opt the current user into PostHog capturing.
 * Called by CookieConsent when the user accepts analytics.
 */
export function optInAnalytics(): void {
  if (typeof window === "undefined") return;
  if (!_initialised) {
    initPostHog();
    return;
  }
  posthog.opt_in_capturing();
}

/**
 * Opt the current user out of PostHog capturing.
 * Called by CookieConsent when the user rejects analytics.
 */
export function optOutAnalytics(): void {
  if (typeof window === "undefined") return;
  posthog.opt_out_capturing();
}

/**
 * Track a wedge-critical event.
 *
 * Guards:
 *   1. Server-side: no-op (client module only)
 *   2. No consent: no-op
 *   3. Key not configured: no-op
 */
export function trackEvent(
  event: EventName,
  properties: WedgeEventProps & Record<string, unknown>
): void {
  if (typeof window === "undefined") return;
  if (!hasAnalyticsConsent()) return;
  if (!_initialised) return;

  posthog.capture(event, {
    ...properties,
    $timestamp: new Date().toISOString(),
  });
}

/**
 * Identify the current user in PostHog.
 * Uses a hashed ID — never the raw Supabase auth.uid().
 *
 * Call after successful login / onboarding completion.
 */
export function identifyUser(
  hashedUserId: string,
  traits?: {
    trade_type?: string;
    crew_id_hash?: string;
  }
): void {
  if (typeof window === "undefined") return;
  if (!hasAnalyticsConsent()) return;
  if (!_initialised) return;

  posthog.identify(hashedUserId, traits ?? {});
}

/**
 * Reset the PostHog identity (call on logout).
 */
export function resetIdentity(): void {
  if (typeof window === "undefined") return;
  posthog.reset();
}

/**
 * Expose the posthog instance for feature-flag checks.
 * Callers must check hasAnalyticsConsent() before use.
 */
export { posthog };
