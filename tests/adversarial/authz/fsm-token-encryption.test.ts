/**
 * Adversarial: FSM OAuth token AES-256-GCM encrypt/decrypt.
 *
 * Threat model:
 *   1. AuthTag forgery — can attacker tamper ciphertext, get valid plaintext?
 *   2. IV reuse → confidentiality break (under same key+IV+plaintext = same CT)
 *      Property: every encrypt of same plaintext produces a *different* CT
 *      because IV is random.
 *   3. Empty / huge plaintext round-trip
 *   4. Format-confusion (extra `:` in plaintext)
 *   5. Wrong key fails authentication
 */

import { describe, it, expect, beforeAll } from "vitest";
import {
  encryptOAuthToken,
  decryptOAuthToken,
} from "@/lib/services/fsm";
import fc from "fast-check";

beforeAll(() => {
  // 32-byte hex key for tests
  process.env.FSM_TOKEN_ENCRYPTION_KEY =
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
});

describe("[adversarial] FSM token encryption", () => {
  it("round-trips arbitrary plaintexts", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 0, maxLength: 5000 }), (pt) => {
        const ct = encryptOAuthToken(pt);
        expect(decryptOAuthToken(ct)).toBe(pt);
      }),
      { numRuns: 100 },
    );
  });

  it("produces different ciphertexts for the same plaintext (IV randomness)", () => {
    const pt = "secret-oauth-access-token";
    const ct1 = encryptOAuthToken(pt);
    const ct2 = encryptOAuthToken(pt);
    expect(ct1).not.toBe(ct2);
    // Both decrypt to the same value
    expect(decryptOAuthToken(ct1)).toBe(pt);
    expect(decryptOAuthToken(ct2)).toBe(pt);
  });

  it("rejects ciphertext with tampered authTag", () => {
    const ct = encryptOAuthToken("secret");
    const [iv, authTag, body] = ct.split(":");
    // Flip a bit in the authTag
    const flipped = (authTag![0] === "0" ? "1" : "0") + authTag!.slice(1);
    const tampered = `${iv}:${flipped}:${body}`;
    expect(() => decryptOAuthToken(tampered)).toThrow();
  });

  it("rejects ciphertext with tampered body bytes", () => {
    const ct = encryptOAuthToken("secret-very-long-padding-for-body-tampering-here");
    const [iv, authTag, body] = ct.split(":");
    const flipped = (body![0] === "0" ? "1" : "0") + body!.slice(1);
    const tampered = `${iv}:${authTag}:${flipped}`;
    expect(() => decryptOAuthToken(tampered)).toThrow();
  });

  it("rejects ciphertext with tampered IV", () => {
    const ct = encryptOAuthToken("secret");
    const [iv, authTag, body] = ct.split(":");
    const flipped = (iv![0] === "0" ? "1" : "0") + iv!.slice(1);
    const tampered = `${flipped}:${authTag}:${body}`;
    expect(() => decryptOAuthToken(tampered)).toThrow();
  });

  it("rejects malformed ciphertext (wrong number of segments)", () => {
    expect(() => decryptOAuthToken("only-one-segment")).toThrow();
    expect(() => decryptOAuthToken("a:b")).toThrow();
    expect(() => decryptOAuthToken("a:b:c:d")).toThrow();
  });

  it("rejects empty ciphertext", () => {
    expect(() => decryptOAuthToken("")).toThrow();
  });

  it("rejects non-hex segments", () => {
    expect(() => decryptOAuthToken("nothex:nothex:nothex")).toThrow();
  });

  it("encrypts unicode plaintext correctly (utf-8 round-trip)", () => {
    const pt = "🦘 token éñ 你好";
    expect(decryptOAuthToken(encryptOAuthToken(pt))).toBe(pt);
  });

  it("encrypts empty string and round-trips", () => {
    expect(decryptOAuthToken(encryptOAuthToken(""))).toBe("");
  });

  it("encrypts very long plaintext (10KB)", () => {
    const pt = "X".repeat(10_000);
    expect(decryptOAuthToken(encryptOAuthToken(pt))).toBe(pt);
  });

  it("decrypt with wrong key fails", () => {
    const ct = encryptOAuthToken("secret");
    process.env.FSM_TOKEN_ENCRYPTION_KEY =
      "1111111111111111111111111111111111111111111111111111111111111111";
    expect(() => decryptOAuthToken(ct)).toThrow();
    // restore
    process.env.FSM_TOKEN_ENCRYPTION_KEY =
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  });

  it("encrypt with wrong-length key throws", () => {
    process.env.FSM_TOKEN_ENCRYPTION_KEY = "tooShort";
    expect(() => encryptOAuthToken("secret")).toThrow();
    process.env.FSM_TOKEN_ENCRYPTION_KEY =
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  });
});
