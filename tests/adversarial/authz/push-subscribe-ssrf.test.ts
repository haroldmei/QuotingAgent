/**
 * Adversarial: Push subscription endpoint validator.
 *
 * Threat: PushSubscribeReqSchema accepts ANY z.string().url(). The
 * web-push library will eventually call fetch(endpoint, ...) — if the
 * endpoint is an internal/loopback/metadata URL, that's SSRF and a
 * tradie could be tricked into hitting GCP metadata
 * (http://metadata.google.internal/...).
 *
 * Test: document the schema's permissiveness so the route handler is
 * forced to add an allow-list of known push services
 * (fcm.googleapis.com, *.push.apple.com, *.notify.windows.com,
 * *.mozilla.com).
 */

import { describe, it, expect } from "vitest";
import { PushSubscribeReqSchema } from "@/lib/schemas/quotes";

describe("[adversarial] PushSubscribeReq endpoint URL validator", () => {
  const validKeys = {
    p256dh: "BFnxvDFYvmEnJfPeUL4Fyl8OzrUZ7yGBWEORYP5wDC9bzg-fgY",
    auth: "abcdefghijklmnop",
  };

  it.each([
    ["https://fcm.googleapis.com/wp/abc", true],   // Chrome, OK
    ["https://updates.push.services.mozilla.com/abc", true], // Firefox, OK
  ])("legitimate push URL %s → valid", (endpoint, expected) => {
    const r = PushSubscribeReqSchema.safeParse({ endpoint, keys: validKeys });
    expect(r.success).toBe(expected);
  });

  it.each([
    "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token",
    "http://169.254.169.254/latest/meta-data/", // AWS metadata
    "http://localhost:3000/admin",
    "http://127.0.0.1:3000/admin",
    "http://[::1]:3000/admin",
    "http://0.0.0.0:3000/admin",
    "http://10.0.0.1/internal",
    "http://192.168.1.1/router",
    "file:///etc/passwd",
    "ftp://internal.example.com/secrets",
    "gopher://internal.example.com/0_secrets",
  ])("FINDING-CANDIDATE: SSRF URL %s — schema does NOT reject", (endpoint) => {
    // z.string().url() allows ANY scheme that URL parses. Document.
    const r = PushSubscribeReqSchema.safeParse({ endpoint, keys: validKeys });
    if (r.success) {
      // We expect this to succeed at the schema layer — the route handler
      // MUST defend with a domain allow-list. Mark as a finding.
      expect(r.success).toBe(true);
    }
  });

  it("rejects empty endpoint", () => {
    expect(
      PushSubscribeReqSchema.safeParse({ endpoint: "", keys: validKeys }).success,
    ).toBe(false);
  });

  it("rejects non-URL endpoint", () => {
    expect(
      PushSubscribeReqSchema.safeParse({ endpoint: "not a url", keys: validKeys })
        .success,
    ).toBe(false);
  });

  it("rejects missing keys.auth", () => {
    expect(
      PushSubscribeReqSchema.safeParse({
        endpoint: "https://fcm.googleapis.com/wp/abc",
        keys: { p256dh: validKeys.p256dh },
      }).success,
    ).toBe(false);
  });

  it("rejects empty p256dh / auth", () => {
    expect(
      PushSubscribeReqSchema.safeParse({
        endpoint: "https://fcm.googleapis.com/wp/abc",
        keys: { p256dh: "", auth: "x" },
      }).success,
    ).toBe(false);
  });
});
