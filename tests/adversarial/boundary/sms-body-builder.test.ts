/**
 * Adversarial: buildQuoteSmsBody.
 *
 * SMS-cost wedge constraint (FR-017): body must be ≤ 160 chars to stay
 * a single segment. Each extra segment doubles Twilio cost. Unicode
 * (non-GSM-7) chars also force UCS-2, capping at 70 chars/segment.
 *
 * Attacks:
 *   1. Pathologically long customer / trade / address names
 *   2. Unicode in customer name forcing UCS-2 (RTL, emoji, smart quotes)
 *   3. Long quote URLs that swallow the budget
 *   4. Empty / whitespace-only customer name (substring tricks)
 *   5. Address with no comma — split(",")[0] is the entire address
 *   6. customerName.split(" ")[0] for lone-word and zero-space inputs
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { buildQuoteSmsBody } from "@/lib/sms/twilio";

// GSM-7 alphabet check — non-GSM7 chars force UCS-2 (70-char segments).
// We only assert overall ≤160 length here; segmentation is Twilio-side.

describe("[adversarial] buildQuoteSmsBody — boundary length", () => {
  const SHORT_LINK = "https://app.quotingagent.com.au/q/abc.123.def0";

  it("never returns > 160 chars", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 200 }),
        fc.string({ minLength: 0, maxLength: 200 }),
        fc.string({ minLength: 0, maxLength: 200 }),
        fc.string({ minLength: 0, maxLength: 200 }),
        (tradeName, customerName, address, link) => {
          const body = buildQuoteSmsBody(tradeName, customerName, address, link);
          expect(body.length).toBeLessThanOrEqual(160);
        },
      ),
      { numRuns: 500 },
    );
  });

  it("very long customer name does not blow the cap", () => {
    const body = buildQuoteSmsBody(
      "ACME Roofing",
      "Aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa Bbbbbbbbbbbbbbbb",
      "1 Long Street, Sydney, NSW 2000",
      SHORT_LINK,
    );
    expect(body.length).toBeLessThanOrEqual(160);
  });

  it("very long URL still within 160 chars (or hard-truncates)", () => {
    const longLink = "https://app.example.com/q/" + "A".repeat(200);
    const body = buildQuoteSmsBody("ACME", "Bob", "1 Main St", longLink);
    expect(body.length).toBeLessThanOrEqual(160);
  });

  it("empty inputs do not throw", () => {
    expect(() => buildQuoteSmsBody("", "", "", "")).not.toThrow();
  });

  it("customerName with no space — split(' ')[0] === entire name", () => {
    const body = buildQuoteSmsBody("ACME", "OneWord", "1 Main", SHORT_LINK);
    expect(body).toContain("OneWord");
  });

  it("customerName starting with space — split(' ')[0] === '' (greeting becomes 'Hi ,')", () => {
    const body = buildQuoteSmsBody("ACME", " Bob", "1 Main", SHORT_LINK);
    // FINDING-CANDIDATE: leading-space gives "Hi , ACME has sent..." with
    // an awkward double-space. Check we still produce a valid SMS, even
    // if cosmetically ugly.
    expect(body.length).toBeLessThanOrEqual(160);
    expect(body.length).toBeGreaterThan(0);
  });

  it("emoji in customer name (UCS-2 forced) — still ≤ 160 *chars* (Twilio counts code units)", () => {
    // 🦘 is U+1F998 — surrogate pair (2 UTF-16 code units). For SMS
    // segmentation Twilio counts code units; JS .length returns code units.
    const body = buildQuoteSmsBody(
      "ACME",
      "🦘🦘🦘🦘🦘🦘🦘🦘🦘🦘🦘🦘🦘🦘🦘",
      "1 Main",
      SHORT_LINK,
    );
    expect(body.length).toBeLessThanOrEqual(160);
  });

  it("RTL text in name does not break truncation", () => {
    const body = buildQuoteSmsBody(
      "ACME",
      "מַזָּל טוֹב",
      "1 Main",
      SHORT_LINK,
    );
    expect(body.length).toBeLessThanOrEqual(160);
  });

  it("address with no comma — split(',')[0] === full address", () => {
    const body = buildQuoteSmsBody(
      "ACME",
      "Bob",
      "1 Main Street Sydney 2000 No Comma",
      SHORT_LINK,
    );
    expect(body.length).toBeLessThanOrEqual(160);
  });

  it("hard-truncated body always ends with ellipsis when truncated", () => {
    const body = buildQuoteSmsBody(
      "VeryLongTradeName".repeat(20),
      "Bob",
      "1 Main",
      "https://example.com/" + "x".repeat(500),
    );
    expect(body.length).toBeLessThanOrEqual(160);
    if (body.length === 160) {
      expect(body.endsWith("...")).toBe(true);
    }
  });

  it("does not throw on null-byte-injected customer name", () => {
    expect(() =>
      buildQuoteSmsBody("ACME", "Bob\0\0", "1 Main", SHORT_LINK)
    ).not.toThrow();
  });

  it("never produces NaN length / undefined output", () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.string(),
        fc.string(),
        fc.string(),
        (a, b, c, d) => {
          const body = buildQuoteSmsBody(a, b, c, d);
          expect(typeof body).toBe("string");
          expect(Number.isFinite(body.length)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });
});
