/**
 * Unit tests: fsm.ts
 * Covers AES-256-GCM token encryption/decryption and URL builders.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  encryptOAuthToken,
  decryptOAuthToken,
  getServiceM8AuthUrl,
  getTradifyAuthUrl,
} from "@/lib/services/fsm";

// 64-char hex (32-byte) test key
const TEST_KEY = "0".repeat(64);

describe("encryptOAuthToken / decryptOAuthToken", () => {
  beforeEach(() => {
    process.env.FSM_TOKEN_ENCRYPTION_KEY = TEST_KEY;
  });

  afterEach(() => {
    delete process.env.FSM_TOKEN_ENCRYPTION_KEY;
  });

  it("round-trips plaintext", () => {
    const plaintext = JSON.stringify({ accessToken: "abc123", refreshToken: "xyz" });
    const ciphertext = encryptOAuthToken(plaintext);
    expect(decryptOAuthToken(ciphertext)).toBe(plaintext);
  });

  it("produces ciphertext in iv:authTag:ct hex format", () => {
    const ct = encryptOAuthToken("hello");
    const parts = ct.split(":");
    expect(parts).toHaveLength(3);
    // IV = 12 bytes = 24 hex chars
    expect(parts[0]).toHaveLength(24);
    // Auth tag = 16 bytes = 32 hex chars
    expect(parts[1]).toHaveLength(32);
    // Ciphertext length matches plaintext byte length (hex = 2× bytes)
    expect(parts[2]).toHaveLength("hello".length * 2);
  });

  it("produces different ciphertexts each call (random IV)", () => {
    const a = encryptOAuthToken("same-plaintext");
    const b = encryptOAuthToken("same-plaintext");
    expect(a).not.toBe(b);
  });

  it("decrypts correctly for unicode plaintext", () => {
    const plaintext = "Hello 🌏 日本語";
    const ct = encryptOAuthToken(plaintext);
    expect(decryptOAuthToken(ct)).toBe(plaintext);
  });

  it("throws when FSM_TOKEN_ENCRYPTION_KEY is missing", () => {
    delete process.env.FSM_TOKEN_ENCRYPTION_KEY;
    expect(() => encryptOAuthToken("x")).toThrow("FSM_TOKEN_ENCRYPTION_KEY");
  });

  it("throws when FSM_TOKEN_ENCRYPTION_KEY is wrong length", () => {
    process.env.FSM_TOKEN_ENCRYPTION_KEY = "tooshort";
    expect(() => encryptOAuthToken("x")).toThrow("FSM_TOKEN_ENCRYPTION_KEY");
  });

  it("throws on tampered ciphertext (auth tag mismatch)", () => {
    // Encrypt with key set in beforeEach
    const ct = encryptOAuthToken("secret-data");
    // Flip the last char of the ciphertext section to break the GCM auth tag
    const parts = ct.split(":");
    const ctPart = parts[2]!;
    const lastChar = ctPart[ctPart.length - 1];
    parts[2] = ctPart.slice(0, -1) + (lastChar === "a" ? "b" : "a");
    // Key is still set, so decryptOAuthToken should fail on auth tag, not key lookup
    expect(() => decryptOAuthToken(parts.join(":"))).toThrow();
  });

  it("throws on malformed ciphertext (wrong number of parts)", () => {
    // Key is set via beforeEach — decryptOAuthToken will get to the format check
    expect(() => decryptOAuthToken("onlyone")).toThrow("Invalid encrypted token format");
    expect(() => decryptOAuthToken("a:b")).toThrow("Invalid encrypted token format");
    expect(() => decryptOAuthToken("a:b:c:d")).toThrow("Invalid encrypted token format");
  });
});

// ── OAuth URL builders ─────────────────────────────────────────────────────

describe("getServiceM8AuthUrl", () => {
  beforeEach(() => {
    process.env.SERVICEM8_CLIENT_ID = "sm8-test-client-id";
  });

  afterEach(() => {
    delete process.env.SERVICEM8_CLIENT_ID;
  });

  it("returns a URL pointing to ServiceM8", () => {
    const url = getServiceM8AuthUrl("csrf-state-123", "https://app.example.com/callback");
    expect(url).toContain("https://go.servicem8.com/oauth/authorize");
  });

  it("includes the state param", () => {
    const url = getServiceM8AuthUrl("my-state", "https://app.example.com/cb");
    expect(url).toContain("state=my-state");
  });

  it("includes the client_id param", () => {
    const url = getServiceM8AuthUrl("state", "https://app.example.com/cb");
    expect(url).toContain("client_id=sm8-test-client-id");
  });

  it("includes required scopes", () => {
    const url = getServiceM8AuthUrl("state", "https://app.example.com/cb");
    expect(url).toContain("scope=");
    expect(url).toContain("manage_jobs");
  });

  it("throws when SERVICEM8_CLIENT_ID is missing", () => {
    delete process.env.SERVICEM8_CLIENT_ID;
    expect(() => getServiceM8AuthUrl("state", "https://cb")).toThrow("SERVICEM8_CLIENT_ID");
  });
});

describe("getTradifyAuthUrl", () => {
  beforeEach(() => {
    process.env.TRADIFY_CLIENT_ID = "tradify-test-client-id";
  });

  afterEach(() => {
    delete process.env.TRADIFY_CLIENT_ID;
  });

  it("returns a URL pointing to Tradify", () => {
    const url = getTradifyAuthUrl("csrf-state", "https://app.example.com/callback");
    expect(url).toContain("https://tradifyhq.com/oauth/authorize");
  });

  it("includes the state param", () => {
    const url = getTradifyAuthUrl("my-state", "https://app.example.com/cb");
    expect(url).toContain("state=my-state");
  });

  it("throws when TRADIFY_CLIENT_ID is missing", () => {
    delete process.env.TRADIFY_CLIENT_ID;
    expect(() => getTradifyAuthUrl("state", "https://cb")).toThrow("TRADIFY_CLIENT_ID");
  });
});
