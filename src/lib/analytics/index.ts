/**
 * Analytics module — public surface.
 *
 * Stack contract: analytics.product=posthog, analytics.consent=required-before-load
 *
 * Exports:
 *   - Client-side: trackEvent, identifyUser, resetIdentity, optInAnalytics,
 *                  optOutAnalytics, initPostHog
 *   - Server-side: captureServerEvent, shutdownAnalytics
 *   - Shared:      EVENTS, WEDGE_FUNNEL, hasAnalyticsConsent, hashId, hashIdSync
 */

// Consent gate (safe to import everywhere)
export { hasAnalyticsConsent } from "./consent";

// ID hashing helpers (safe to import everywhere)
export { hashId, hashIdSync } from "./hash";

// Event names + property types + funnel definition
export {
  EVENTS,
  WEDGE_FUNNEL,
  type EventName,
  type WedgeEventProps,
  type LeadReceivedProps,
  type PhotosUploadedProps,
  type QuoteGenerationStartedProps,
  type QuoteGenerationCompletedProps,
  type QuoteSentProps,
  type QuoteReadProps,
  type QuoteAcceptedProps,
  type QuoteDeclinedProps,
  type WedgeFunnelStep,
} from "./events";

// Client-side (only import in "use client" components or client entry points)
export {
  initPostHog,
  trackEvent,
  identifyUser,
  resetIdentity,
  optInAnalytics,
  optOutAnalytics,
} from "./client";

// Server-side (only import in API routes / worker)
export { captureServerEvent, shutdownAnalytics } from "./server";
