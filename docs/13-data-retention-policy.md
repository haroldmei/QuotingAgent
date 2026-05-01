# Data Retention & Deletion Policy — QuotingAgent

> Version: 1.0 — 2026-05-01
> Phase: legal-compliance (build-product-v2 pipeline)
> Scope: All user data, compliance with Privacy Act 1988 (Cth) and Australian Privacy Principles (APP 11)

---

## 1. Overview

This document defines how long QuotingAgent retains personal data, when and how data is deleted, and the technical and procedural controls for compliance with APP 11 (data minimisation and retention limits).

**Key principle:** We retain data only as long as necessary for service delivery, legal compliance, or legitimate business purposes. All retention periods are subject to applicable law (NSW Home Building Act, statute of limitations, etc.).

---

## 2. Data Retention Periods (by data type)

### 2.1 Account & Profile Data

| Data Type | Retention Period | Deletion Trigger | Legal Basis |
|---|---|---|---|
| **Phone number** | While account is active | Account deletion | Service delivery |
| **Business name, trade type** | While account is active | Account deletion | Service delivery, compliance |
| **NSW Contractor Licence number** | While account is active | Account deletion | Service delivery, statutory compliance |
| **ABN** | While account is active | Account deletion | Service delivery, payment |
| **Default labour rate** | While account is active | Account deletion | Service delivery |
| **Account metadata** (created_at, last_login, etc.) | While account is active | Account deletion (soft-delete 30d, hard-delete after) | Service delivery |

**Soft-delete process:** Upon user request, the account is hidden from the UI immediately (`account.deleted_at = NOW()`). Hard-delete occurs 30 days later (batch job `scripts/daily-purge-soft-deleted.ts`). Users can recover within 30 days.

---

### 2.2 Lead & Quote Data

| Data Type | Retention Period | Deletion Trigger | Legal Basis |
|---|---|---|---|
| **Lead records** (customer name, address, description) | 2 years from quote send | Auto-purge 2y after `quote.sent_at` | Statutory warranty (NSW Home Building Act) |
| **Quotes** (line items, pricing, GST, totals) | 2 years from quote send | Auto-purge 2y after `quote.sent_at` | Statutory warranty claim period |
| **Quote PDF** | 2 years from quote send | Auto-purge 2y after `quote.sent_at`; before purge, moved to cold storage (GCS archive) | Statutory warranty, audit trail |
| **Customer acceptance records** | 7 years from acceptance | Auto-purge 7y after `quote_acceptance.accepted_at` | NSW Home Building Act §10O (dispute resolution period) |
| **FSM push records** (ServiceM8/Tradify) | 2 years from quote send | Auto-purge 2y after `quote.sent_at` | Service documentation |

**Statutory basis:** NSW Home Building Act 1989 requires statutory warranty claims to be available for 7 years from the date of acceptance. We retain acceptance records for the full 7 years. Quote records (materials, labour, pricing) are retained for 2 years (shorter than acceptance records because the quote itself is less critical than proof of acceptance).

---

### 2.3 Photos & Media

| Data Type | Retention Period | Deletion Trigger | Legal Basis |
|---|---|---|---|
| **Site photos** (on GCS) | 2 years from quote send | Auto-purge 2y after `quote.sent_at` | Service delivery, statutory warranty |
| **EXIF metadata** (GPS, timestamp, device) | 2 years from quote send | Auto-purge with photos | Privacy, statute of limitations |
| **PDF quote files** | 2 years from quote send; archive to cold storage (GCS archive) after 1 year | Auto-purge 2y after `quote.sent_at` | Service delivery, compliance |

**Cold storage:** Quotes older than 1 year are moved from GCS `quotingagent-prod` to `quotingagent-archive` (lower-cost, longer-term storage). They remain accessible for the 2-year period, then are deleted via automatic lifecycle policy.

---

### 2.4 Analytics & Logs

| Data Type | Retention Period | Deletion Trigger | Legal Basis |
|---|---|---|---|
| **PostHog analytics events** | 1 year (configurable in PostHog) | Auto-purge per PostHog retention policy | Product analytics, aggregate insights |
| **Sentry error logs** | 30 days | Auto-purge per Sentry retention policy | Error diagnostics, performance monitoring |
| **Pino application logs** | 30 days | Deleted by log aggregation pipeline | Security, debugging |
| **API request logs** | 7 days | Auto-purge per log retention policy | Security, rate-limit enforcement |

**PII redaction:** All logs are processed through Pino redaction transport (see §4.1) before storage. Customer names, phone numbers, addresses, and licence numbers are never written to logs.

---

### 2.5 SMS & Email Records

| Data Type | Retention Period | Deletion Trigger | Legal Basis |
|---|---|---|---|
| **SMS event records** (sent, delivered, failed, opened) | 2 years from quote send | Auto-purge 2y after `quote.sent_at` | Service delivery, dispute resolution |
| **Email delivery logs** | 2 years from quote send | Auto-purge 2y after `quote.sent_at` | Service delivery, fallback audit |
| **Twilio message SIDs** | 2 years from quote send | Auto-purge 2y after `quote.sent_at` | SMS delivery proof |

---

### 2.6 Payment & Subscription Records

| Data Type | Retention Period | Deletion Trigger | Legal Basis |
|---|---|---|---|
| **Stripe subscription records** (sub ID, status, billing cycles) | 7 years after subscription ends | Manual purge on request or auto-purge 7y after cancellation | Tax compliance (PAYG), Australian Taxation Office |
| **Stripe payment intent records** | 2 years after payment | Purged by Stripe per PCI-DSS | PCI-DSS compliance, tax documentation |
| **Card last 4 digits** | Never stored by QuotingAgent | N/A | PCI-DSS (Stripe stores, we don't) |
| **Invoices** (if issued) | 5 years after issue | Manual archive or purge per tax requirements | Australian Taxation Office, GST compliance |

**Note:** Stripe handles payment processing. We do NOT store full card details, only subscription status and Stripe customer IDs. Stripe's retention policy applies to their data; we follow our own retention period for `subscription_id` references.

---

### 2.7 FSM OAuth Tokens

| Data Type | Retention Period | Deletion Trigger | Legal Basis |
|---|---|---|---|
| **ServiceM8 OAuth tokens** (access + refresh) | While integration is active | Auto-revoke on account deletion or manual disconnect | Service delivery, user consent |
| **Tradify OAuth tokens** | While integration is active | Auto-revoke on account deletion or manual disconnect | Service delivery, user consent |
| **Token refresh history** | 30 days | Auto-purge 30d after last refresh | Security, token rotation audit |

**Encryption:** OAuth tokens are encrypted at rest using AES-256-GCM with keys in GCP Secret Manager.

---

### 2.8 Rate-Card Data (Bunnings/Reece Pricing)

| Data Type | Retention Period | Deletion Trigger | Legal Basis |
|---|---|---|---|
| **Rate card items** (SKU, description, price, fetched_at) | Indefinite (refreshed daily) | Manual deletion or auto-refresh | Service delivery, caching |
| **Rate card embeddings** (pgvector vectors) | Indefinite (refreshed daily) | Manual deletion or auto-refresh | Service delivery, AI retrieval |
| **Stale flag** (stale = true if not refreshed in 7d) | 7 days | Toggled daily by refresh job | Cache validity, user awareness |

**Note:** Rate cards are global (not per-user), so they are retained longer than user-specific data. Stale items are still available in quotes (with a "prices may be outdated" banner), ensuring backward compatibility.

---

### 2.9 Job Completion Records (Rate-Card Learning)

| Data Type | Retention Period | Deletion Trigger | Legal Basis |
|---|---|---|---|
| **Job completion entry** (quoted vs. invoiced amount, trade type) | 2 years from completion | Auto-purge 2y after `completed_at` | Service delivery, learning loop |
| **Aggregated margin data** | Indefinite (only used for future quotes) | Purged when job_completion is purged | Service improvement |

---

### 2.10 Push Notification Subscriptions

| Data Type | Retention Period | Deletion Trigger | Legal Basis |
|---|---|---|---|
| **Web Push endpoint** (VAPID keys, subscription object) | While app is installed | Auto-delete on logout or app uninstall | Service delivery, user consent |
| **Push delivery logs** | 30 days | Auto-purge per log policy | Delivery diagnostics |

---

## 3. Account Deletion Process

### 3.1 User-Initiated Deletion

A user can request account deletion via the app settings:

1. **Initiate:** User taps "Delete Account" in settings.
2. **Confirmation:** A modal asks "Are you sure? This cannot be undone." User must confirm.
3. **Soft-Delete:** Account is immediately hidden (`users.deleted_at = NOW()`), data is no longer accessible to the user.
4. **30-Day Window:** User can contact support to recover within 30 days (email `support@quotingagent.io`).
5. **Hard-Delete:** After 30 days, a nightly batch job (`scripts/daily-purge-soft-deleted.ts`) performs hard-delete:
   - Delete all `users` rows with `deleted_at < NOW() - interval '30 days'`
   - Delete all `leads`, `quotes`, `photos`, `quote_acceptance`, `sms_event` rows for those crews
   - Delete all `rate_card_item` rows (if user-specific) or flag as unused
   - Purge PDFs from GCS
   - Soft-delete `fsm_connection` rows (don't revoke live OAuth tokens; those are handled separately)

### 3.2 Admin-Initiated Deletion

QuotingAgent staff may delete an account if:
- User violates Terms of Service or Acceptable Use Policy
- Legal request (court order, police investigation)
- Licence is suspended or invalid
- User requests deletion and does not respond to recovery window

Same hard-delete process as above.

---

## 4. Data Export (Right to Portability)

Users can request a copy of their personal data via `GET /api/auth/export`.

### 4.1 Export Format

**Response:** JSON file containing:

```json
{
  "user": {
    "id": "uuid",
    "phone": "E.164",
    "created_at": "ISO8601",
    "deleted_at": "ISO8601 or null"
  },
  "crew": {
    "id": "uuid",
    "business_name": "string",
    "trade_type": "enum",
    "nsw_licence_number": "string",
    "licence_verified": "boolean",
    "abn": "string"
  },
  "leads": [
    {
      "id": "uuid",
      "source": "da | manual | inbound_sms",
      "customer_name": "string",
      "customer_mobile": "E.164",
      "address": "string",
      "description": "string",
      "created_at": "ISO8601",
      "updated_at": "ISO8601"
    }
  ],
  "quotes": [
    {
      "id": "uuid",
      "lead_id": "uuid",
      "status": "draft | approved | sent | accepted | declined",
      "line_items": [
        {
          "description": "string",
          "qty": "number",
          "unit": "string",
          "unit_price_aud": "number",
          "confidence_score": "integer 0-100"
        }
      ],
      "subtotal_aud": "number",
      "gst_aud": "number",
      "total_aud": "number",
      "licence_number": "string",
      "ai_cost_aud": "number",
      "created_at": "ISO8601",
      "sent_at": "ISO8601 or null"
    }
  ],
  "quote_acceptances": [
    {
      "quote_id": "uuid",
      "accepted_at": "ISO8601",
      "ip_address": "string",
      "user_agent": "string"
    }
  ],
  "job_completions": [
    {
      "lead_id": "uuid",
      "quoted_amount_aud": "number",
      "invoiced_amount_aud": "number or null",
      "completed_at": "ISO8601"
    }
  ],
  "fsm_connections": [
    {
      "provider": "servicem8 | tradify",
      "expires_at": "ISO8601 or null"
    }
  ]
}
```

### 4.2 Export Endpoint

- **Route:** `GET /api/auth/export`
- **Auth:** Supabase JWT (authenticated user only)
- **Rate limit:** 1 per hour per user
- **Response:** 200 + JSON file download
- **Error:** 401 if unauthenticated, 429 if rate limited

### 4.3 Implementation Notes

- Photos (GCS blobs) are NOT included in the JSON export. Users can request photos via `GET /api/leads/{id}/photos?export=true`, which returns signed URLs for all photos in that lead.
- Quotes are included without PDF content (PDF is generated on-demand via signed URL).
- The export is generated on-the-fly (not cached) and does not contain deleted/purged data.
- Export is encrypted in transit (HTTPS) and may contain sensitive data; users should treat it as confidential.

---

## 5. Automated Deletion Jobs

### 5.1 Daily Purge Job

**Script:** `scripts/daily-purge-soft-deleted.ts`

Runs every day at 00:30 UTC (4:30 AM AEST):

```bash
# Pseudocode
SELECT users WHERE deleted_at < NOW() - interval '30 days'
FOR EACH user:
  DELETE leads, quotes, photos, quote_acceptance, sms_event, job_completion WHERE crew_id = user.crew_id
  DELETE gcs objects in bucket WHERE prefix = crew_id/
  DELETE users WHERE id = user.id
  Log to Sentry: "Account purged: {crew_id}"
```

**Idempotent:** Safe to run multiple times (DELETE WHERE already guarantees no duplicates).

### 5.2 Quote Purge Job

**Script:** `scripts/daily-purge-old-quotes.ts`

Runs every day at 01:00 UTC (5:00 AM AEST):

```bash
# Pseudocode
SELECT quotes WHERE sent_at < NOW() - interval '2 years'
FOR EACH quote:
  DELETE quote_line_item, sms_event, quote_ai_usage WHERE quote_id = quote.id
  DELETE gcs object quote_pdf.pdf (move to archive if requested)
  DELETE quote WHERE id = quote.id
  Log quota: deleted 1 quote
COMMIT
```

**Archive:** Before deletion, PDFs older than 1 year (but < 2 years) are moved to `gs://quotingagent-archive/` for long-term compliance retention.

### 5.3 Acceptance Record Purge Job

**Script:** `scripts/daily-purge-old-acceptances.ts`

Runs every day at 01:30 UTC (5:30 AM AEST):

```bash
# Pseudocode
SELECT quote_acceptance WHERE retention_until < TODAY()
FOR EACH acceptance:
  DELETE quote_acceptance WHERE id = acceptance.id
COMMIT
```

(Retention period is set at creation time: `retention_until = accepted_at + 7 years`.)

### 5.4 Log Purge (Handled by Infrastructure)

- **Pino logs:** Rotated daily, deleted after 30 days (handled by log aggregation)
- **Sentry events:** Purged per Sentry retention policy (default 30d for free tier)
- **PostHog events:** Purged per PostHog retention policy (default 1y, configurable)
- **API request logs (Vercel):** Purged per Vercel platform default (typically 3 days)

---

## 6. Data Minimisation Best Practices

To comply with APP 1.2 (only collect personal information needed for function):

### 6.1 Data Collection

- ✅ Collect only: phone, business name, trade type, licence number, ABN, labour rate, photos, lead details
- ✅ Do NOT collect: SSN, date of birth, income, credit score, family info
- ✅ Do NOT collect: EXIF GPS without user consent (but we do — disclosed in onboarding)

### 6.2 Data Sharing

- ✅ Share with vendors ONLY when necessary: Anthropic (photos), Twilio (SMS), Stripe (payment)
- ✅ Do NOT share with 3rd-party advertisers, brokers, or data brokers
- ✅ Do NOT sell user data

### 6.3 Data Retention

- ✅ Delete old quotes (2 years), acceptance records (7 years per law), logs (30 days)
- ✅ Do NOT retain indefinitely unless legally required

---

## 7. Compliance Checklist

- [ ] **APP 11 (data retention):** Retention periods documented (§2), automated deletion jobs tested (§5)
- [ ] **NSW Home Building Act:** Acceptance records retained 7 years (§2.2)
- [ ] **Statute of limitations:** Quote records retained 2 years (covers contract disputes)
- [ ] **Right to portability:** Export endpoint implemented (§4)
- [ ] **Right to erasure:** Account deletion process documented (§3)
- [ ] **PII redaction:** Logs have no PII (Pino redaction transport in use)
- [ ] **Cold storage:** PDFs > 1 year moved to cheaper archive (§2.3)
- [ ] **Idempotency:** Delete jobs are safe to re-run
- [ ] **Monitoring:** Sentry alerts if delete job fails

---

## 8. Legal Review

> **DISCLAIMER:** This policy is a template and must be reviewed by a qualified Australian privacy lawyer before launch. Actual retention periods may differ based on:
> 
> - Industry-specific regulations (some trades may require longer retention)
> - Customer contracts (may require longer retention)
> - Litigation holds (data subject to legal hold must not be deleted)
> - Tax requirements (invoice/payment records may require 5+ years)

---

## 9. Contact & Questions

For questions about data retention or deletion:

- **Privacy:** privacy@quotingagent.io
- **Data deletion:** support@quotingagent.io
- **Legal holds:** legal@quotingagent.io

---

*Document end. Next review: 2026-11-01 (quarterly review per contract §4).*
