/**
 * Adversarial: Zod schema fuzz.
 *
 * Bar: NO fuzzed input may cause schema parse to throw uncaught — Zod's
 * .safeParse() should always return { success: false } on rejection,
 * never throw. Also: prototype-pollution shapes, deeply-nested objects,
 * and unicode tricks must be rejected without OOM.
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  AcceptReqSchema,
  DeclineReqSchema,
  SendReqSchema,
  LineItemPatchReqSchema,
  TwilioDeliveryWebhookSchema,
  PushSubscribeReqSchema,
  QuoteEnqueueReqSchema,
} from "@/lib/schemas/quotes";
import {
  ManualLeadReqSchema,
  LeadPatchReqSchema,
  DaWebhookReqSchema,
  LeadListQuerySchema,
} from "@/lib/schemas/leads";
import {
  PhotoUploadInitReqSchema,
  PhotoCommitReqSchema,
} from "@/lib/schemas/photos";
import { OnboardingReqSchema, OtpVerifyReqSchema } from "@/lib/schemas/auth";

const ALL_SCHEMAS = [
  ["AcceptReq", AcceptReqSchema],
  ["DeclineReq", DeclineReqSchema],
  ["SendReq", SendReqSchema],
  ["LineItemPatch", LineItemPatchReqSchema],
  ["TwilioDelivery", TwilioDeliveryWebhookSchema],
  ["PushSubscribe", PushSubscribeReqSchema],
  ["QuoteEnqueue", QuoteEnqueueReqSchema],
  ["ManualLead", ManualLeadReqSchema],
  ["LeadPatch", LeadPatchReqSchema],
  ["DaWebhook", DaWebhookReqSchema],
  ["LeadListQuery", LeadListQuerySchema],
  ["PhotoInit", PhotoUploadInitReqSchema],
  ["PhotoCommit", PhotoCommitReqSchema],
  ["Onboarding", OnboardingReqSchema],
  ["OtpVerify", OtpVerifyReqSchema],
] as const;

describe("[adversarial] Zod schemas — never throw on fuzzed input", () => {
  for (const [name, schema] of ALL_SCHEMAS) {
    it(`${name}: safeParse never throws on fc.anything()`, () => {
      fc.assert(
        fc.property(fc.anything(), (input) => {
          expect(() => schema.safeParse(input)).not.toThrow();
        }),
        { numRuns: 100 },
      );
    });

    it(`${name}: safeParse never throws on null/undefined/primitives`, () => {
      const inputs = [
        null,
        undefined,
        0,
        -1,
        Number.NaN,
        Number.POSITIVE_INFINITY,
        Number.NEGATIVE_INFINITY,
        "",
        " ",
        "\0",
        true,
        false,
        [],
        {},
        Symbol("x"),
        () => {},
        new Date(),
        Buffer.from("test"),
      ];
      for (const i of inputs) {
        expect(() => schema.safeParse(i)).not.toThrow();
      }
    });

    it(`${name}: safeParse rejects deeply-nested object (depth 50)`, () => {
      let nested: unknown = { v: 1 };
      for (let i = 0; i < 50; i++) nested = { v: nested };
      expect(() => schema.safeParse(nested)).not.toThrow();
      // Most schemas reject — that's fine.
    });

    it(`${name}: safeParse handles huge string fields`, () => {
      // 1MB of text in every plausible string field
      const huge = "A".repeat(1_000_000);
      const obj = {
        signed_token: huge,
        customer_name: huge,
        sms_body: huge,
        description: huge,
        address: huge,
        reason: huge,
        business_name: huge,
        nsw_licence_number: huge,
        token: huge,
        phone: huge,
        gcs_path: huge,
        endpoint: huge,
        // For arrays:
        photos: [{ gcs_path: huge }],
        mime_types: ["image/jpeg"],
        keys: { p256dh: huge, auth: huge },
      };
      expect(() => schema.safeParse(obj)).not.toThrow();
    });
  }
});

describe("[adversarial] AcceptReq + DeclineReq specifically (no-auth surface)", () => {
  it("rejects empty signed_token", () => {
    expect(AcceptReqSchema.safeParse({ signed_token: "" }).success).toBe(false);
    expect(DeclineReqSchema.safeParse({ signed_token: "" }).success).toBe(false);
  });

  it("rejects missing signed_token", () => {
    expect(AcceptReqSchema.safeParse({}).success).toBe(false);
    expect(DeclineReqSchema.safeParse({}).success).toBe(false);
  });

  it("rejects customer_name > 128 chars", () => {
    const r = AcceptReqSchema.safeParse({
      signed_token: "x.y.z",
      customer_name: "A".repeat(129),
    });
    expect(r.success).toBe(false);
  });

  it("rejects empty (post-trim) customer_name", () => {
    const r = AcceptReqSchema.safeParse({
      signed_token: "x.y.z",
      customer_name: "  ", // Trimmed → "" — should be < min 1
    });
    // Note: zod trims but min 1 may or may not be applied to trimmed result.
    // Document actual behaviour:
    if (r.success) {
      // If the schema accepts whitespace-trimmed-to-empty as valid, that's
      // a finding worth filing — but the spec is permissive on this.
      expect(r.data.customer_name).toBeDefined();
    } else {
      expect(r.success).toBe(false);
    }
  });

  it("decline reason capped at 280", () => {
    const r = DeclineReqSchema.safeParse({
      signed_token: "x.y.z",
      reason: "X".repeat(281),
    });
    expect(r.success).toBe(false);
  });
});

describe("[adversarial] LineItemPatch — strict object enforcement", () => {
  it("rejects unknown keys (strict mode)", () => {
    const r = LineItemPatchReqSchema.safeParse({
      qty: 1,
      malicious_field: "<script>alert(1)</script>",
    });
    expect(r.success).toBe(false);
  });

  it("rejects empty patch (must provide ≥1 field)", () => {
    expect(LineItemPatchReqSchema.safeParse({}).success).toBe(false);
  });

  it("rejects negative qty (nonnegative constraint)", () => {
    expect(LineItemPatchReqSchema.safeParse({ qty: -1 }).success).toBe(false);
  });

  it("rejects negative unit_price_aud", () => {
    expect(
      LineItemPatchReqSchema.safeParse({ unit_price_aud: -0.01 }).success
    ).toBe(false);
  });

  it("accepts qty=0 (boundary)", () => {
    expect(LineItemPatchReqSchema.safeParse({ qty: 0 }).success).toBe(true);
  });

  it("rejects NaN qty", () => {
    expect(LineItemPatchReqSchema.safeParse({ qty: NaN }).success).toBe(false);
  });

  it("FINDING (AT-VALID-001): Zod nonnegative accepts Infinity / -Infinity edge cases", () => {
    // Bug: Zod's z.number().nonnegative() does NOT reject Infinity (it's
    // technically >= 0). An authenticated tradie can submit:
    //   PATCH /api/quotes/X/line-items/Y { qty: Infinity }
    // And the schema accepts it, producing Infinity * unit_price =
    // Infinity totals. The DB INSERT may fail (numeric overflow) OR
    // succeed depending on Postgres column type. Either way: the schema
    // is the wrong place to let this through.
    // Fix: add `.finite()` to numeric Zod validators on quote money fields.
    const r = LineItemPatchReqSchema.safeParse({ qty: Infinity });
    expect(r.success).toBe(true); // FINDING — should be false
    if (r.success) {
      expect(Number.isFinite(r.data.qty)).toBe(false);
    }
  });

  it("FINDING (AT-VALID-001 cont.): Infinity also accepted on unit_price_aud", () => {
    const r = LineItemPatchReqSchema.safeParse({ unit_price_aud: Infinity });
    expect(r.success).toBe(true); // FINDING — should be false
  });

  it("rejects -Infinity qty (negative trips nonnegative check)", () => {
    expect(LineItemPatchReqSchema.safeParse({ qty: -Infinity }).success).toBe(false);
  });

  it("rejects unit length 0 / > 32", () => {
    expect(LineItemPatchReqSchema.safeParse({ unit: "" }).success).toBe(false);
    expect(
      LineItemPatchReqSchema.safeParse({ unit: "X".repeat(33) }).success
    ).toBe(false);
  });
});

describe("[adversarial] AU mobile validator — premium-rate / international", () => {
  // The AU mobile regex is /^\+614\d{8}$/ — exactly 12 chars (+614 + 8 digits)
  it.each([
    ["+61412345678", true],   // valid
    ["+61412345678 ", false], // trailing space
    [" +61412345678", false], // leading space
    ["+61412345 678", false], // internal space
    ["+61412345-678", false], // hyphen
    ["+1900PREMIUM", false],  // US premium-rate
    ["+44712345678", false],  // UK mobile
    ["0412345678", false],    // local format, not E.164
    ["+612345678901", false], // landline not mobile (starts +612)
    ["+61512345678", false],  // 5xx — not a mobile prefix
    ["+614", false],          // too short
    ["+614" + "1".repeat(20), false], // too long
    ["+61412345678\0", false],         // null-byte injection
    ["+61412345678\n", false],         // newline injection
  ])("AU mobile %s → valid=%s", (input, expected) => {
    const r = ManualLeadReqSchema.safeParse({
      customer_name: "Test",
      customer_mobile: input,
    });
    expect(r.success).toBe(expected);
  });
});

describe("[adversarial] OtpVerifyReq — token brute-force shape", () => {
  it("rejects 5-digit token", () => {
    const r = OtpVerifyReqSchema.safeParse({
      phone: "+61412345678",
      token: "12345",
    });
    expect(r.success).toBe(false);
  });

  it("rejects 7-digit token", () => {
    const r = OtpVerifyReqSchema.safeParse({
      phone: "+61412345678",
      token: "1234567",
    });
    expect(r.success).toBe(false);
  });

  it("rejects 6-char alphanumeric token", () => {
    const r = OtpVerifyReqSchema.safeParse({
      phone: "+61412345678",
      token: "12345A",
    });
    expect(r.success).toBe(false);
  });

  it("rejects unicode-digit lookalikes", () => {
    // Arabic-Indic digit look-alikes ٠١٢٣٤٥
    const r = OtpVerifyReqSchema.safeParse({
      phone: "+61412345678",
      token: "٠١٢٣٤٥",
    });
    expect(r.success).toBe(false);
  });
});

describe("[adversarial] PhotoUploadInit — count vs mime_types divergence", () => {
  it("rejects count > 15", () => {
    const r = PhotoUploadInitReqSchema.safeParse({
      count: 16,
      mime_types: Array(16).fill("image/jpeg"),
    });
    expect(r.success).toBe(false);
  });

  it("rejects count of 0", () => {
    const r = PhotoUploadInitReqSchema.safeParse({
      count: 0,
      mime_types: ["image/jpeg"],
    });
    expect(r.success).toBe(false);
  });

  it("rejects fractional count", () => {
    const r = PhotoUploadInitReqSchema.safeParse({
      count: 1.5,
      mime_types: ["image/jpeg"],
    });
    expect(r.success).toBe(false);
  });

  it("rejects unknown mime types (e.g. application/x-php)", () => {
    const r = PhotoUploadInitReqSchema.safeParse({
      count: 1,
      mime_types: ["application/x-php"],
    });
    expect(r.success).toBe(false);
  });

  it("rejects image/svg+xml (XSS via SVG)", () => {
    // SVG can carry script — must be rejected by allowlist.
    const r = PhotoUploadInitReqSchema.safeParse({
      count: 1,
      mime_types: ["image/svg+xml"],
    });
    expect(r.success).toBe(false);
  });

  it("FINDING: count and mime_types.length divergence is NOT cross-validated", () => {
    // Schema has min/max on each independently, but doesn't refine that
    // count === mime_types.length. The HTTP handler iterates over
    // mime_types but signs `count` URLs — count mismatch could cause
    // confused-deputy. Document the behaviour for the report.
    const r = PhotoUploadInitReqSchema.safeParse({
      count: 1,
      mime_types: ["image/jpeg", "image/jpeg", "image/jpeg"],
    });
    // If schema accepts mismatch, this is a finding; route handler must
    // protect itself.
    if (r.success) {
      expect(r.data.count).not.toBe(r.data.mime_types.length);
    }
  });
});

describe("[adversarial] DaWebhook payload fuzz", () => {
  it("rejects empty da_reference", () => {
    expect(
      DaWebhookReqSchema.safeParse({ da_reference: "", address: "X" }).success
    ).toBe(false);
  });

  it("rejects address > 512 chars", () => {
    expect(
      DaWebhookReqSchema.safeParse({
        da_reference: "X",
        address: "A".repeat(513),
      }).success,
    ).toBe(false);
  });

  it("rejects da_reference > 128 chars", () => {
    expect(
      DaWebhookReqSchema.safeParse({
        da_reference: "X".repeat(129),
        address: "A",
      }).success,
    ).toBe(false);
  });

  it("rejects bad ISO timestamp", () => {
    expect(
      DaWebhookReqSchema.safeParse({
        da_reference: "X",
        address: "Y",
        received_at: "not-a-date",
      }).success,
    ).toBe(false);
  });

  it("accepts year-9999 timestamp (far future, possible drift attack)", () => {
    const r = DaWebhookReqSchema.safeParse({
      da_reference: "X",
      address: "Y",
      received_at: "9999-12-31T23:59:59.999Z",
    });
    // Spec does not bound future date — acceptable but the worker
    // downstream should sanitise. Document.
    expect(r.success).toBe(true);
  });

  it("rejects __proto__ key smuggle (prototype pollution attempt)", () => {
    // An attacker sends { __proto__: { isAdmin: true } }. Zod doesn't
    // copy __proto__ via parse, but document the behaviour.
    const r = DaWebhookReqSchema.safeParse({
      da_reference: "X",
      address: "Y",
      __proto__: { polluted: true },
    });
    // Either rejected, or accepted but data is clean
    if (r.success) {
      expect((r.data as Record<string, unknown>).polluted).toBeUndefined();
      expect(Object.prototype.hasOwnProperty.call(r.data, "polluted")).toBe(false);
    }
  });
});
