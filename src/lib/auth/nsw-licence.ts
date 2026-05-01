/**
 * NSW Fair Trading contractor licence validation
 * Stack contract: external_integrations.service_nsw.method=rest
 *                 security.nsw_licence_binding=required
 *
 * Service NSW Fair Trading REST API:
 *   GET https://api.nsw.gov.au/v1/lfwsp/search/licence?licenceNumber={n}
 *
 * Per NFR-019:
 *   - Every new crew validated at onboarding
 *   - Quote send blocked if licence_verified = false
 *   - Redis cache 24h for read-mostly lookups
 *
 * Per docs/02-system-requirements.md A3:
 *   If API unavailable → throw (caller blocks onboarding with retry CTA)
 *
 * Docs:
 *   https://api.nsw.gov.au/product/nsw-fair-trading-licence-search
 */

import { logger } from "@/lib/logger";

export interface LicenceValidationResult {
  valid: boolean;
  expires_at?: string | null;   // ISO 8601
  licence_holder_name?: string | null;
  error?: string;
}

const NSW_API_BASE =
  "https://api.nsw.gov.au/v1/lfwsp/search/licence";

/**
 * Validate a NSW contractor licence number against the Service NSW API.
 * Throws on network/auth errors (caller should return 503 to the user).
 */
export async function validateNswLicence(
  licenceNumber: string
): Promise<LicenceValidationResult> {
  const apiKey = process.env.SERVICE_NSW_API_KEY;
  if (!apiKey) {
    throw new Error("SERVICE_NSW_API_KEY not configured");
  }

  const url = `${NSW_API_BASE}?licenceNumber=${encodeURIComponent(licenceNumber)}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: {
        "apikey": apiKey,
        "Accept": "application/json",
      },
      signal: AbortSignal.timeout(8000), // 8s timeout
    });
  } catch (err) {
    logger.error({ licenceNumber: "[redacted]", err }, "Service NSW API fetch error");
    throw new Error("Service NSW API unavailable");
  }

  if (response.status === 404) {
    return { valid: false, error: "Licence number not found" };
  }

  if (!response.ok) {
    logger.error(
      { status: response.status, licenceNumber: "[redacted]" },
      "Service NSW API returned error"
    );
    throw new Error(`Service NSW API error: ${response.status}`);
  }

  let data: NswLicenceApiResponse;
  try {
    data = (await response.json()) as NswLicenceApiResponse;
  } catch {
    throw new Error("Service NSW API returned invalid JSON");
  }

  // Response structure per Service NSW Fair Trading Licence Search API
  // https://api.nsw.gov.au/product/nsw-fair-trading-licence-search
  const licence = data.licences?.[0];
  if (!licence) {
    return { valid: false, error: "Licence number not found" };
  }

  // Check licence status is active
  const isActive = licence.licenceStatus?.toLowerCase() === "active";
  if (!isActive) {
    return {
      valid: false,
      error: `Licence is ${licence.licenceStatus ?? "unknown"} — must be Active`,
    };
  }

  // Check the licence covers contractor work (residential building work in NSW)
  // Licence types: Contractor Licence, Tradesperson Certificate, Owner Builder Permit
  const isContractor =
    licence.licenceType
      ?.toLowerCase()
      .includes("contractor") ?? false;

  if (!isContractor) {
    return {
      valid: false,
      error: "Licence type must be a Contractor Licence",
    };
  }

  return {
    valid: true,
    expires_at: licence.expiryDate ?? null,
    licence_holder_name: licence.holderName ?? null,
  };
}

// ---------------------------------------------------------------------------
// Service NSW API response type (partial)
// ---------------------------------------------------------------------------
interface NswLicenceApiResponse {
  licences?: Array<{
    licenceNumber?: string;
    licenceType?: string;
    licenceStatus?: string;
    holderName?: string;
    expiryDate?: string;    // ISO 8601 date
    issueDate?: string;
    tradeCategoryDescription?: string;
  }>;
}
