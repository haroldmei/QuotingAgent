/**
 * Unit tests: followup-sms.ts
 * FR-023: D+3/D+7 SMS nudge — send window, skip conditions, SMS body, event recording
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Hoist mock fns so they're available in vi.mock factories ───────────────
const {
  mockSendSms,
  mockSmsEventsInsert,
  mockFollowupSchedulesUpdate,
  mockLeadsSelect,
} = vi.hoisted(() => ({
  mockSendSms: vi.fn(),
  mockSmsEventsInsert: vi.fn(),
  mockFollowupSchedulesUpdate: vi.fn(),
  mockLeadsSelect: vi.fn(),
}));

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock("@/lib/sms/twilio", () => ({
  sendSms: mockSendSms,
}));

vi.mock("@/lib/db/supabase-server", () => {
  // Chain builder for .from().select().eq().single()
  const makeChain = () => {
    const chain: Record<string, unknown> = {};
    chain.select = vi.fn(() => chain);
    chain.eq = vi.fn(() => chain);
    chain.single = vi.fn(() => mockLeadsSelect());
    chain.insert = vi.fn(() => mockSmsEventsInsert());
    chain.update = vi.fn(() => chain);
    chain.lt = vi.fn(() => Promise.resolve({ error: null }));
    return chain;
  };
  return {
    createServiceClient: vi.fn(() => ({
      from: vi.fn((table: string) => {
        if (table === "leads") return makeChain();
        if (table === "sms_events") return makeChain();
        if (table === "followup_schedules") {
          const c = makeChain();
          c.update = vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => mockFollowupSchedulesUpdate()),
            })),
          }));
          return c;
        }
        return makeChain();
      }),
    })),
  };
});

vi.mock("pino", () => ({
  default: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

import pino from "pino";
import { followupSmsJob, type FollowupSmsJobData } from "@/worker/jobs/followup-sms";

// ── Helpers ────────────────────────────────────────────────────────────────

function makeLogger() {
  return pino() as pino.Logger;
}

const BASE_DATA: FollowupSmsJobData = {
  leadId: "lead-001",
  quoteId: "quote-001",
  stage: "d3",
  crewId: "crew-001",
  customerMobile: "+61411000001",
  customerName: "John Smith",
  address: "12 Main St, Sydney NSW 2000",
  tradeName: "AusRoof Pty Ltd",
  quoteViewUrl: "https://app.quotingagent.com.au/q/token123",
};

// AEST = UTC+10. During the window: 08:00-17:59 AEST = 22:00-07:59 UTC previous day
// Pick UTC time that maps to 10:00 AEST (within window)
const IN_WINDOW_UTC_H = 0;    // 00:00 UTC = 10:00 AEST ✓
const OUT_WINDOW_UTC_H = 20;  // 20:00 UTC = 06:00 AEST ✗ (before 08:00)

function mockDateNow(utcHour: number) {
  const d = new Date();
  d.setUTCHours(utcHour, 0, 0, 0);
  vi.spyOn(Date, "now").mockReturnValue(d.getTime());
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("followupSmsJob", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockSendSms.mockResolvedValue({ messageSid: "SM-test-001", status: "queued" });
    mockSmsEventsInsert.mockResolvedValue({ error: null });
    mockFollowupSchedulesUpdate.mockResolvedValue({ error: null });
    process.env.NEXT_PUBLIC_APP_URL = "https://app.quotingagent.com.au";
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  // ── Lead status checks ──────────────────────────────────────────────────

  it("skips when lead is not found", async () => {
    mockLeadsSelect.mockResolvedValue({ data: null, error: null });
    await followupSmsJob(BASE_DATA, makeLogger());
    expect(mockSendSms).not.toHaveBeenCalled();
  });

  it.each(["won", "lost", "accepted", "declined"])(
    "skips when lead status is '%s'",
    async (status) => {
      mockLeadsSelect.mockResolvedValue({
        data: { status, sms_disabled_followup: false },
        error: null,
      });
      mockDateNow(IN_WINDOW_UTC_H);
      await followupSmsJob(BASE_DATA, makeLogger());
      expect(mockSendSms).not.toHaveBeenCalled();
    }
  );

  it("skips when sms_disabled_followup is true", async () => {
    mockLeadsSelect.mockResolvedValue({
      data: { status: "draft_ready", sms_disabled_followup: true },
      error: null,
    });
    mockDateNow(IN_WINDOW_UTC_H);
    await followupSmsJob(BASE_DATA, makeLogger());
    expect(mockSendSms).not.toHaveBeenCalled();
  });

  it("skips when customerMobile is null", async () => {
    mockLeadsSelect.mockResolvedValue({
      data: { status: "sent", sms_disabled_followup: false },
      error: null,
    });
    mockDateNow(IN_WINDOW_UTC_H);
    await followupSmsJob({ ...BASE_DATA, customerMobile: null }, makeLogger());
    expect(mockSendSms).not.toHaveBeenCalled();
  });

  // ── Send window ─────────────────────────────────────────────────────────

  it("skips outside AEST send window (06:00 AEST)", async () => {
    mockLeadsSelect.mockResolvedValue({
      data: { status: "sent", sms_disabled_followup: false },
      error: null,
    });
    mockDateNow(OUT_WINDOW_UTC_H); // 20:00 UTC = 06:00 AEST
    await followupSmsJob(BASE_DATA, makeLogger());
    expect(mockSendSms).not.toHaveBeenCalled();
  });

  it("sends within AEST send window (10:00 AEST)", async () => {
    mockLeadsSelect.mockResolvedValue({
      data: { status: "sent", sms_disabled_followup: false },
      error: null,
    });
    mockDateNow(IN_WINDOW_UTC_H); // 00:00 UTC = 10:00 AEST
    await followupSmsJob(BASE_DATA, makeLogger());
    expect(mockSendSms).toHaveBeenCalledOnce();
  });

  it("sends at exactly 08:00 AEST (window start)", async () => {
    mockLeadsSelect.mockResolvedValue({
      data: { status: "sent", sms_disabled_followup: false },
      error: null,
    });
    // 08:00 AEST = 22:00 UTC previous day
    mockDateNow(22); // 22:00 UTC = 08:00 AEST ✓
    await followupSmsJob(BASE_DATA, makeLogger());
    expect(mockSendSms).toHaveBeenCalledOnce();
  });

  it("does not send at exactly 18:00 AEST (window end, exclusive)", async () => {
    mockLeadsSelect.mockResolvedValue({
      data: { status: "sent", sms_disabled_followup: false },
      error: null,
    });
    // 18:00 AEST = 08:00 UTC
    mockDateNow(8); // 08:00 UTC = 18:00 AEST ✗
    await followupSmsJob(BASE_DATA, makeLogger());
    expect(mockSendSms).not.toHaveBeenCalled();
  });

  // ── SMS body content ─────────────────────────────────────────────────────

  it("d3 body contains 'following up'", async () => {
    mockLeadsSelect.mockResolvedValue({
      data: { status: "sent", sms_disabled_followup: false },
      error: null,
    });
    mockDateNow(IN_WINDOW_UTC_H);
    await followupSmsJob({ ...BASE_DATA, stage: "d3" }, makeLogger());
    const callBody = mockSendSms.mock.calls[0][1] as string;
    expect(callBody.toLowerCase()).toContain("following up");
  });

  it("d7 body contains 'last follow-up'", async () => {
    mockLeadsSelect.mockResolvedValue({
      data: { status: "sent", sms_disabled_followup: false },
      error: null,
    });
    mockDateNow(IN_WINDOW_UTC_H);
    await followupSmsJob({ ...BASE_DATA, stage: "d7" }, makeLogger());
    const callBody = mockSendSms.mock.calls[0][1] as string;
    expect(callBody.toLowerCase()).toContain("last follow-up");
  });

  it("SMS body is never longer than 160 chars", async () => {
    mockLeadsSelect.mockResolvedValue({
      data: { status: "sent", sms_disabled_followup: false },
      error: null,
    });
    mockDateNow(IN_WINDOW_UTC_H);
    await followupSmsJob(BASE_DATA, makeLogger());
    const callBody = mockSendSms.mock.calls[0][1] as string;
    expect(callBody.length).toBeLessThanOrEqual(160);
  });

  // ── Error handling ───────────────────────────────────────────────────────

  it("rethrows sendSms errors (BullMQ retry)", async () => {
    mockLeadsSelect.mockResolvedValue({
      data: { status: "sent", sms_disabled_followup: false },
      error: null,
    });
    mockDateNow(IN_WINDOW_UTC_H);
    mockSendSms.mockRejectedValueOnce(new Error("Twilio timeout"));
    await expect(followupSmsJob(BASE_DATA, makeLogger())).rejects.toThrow("Twilio timeout");
  });
});
