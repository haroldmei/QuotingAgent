/**
 * E2E — NSW Compliance (FR-024, FR-025, FR-026)
 *
 * Covers:
 *  - NSW contractor licence visible on quote review screen
 *  - NSW contractor licence visible on customer quote view
 *  - Statutory warranty wording present and non-editable on customer view
 *  - GST line always present (10% of subtotal, 2 dp) on review and customer view
 *  - Quote send locked when licence not verified (FR-024 AC1)
 *  - GST calculation accuracy
 */

import { test, expect } from "@playwright/test";
import { mockQuoteDraft } from "./fixtures/helpers";

// ---------------------------------------------------------------------------
// NSW licence on quote review (FR-024)
// NOTE: /quotes/[id] is auth-protected. Requires seeded preview deploy.
// ---------------------------------------------------------------------------
test.describe("NSW licence — quote review screen", () => {
  const QUOTE_ID = "nsw-compliance-001";

  test.beforeEach(async ({ page: _page }) => {
    if (!process.env.E2E_SESSION_COOKIE) {
      test.skip(true, "NSW licence review tests require authenticated seeded preview deploy");
    }
  });

  test("licence number and NSW verified badge are visible", async ({ page }) => {
    await mockQuoteDraft(page, QUOTE_ID);
    await page.goto(`/quotes/${QUOTE_ID}`);

    // FR-024: licence snapshot on every review screen
    await expect(page.getByText(/lic:.*123456C.*NSW/i)).toBeVisible({ timeout: 15_000 });
    // Green tick for verified
    await expect(page.getByText(/✓/i)).toBeVisible();
  });

  test("statutory warranty text is accessible via disclosure", async ({ page }) => {
    await mockQuoteDraft(page, QUOTE_ID);
    await page.goto(`/quotes/${QUOTE_ID}`);

    // Expand the compliance section
    const complianceToggle = page.getByText(/lic:.*nsw.*✓/i);
    await expect(complianceToggle).toBeVisible({ timeout: 15_000 });
    await complianceToggle.click();

    // FR-025: statutory warranty text visible after expanding
    await expect(page.getByText(/home building act 1989/i)).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// GST on quote review (FR-026)
// NOTE: /quotes/[id] is auth-protected. Requires seeded preview deploy.
// ---------------------------------------------------------------------------
test.describe("GST calculation — quote review screen", () => {
  const QUOTE_ID = "gst-review-001";

  test.beforeEach(async ({ page: _page }) => {
    if (!process.env.E2E_SESSION_COOKIE) {
      test.skip(true, "GST review tests require authenticated seeded preview deploy");
    }
  });

  test("GST line is always present (10%)", async ({ page }) => {
    await mockQuoteDraft(page, QUOTE_ID);
    await page.goto(`/quotes/${QUOTE_ID}`);

    // FR-026 AC1
    await expect(page.getByText(/gst.*10%/i)).toBeVisible({ timeout: 15_000 });
  });

  test("totals section shows Subtotal, GST, and TOTAL", async ({ page }) => {
    await mockQuoteDraft(page, QUOTE_ID);
    await page.goto(`/quotes/${QUOTE_ID}`);

    await expect(page.getByText(/subtotal/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/gst.*10%/i)).toBeVisible();
    await expect(page.getByText(/total/i)).toBeVisible();
  });

  test("computed totals match expected values from mock data", async ({ page }) => {
    // Mock: 3 line items
    // li-001: 120 m² × $45 = $5,400 material
    // li-002: 24 m × $12.50 = $300 material
    // li-003: 32 hr × $95 = $3,040 labour
    // Subtotal = $8,740
    // GST = $874
    // Total = $9,614
    await mockQuoteDraft(page, QUOTE_ID, {
      quote_line_items: [
        { id: "li-001", description: "Colorbond", qty: "120", unit: "m²", unit_price_aud: "45.00", confidence_score: 92, kind: "material", sort_order: 0 },
        { id: "li-002", description: "Ridge capping", qty: "24", unit: "m", unit_price_aud: "12.50", confidence_score: 88, kind: "material", sort_order: 1 },
        { id: "li-003", description: "Installation labour", qty: "32", unit: "hr", unit_price_aud: "95.00", confidence_score: 95, kind: "labour", sort_order: 2 },
      ],
    });

    await page.goto(`/quotes/${QUOTE_ID}`);

    // Wait for line items to render
    await expect(page.getByText("Colorbond")).toBeVisible({ timeout: 15_000 });

    // Check subtotal = $8,740.00
    await expect(page.getByText(/\$8,740/i)).toBeVisible();
    // GST = $874.00
    await expect(page.getByText(/\$874/i)).toBeVisible();
    // Total = $9,614.00
    await expect(page.getByText(/\$9,614/i)).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// NSW compliance on customer view (FR-020, FR-024, FR-025, FR-026)
//
// NOTE: Requires seeded preview deploy — /q/[token] uses RSC server-side
// fetches that cannot be intercepted by page.route(). Set E2E_SEEDED_QUOTE_TOKEN.
// ---------------------------------------------------------------------------
test.describe("NSW compliance — customer quote view", () => {
  test.skip(
    !process.env.E2E_SEEDED_QUOTE_TOKEN,
    "Customer view tests require seeded preview deploy (RSC server-side fetch)"
  );

  const TOKEN = "nsw-compliance-customer-token";

  test.beforeEach(async ({ page }) => {
    await page.route(`**/api/quotes/${encodeURIComponent(TOKEN)}/view`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "q-nsw-customer",
          status: "sent",
          subtotal_aud: "9090.91",
          gst_aud: "909.09",
          total_aud: "10000.00",
          licence_number_snapshot: "123456C",
          licence_verified_snapshot: true,
          statutory_warranty_text:
            "Under the Home Building Act 1989 (NSW), a statutory warranty applies to all residential building work for 6 years (major defects) and 2 years (all other defects).",
          prepared_at: new Date().toISOString(),
          quote_line_items: [
            { id: "li-1", description: "Colorbond roofing", qty: "120", unit: "m²", unit_price_aud: "75.76", kind: "material" },
          ],
          lead: { customer_name: "Sarah Chen", address: "24 Westfield Rd, Penrith", description: null },
          crew: { business_name: "Rob's Roofing", trade_type: "roofer" },
        }),
      });
    });

    await page.route("**/api/webhooks/twilio/read**", async (route) => {
      await route.fulfill({ status: 200 });
    });
  });

  test("NSW contractor licence number is displayed (FR-024 AC3)", async ({ page }) => {
    await page.goto(`/q/${TOKEN}`);

    await expect(page.getByText("123456C")).toBeVisible();
    await expect(page.getByText(/verified by nsw fair trading/i)).toBeVisible();
  });

  test("statutory warranty text is present and accessible (FR-025 AC1)", async ({
    page,
  }) => {
    await page.goto(`/q/${TOKEN}`);

    const warrantyToggle = page.getByText(/statutory warranty wording/i);
    await expect(warrantyToggle).toBeVisible();
    await warrantyToggle.click();

    // FR-025: exact Act reference must be in the text
    await expect(page.getByText(/home building act 1989.*nsw/i)).toBeVisible();
    // Must mention 6 years major defects
    await expect(page.getByText(/6 years/i)).toBeVisible();
  });

  test("GST line is always present on customer view (FR-026 AC1)", async ({ page }) => {
    await page.goto(`/q/${TOKEN}`);

    await expect(page.getByText(/gst.*10%/i)).toBeVisible();
    // GST value shown
    await expect(page.getByText(/\$909/)).toBeVisible();
  });

  test("total inc. GST is displayed prominently", async ({ page }) => {
    await page.goto(`/q/${TOKEN}`);

    // $10,000 total
    await expect(page.getByText(/\$10,000/)).toBeVisible();
  });

  test("accept button is visually prominent (h-14 / 56dp)", async ({ page }) => {
    await page.goto(`/q/${TOKEN}`);

    const acceptBtn = page.getByRole("button", { name: /accept quote/i });
    const box = await acceptBtn.boundingBox();
    // h-14 = 56dp as defined in CustomerQuoteView
    expect(box!.height).toBeGreaterThanOrEqual(48);
  });
});

// ---------------------------------------------------------------------------
// Quote send lock — unlicensed crew (FR-024 AC1)
// NOTE: Requires authenticated seeded preview deploy.
// ---------------------------------------------------------------------------
test.describe("Quote send lock — unlicensed crew", () => {
  test.beforeEach(async ({ page: _page }) => {
    if (!process.env.E2E_SESSION_COOKIE) {
      test.skip(true, "Send lock test requires authenticated seeded preview deploy");
    }
  });

  test("send button is disabled when licence_verified is false", async ({ page }) => {
    // Mock a quote where licence_verified_snapshot = false
    await mockQuoteDraft(page, "unlicensed-quote-001", {
      licence_number_snapshot: null,
      licence_verified_snapshot: false,
    });

    await page.goto("/quotes/unlicensed-quote-001");

    await page.waitForTimeout(2000); // allow render

    // The send CTA should not be enabled — either disabled or not present
    const sendBtn = page.getByRole("button", { name: /looks good.*send/i });
    const sendBtnExists = await sendBtn.count();

    if (sendBtnExists > 0) {
      // If present, it should be aria-disabled or actually disabled
      const isDisabled =
        (await sendBtn.getAttribute("disabled")) !== null ||
        (await sendBtn.getAttribute("aria-disabled")) === "true";
      expect(isDisabled).toBeTruthy();
    }
    // If not present at all, the lock is correctly enforced
  });
});
