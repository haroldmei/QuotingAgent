/**
 * Unit tests for NSW licence validator
 * Stack contract: testing.unit=vitest, external_integrations.service_nsw.method=rest
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { validateNswLicence } from "@/lib/auth/nsw-licence";

// ---------------------------------------------------------------------------
// Mock fetch
// ---------------------------------------------------------------------------
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const ACTIVE_CONTRACTOR_RESPONSE = {
  licences: [
    {
      licenceNumber: "BLD123456",
      licenceType: "Contractor Licence",
      licenceStatus: "Active",
      holderName: "John Smith",
      expiryDate: "2027-12-31",
      issueDate: "2022-01-01",
    },
  ],
};

beforeEach(() => {
  process.env.SERVICE_NSW_API_KEY = "test-api-key";
  mockFetch.mockReset();
});

afterEach(() => {
  delete process.env.SERVICE_NSW_API_KEY;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("validateNswLicence", () => {
  it("returns valid=true for an active contractor licence", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ACTIVE_CONTRACTOR_RESPONSE,
    });

    const result = await validateNswLicence("BLD123456");

    expect(result.valid).toBe(true);
    expect(result.expires_at).toBe("2027-12-31");
    expect(result.licence_holder_name).toBe("John Smith");
  });

  it("returns valid=false for a 404 (licence not found)", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({}),
    });

    const result = await validateNswLicence("INVALID123");

    expect(result.valid).toBe(false);
    expect(result.error).toContain("not found");
  });

  it("returns valid=false for an expired/suspended licence", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        licences: [
          {
            licenceNumber: "BLD999999",
            licenceType: "Contractor Licence",
            licenceStatus: "Suspended",
            holderName: "Bad Actor",
          },
        ],
      }),
    });

    const result = await validateNswLicence("BLD999999");

    expect(result.valid).toBe(false);
    expect(result.error).toContain("Suspended");
  });

  it("returns valid=false for a non-contractor licence type", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        licences: [
          {
            licenceNumber: "OB999999",
            licenceType: "Owner Builder Permit",
            licenceStatus: "Active",
            holderName: "Home Owner",
          },
        ],
      }),
    });

    const result = await validateNswLicence("OB999999");

    expect(result.valid).toBe(false);
    expect(result.error).toContain("Contractor Licence");
  });

  it("throws on API 500 error (caller returns 503)", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({}),
    });

    await expect(validateNswLicence("BLD123456")).rejects.toThrow();
  });

  it("throws on network error (caller returns 503)", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    await expect(validateNswLicence("BLD123456")).rejects.toThrow();
  });

  it("throws when SERVICE_NSW_API_KEY is not set", async () => {
    delete process.env.SERVICE_NSW_API_KEY;

    await expect(validateNswLicence("BLD123456")).rejects.toThrow(
      "SERVICE_NSW_API_KEY not configured"
    );
  });

  it("returns valid=false when licences array is empty", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ licences: [] }),
    });

    const result = await validateNswLicence("BLD000000");

    expect(result.valid).toBe(false);
    expect(result.error).toContain("not found");
  });
});
