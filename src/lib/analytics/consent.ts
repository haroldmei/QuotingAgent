/**
 * Analytics consent helpers.
 *
 * Stack contract: analytics.consent=required-before-load
 *
 * PostHog MUST NOT load or fire events until the user has explicitly accepted
 * analytics cookies via the CookieConsent component. This module is the single
 * authoritative check before any PostHog call is made.
 *
 * Server-side: the worker uses posthog-node which is initialised lazily —
 * it does NOT call this; server events are assumed user-consented because they
 * are fired on explicit user actions (quote sent, accepted, etc.).
 */

const COOKIE_CONSENT_KEY = "cookie_consent";

interface ConsentPreference {
  necessary: boolean;
  analytics: boolean;
  marketing: boolean;
}

/**
 * Returns true iff the user has explicitly opted into analytics cookies.
 * Safe to call in any browser context; always returns false on the server.
 */
export function hasAnalyticsConsent(): boolean {
  if (typeof globalThis.localStorage === "undefined") return false;
  try {
    const raw = globalThis.localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!raw) return false;
    const parsed: ConsentPreference = JSON.parse(raw);
    return parsed.analytics === true;
  } catch {
    return false;
  }
}
