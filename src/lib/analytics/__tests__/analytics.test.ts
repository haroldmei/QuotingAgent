/**
 * Analytics module unit tests.
 *
 * Tests:
 *   1. hasAnalyticsConsent() — correct consent detection via localStorage stub
 *   2. trackEvent() — fires PostHog only after consent + init
 *   3. identifyUser() — blocked without consent
 *   4. hashId() / hashIdSync() — deterministic, non-empty output
 *   5. EVENTS / WEDGE_FUNNEL — correct shape and ordering
 *   6. captureServerEvent() — fires posthog-node, swallows errors gracefully
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — use vi.hoisted so variables are available when vi.mock factories run
// ---------------------------------------------------------------------------

const {
  mockCapture,
  mockIdentify,
  mockOptIn,
  mockOptOut,
  mockReset,
  mockInit,
  mockNodeCapture,
  mockNodeShutdown,
} = vi.hoisted(() => ({
  mockCapture: vi.fn(),
  mockIdentify: vi.fn(),
  mockOptIn: vi.fn(),
  mockOptOut: vi.fn(),
  mockReset: vi.fn(),
  mockInit: vi.fn(),
  mockNodeCapture: vi.fn(),
  mockNodeShutdown: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("posthog-js", () => ({
  default: {
    init: mockInit,
    capture: mockCapture,
    identify: mockIdentify,
    opt_in_capturing: mockOptIn,
    opt_out_capturing: mockOptOut,
    reset: mockReset,
    has_opted_out_capturing: () => false,
  },
}));

vi.mock("posthog-node", () => ({
  PostHog: vi.fn().mockImplementation(() => ({
    capture: mockNodeCapture,
    shutdown: mockNodeShutdown,
  })),
}));

// ---------------------------------------------------------------------------
// Stub helpers
// ---------------------------------------------------------------------------

/**
 * Stubs globalThis.localStorage with the given analytics consent value.
 * Uses null to simulate "no consent record stored yet".
 */
function stubLocalStorageConsent(analytics: boolean | null) {
  const value =
    analytics !== null
      ? JSON.stringify({ necessary: true, analytics, marketing: false })
      : null;

  vi.stubGlobal("localStorage", {
    getItem: (_key: string) => value,
    setItem: vi.fn(),
    removeItem: vi.fn(),
  });
}

function stubLocalStorageMalformed() {
  vi.stubGlobal("localStorage", {
    getItem: (_key: string) => "{{invalid json}}",
    setItem: vi.fn(),
  });
}

// ---------------------------------------------------------------------------
// Top-level imports (resolved after vi.mock() declarations)
// ---------------------------------------------------------------------------

import { hasAnalyticsConsent } from "../consent";
import { trackEvent, identifyUser } from "../client";
import { hashId, hashIdSync } from "../hash";
import { EVENTS, WEDGE_FUNNEL } from "../events";
import { captureServerEvent } from "../server";

// ---------------------------------------------------------------------------
// Tests: consent helpers
// ---------------------------------------------------------------------------

describe("hasAnalyticsConsent", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns false when localStorage has no consent record", () => {
    stubLocalStorageConsent(null);
    expect(hasAnalyticsConsent()).toBe(false);
  });

  it("returns true when analytics consent is granted", () => {
    stubLocalStorageConsent(true);
    expect(hasAnalyticsConsent()).toBe(true);
  });

  it("returns false when analytics consent is denied", () => {
    stubLocalStorageConsent(false);
    expect(hasAnalyticsConsent()).toBe(false);
  });

  it("returns false when localStorage value is malformed JSON", () => {
    stubLocalStorageMalformed();
    expect(hasAnalyticsConsent()).toBe(false);
  });

  it("returns false when localStorage is not available (server-side)", () => {
    // No localStorage stub → globalThis.localStorage is undefined in node env
    expect(hasAnalyticsConsent()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Tests: trackEvent — consent gate (client-side)
// ---------------------------------------------------------------------------

describe("trackEvent (client — consent gate)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    mockCapture.mockClear();
  });

  it("does NOT call posthog.capture when analytics consent is denied", () => {
    stubLocalStorageConsent(false);
    trackEvent(EVENTS.LEAD_RECEIVED, {
      source: "manual",
      crew_id_hash: "abc123",
    });
    expect(mockCapture).not.toHaveBeenCalled();
  });

  it("does NOT call posthog.capture when analytics consent is absent", () => {
    stubLocalStorageConsent(null);
    trackEvent(EVENTS.PHOTOS_UPLOADED, {
      count: 3,
      total_bytes: 500000,
      lead_id_hash: "lead_xyz",
      has_context_note: false,
    });
    expect(mockCapture).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Tests: identifyUser — consent gate
// ---------------------------------------------------------------------------

describe("identifyUser (consent gate)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    mockIdentify.mockClear();
  });

  it("does NOT call posthog.identify when analytics consent is denied", () => {
    stubLocalStorageConsent(false);
    identifyUser("hashed_user_id");
    expect(mockIdentify).not.toHaveBeenCalled();
  });

  it("does NOT call posthog.identify when analytics consent is absent", () => {
    stubLocalStorageConsent(null);
    identifyUser("hashed_user_id_2", { trade_type: "roofer" });
    expect(mockIdentify).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Tests: hash utilities
// ---------------------------------------------------------------------------

describe("hashId", () => {
  it("returns a non-empty string for any input", async () => {
    const result = await hashId("some-uuid-1234");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("is deterministic — same input always yields same output", async () => {
    const a = await hashId("test-id-abc");
    const b = await hashId("test-id-abc");
    expect(a).toBe(b);
  });

  it("returns different values for different inputs", async () => {
    const a = await hashId("id-one");
    const b = await hashId("id-two");
    expect(a).not.toBe(b);
  });
});

describe("hashIdSync", () => {
  it("returns a non-empty hex string", () => {
    const result = hashIdSync("test-uuid");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
    expect(/^[0-9a-f]+$/.test(result)).toBe(true);
  });

  it("is deterministic for the same input", () => {
    expect(hashIdSync("stable")).toBe(hashIdSync("stable"));
  });

  it("returns different values for different inputs", () => {
    expect(hashIdSync("alpha")).not.toBe(hashIdSync("beta"));
  });
});

// ---------------------------------------------------------------------------
// Tests: event constants
// ---------------------------------------------------------------------------

describe("EVENTS constant", () => {
  it("defines all 8 wedge-critical event names", () => {
    expect(EVENTS.LEAD_RECEIVED).toBe("lead_received");
    expect(EVENTS.PHOTOS_UPLOADED).toBe("photos_uploaded");
    expect(EVENTS.QUOTE_GENERATION_STARTED).toBe("quote_generation_started");
    expect(EVENTS.QUOTE_GENERATION_COMPLETED).toBe("quote_generation_completed");
    expect(EVENTS.QUOTE_SENT).toBe("quote_sent");
    expect(EVENTS.QUOTE_READ).toBe("quote_read");
    expect(EVENTS.QUOTE_ACCEPTED).toBe("quote_accepted");
    expect(EVENTS.QUOTE_DECLINED).toBe("quote_declined");
    expect(Object.keys(EVENTS)).toHaveLength(8);
  });
});

describe("WEDGE_FUNNEL", () => {
  it("defines the 4-step conversion funnel in correct order", () => {
    expect(WEDGE_FUNNEL).toHaveLength(4);
    expect(WEDGE_FUNNEL[0]).toBe(EVENTS.LEAD_RECEIVED);
    expect(WEDGE_FUNNEL[1]).toBe(EVENTS.PHOTOS_UPLOADED);
    expect(WEDGE_FUNNEL[2]).toBe(EVENTS.QUOTE_SENT);
    expect(WEDGE_FUNNEL[3]).toBe(EVENTS.QUOTE_ACCEPTED);
  });
});

// ---------------------------------------------------------------------------
// Tests: server-side captureServerEvent
// ---------------------------------------------------------------------------

describe("captureServerEvent", () => {
  beforeEach(() => {
    mockNodeCapture.mockClear();
    mockNodeShutdown.mockClear();
  });

  afterEach(() => {
    delete process.env.POSTHOG_API_KEY;
    delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
  });

  it("calls posthog-node capture with correct distinctId and event", async () => {
    process.env.POSTHOG_API_KEY = "phc_test_key";
    // Reset module to pick up env var (server.ts reads env at client init)
    vi.resetModules();
    const { captureServerEvent: capture } = await import("../server");

    await capture("hashed_user", EVENTS.LEAD_RECEIVED, {
      source: "da_webhook",
      crew_id_hash: "crew_hash_123",
    });

    expect(mockNodeCapture).toHaveBeenCalledOnce();
    const call = mockNodeCapture.mock.calls[0][0];
    expect(call.distinctId).toBe("hashed_user");
    expect(call.event).toBe("lead_received");
    expect(call.properties.crew_id_hash).toBe("crew_hash_123");
  });

  it("does not throw when POSTHOG_API_KEY is absent", async () => {
    // No key in env
    vi.resetModules();
    const { captureServerEvent: capture } = await import("../server");

    await expect(
      capture("user_hash", EVENTS.QUOTE_SENT, {
        quote_id_hash: "q_hash",
        channel: "sms",
        total_aud: 1200,
      })
    ).resolves.not.toThrow();

    // posthog-node client should NOT have been created
    expect(mockNodeCapture).not.toHaveBeenCalled();
  });

  it("passes all quote_generation_completed properties to posthog-node", async () => {
    process.env.POSTHOG_API_KEY = "phc_test_key";
    vi.resetModules();
    const { captureServerEvent: capture } = await import("../server");

    await capture("crew_hash_abc", EVENTS.QUOTE_GENERATION_COMPLETED, {
      quote_id_hash: "q_completed",
      latency_ms: 42000,
      ai_cost_aud: 0.18,
      model_used: "claude-opus-4-7",
      line_item_count: 12,
      confidence_score: 88,
    });

    const call = mockNodeCapture.mock.calls[0][0];
    expect(call.properties.latency_ms).toBe(42000);
    expect(call.properties.ai_cost_aud).toBe(0.18);
    expect(call.properties.confidence_score).toBe(88);
    expect(call.properties.model_used).toBe("claude-opus-4-7");
  });
});
