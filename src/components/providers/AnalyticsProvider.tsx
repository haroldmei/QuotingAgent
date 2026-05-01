"use client";

/**
 * AnalyticsProvider — PostHog initialisation and consent listener.
 *
 * Stack contract: analytics.product=posthog, analytics.consent=required-before-load
 *
 * Responsibilities:
 *   1. On mount: check cookie consent. If user has already accepted, init PostHog.
 *   2. Listen for storage changes (other tabs accepting consent).
 *   3. Does NOT fire any event itself — that is left to call-site wrappers.
 *
 * Placement: wrap the app-authenticated layout (not the root layout, so the
 * unauthenticated customer quote view also gets analytics after consent).
 * CookieConsent.tsx handles the opt-in / opt-out UI; this provider handles
 * PostHog SDK lifecycle.
 */

import { useEffect } from "react";
import { initPostHog, optInAnalytics, optOutAnalytics } from "@/lib/analytics/client";
import { hasAnalyticsConsent } from "@/lib/analytics/consent";

interface AnalyticsProviderProps {
  children: React.ReactNode;
}

export function AnalyticsProvider({ children }: AnalyticsProviderProps) {
  useEffect(() => {
    // Initialise PostHog if user has already consented (e.g., returning visitor).
    if (hasAnalyticsConsent()) {
      initPostHog();
    }

    // Listen for storage events so that accepting consent in another tab
    // enables analytics in this tab without a page reload.
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== "cookie_consent") return;
      if (!event.newValue) return;

      try {
        const parsed = JSON.parse(event.newValue);
        if (parsed.analytics === true) {
          initPostHog();
          optInAnalytics();
        } else {
          optOutAnalytics();
        }
      } catch {
        // Ignore malformed consent data.
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  return <>{children}</>;
}
