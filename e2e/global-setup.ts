/**
 * Playwright global setup — sign in once with the test phone and persist
 * the resulting cookies + localStorage to a file. Every test then loads
 * that storage state so it starts in an authenticated context.
 *
 * We hit the app's POST /api/auth/otp endpoint directly (rather than driving
 * the browser UI) because that endpoint has the exact same Supabase SSR
 * cookie wire-up the deployed pages use. One round-trip, no UI flake.
 *
 * No-ops when E2E_TEST_PHONE/E2E_TEST_OTP_SECRET aren't set — the empty
 * storage state we still write means tests using the file as fixture
 * don't fail to load.
 */

import { request, type FullConfig } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";

export const STORAGE_STATE_PATH = path.join(
  process.cwd(),
  "playwright",
  ".auth",
  "user.json"
);

function writeEmptyState() {
  fs.mkdirSync(path.dirname(STORAGE_STATE_PATH), { recursive: true });
  fs.writeFileSync(
    STORAGE_STATE_PATH,
    JSON.stringify({ cookies: [], origins: [] })
  );
}

async function globalSetup(config: FullConfig) {
  const phone = process.env.E2E_TEST_PHONE;
  const otp = process.env.E2E_TEST_OTP_SECRET;
  if (!phone || !otp) {
    console.log(
      "[global-setup] E2E_TEST_PHONE / E2E_TEST_OTP_SECRET not set — writing empty storage state"
    );
    writeEmptyState();
    return;
  }

  const baseURL =
    process.env.PLAYWRIGHT_BASE_URL ||
    config.projects[0]?.use?.baseURL ||
    "http://localhost:3000";

  console.log(`[global-setup] signing in ${phone} against ${baseURL}`);

  // Use Playwright's request fixture so the cookies are stored in a real
  // browser-shaped jar that we can dump to a storage state.
  const ctx = await request.newContext({ baseURL });

  try {
    // Step 1 — start OTP. With the test phone in Supabase sms_test_otp,
    // no real SMS is sent.
    const startRes = await ctx.post("/api/auth/otp", {
      headers: { "Content-Type": "application/json" },
      data: { phone, action: "send" },
    });
    if (!startRes.ok()) {
      throw new Error(
        `OTP start failed: HTTP ${startRes.status()} — ${await startRes.text()}`
      );
    }

    // Step 2 — verify with the static test code. The route handler
    // sets the Supabase SSR auth cookie on the response, which Playwright's
    // request context retains in its cookie jar.
    const verifyRes = await ctx.post("/api/auth/otp", {
      headers: { "Content-Type": "application/json" },
      data: { phone, token: otp },
    });
    if (!verifyRes.ok()) {
      throw new Error(
        `OTP verify failed: HTTP ${verifyRes.status()} — ${await verifyRes.text()}`
      );
    }

    const verifyJson = await verifyRes.json().catch(() => ({}));
    if (!verifyJson?.access_token) {
      throw new Error(
        `OTP verify succeeded but no access_token in response: ${JSON.stringify(verifyJson).slice(0, 200)}`
      );
    }

    // Step 3 — persist the cookie jar as Playwright storage state.
    fs.mkdirSync(path.dirname(STORAGE_STATE_PATH), { recursive: true });
    await ctx.storageState({ path: STORAGE_STATE_PATH });

    // Sanity check: the file should now contain the sb-{ref}-auth-token cookie.
    const state = JSON.parse(fs.readFileSync(STORAGE_STATE_PATH, "utf-8"));
    const authCookie = (state.cookies || []).find(
      (c: { name: string }) => /^sb-.*-auth-token/.test(c.name)
    );
    if (!authCookie) {
      throw new Error(
        "Auth cookie was not written to storage state. Cookie names: " +
          (state.cookies || []).map((c: { name: string }) => c.name).join(", ")
      );
    }
    console.log(
      `[global-setup] saved authed storage to ${STORAGE_STATE_PATH} (cookie: ${authCookie.name})`
    );
  } catch (err) {
    console.error("[global-setup] sign-in failed:", err);
    writeEmptyState();
    throw err;
  } finally {
    await ctx.dispose();
  }
}

export default globalSetup;
