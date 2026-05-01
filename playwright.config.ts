import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E configuration — QuotingAgent
 * Stack: Next.js 15 App Router, Supabase auth, mobile-first PWA
 * Coverage target: wedge flow (photo→SMS quote <5 min), auth, error states, responsive
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ["html", { open: "never", outputFolder: "playwright-report" }],
    ["list"],
  ],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    screenshot: "only-on-failure",
    trace: "on-first-retry",
    video: "on-first-retry",
  },
  projects: [
    {
      name: "desktop-chrome",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 720 },
      },
    },
    // mobile-safari (WebKit) needs GTK4/libavif/libflite system libs.
    // Off by default; CI installs the deps. Set ENABLE_WEBKIT=1 to opt-in locally.
    ...(process.env.ENABLE_WEBKIT
      ? [
          {
            name: "mobile-safari",
            use: { ...devices["iPhone 14"] },
          },
        ]
      : []),
    {
      name: "mobile-android",
      use: {
        ...devices["Pixel 7"],
      },
    },
  ],
  webServer: process.env.SKIP_WEB_SERVER
    ? undefined
    : {
        command: "npm run dev",
        port: 3000,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        stdout: "pipe",
        stderr: "pipe",
      },
});

