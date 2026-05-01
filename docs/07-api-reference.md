# API Reference — QuotingAgent

> **Version:** 1.0.0  
> **Date:** 2026-05-01  
> **Status:** Preview tier  
> **Scale tier:** Single AU region (Vercel syd1)

---

## Overview

### Base URLs

| Environment | URL |
|---|---|
| Local development | `http://localhost:3000/api` |
| Production (AU) | `https://app.quotingagent.com.au/api` |

### Authentication

- **Default:** Supabase JWT (Bearer token in `Authorization` header)
- **For public endpoints:** HMAC-SHA256 signed token in query parameter or request body
- **For webhooks:** Provider-specific signature headers (HMAC-SHA256 for DA; Twilio signature for SMS)

### Content-Type

- All endpoints accept and return `application/json` (except webhooks and tracking pixels)
- Phone numbers use E.164 format: `+614XXXXXXXX` (Australian mobile)

### Rate Limits

All rate limits use sliding-window algorithm (Upstash Redis) and return `Retry-After` header on 429.

| Endpoint | Limit | Per |
|---|---|---|
| `/auth/otp` (start) | 5/hr | phone number |
| `/auth/otp` (verify) | 10/hr | phone number |
| `/auth/onboarding` | 20/hr | user |
| `/crew/licence-validate` | 30/hr | crew |
| `/leads` (GET) | 600/hr | crew |
| `/leads` (POST) | 200/hr | crew |
| `/leads/{id}/photos` | 200/hr | crew |
| `/leads/{id}/quote` (POST) | 100/day | crew |
| `/quotes/{id}/send` | 100/day | crew |
| `/quotes/{id}/accept` | 10/min | IP |
| `/quotes/{id}/decline` | 10/min | IP |
| `/quotes/{id}/view` | 60/min | IP |
| `/webhooks/da-lead` | 1000/min | IP |
| `/webhooks/twilio/*` | 1000/min | IP |
| `/fsm/{provider}/oauth/start` | 30/hr | crew |
| `/notifications/push/subscribe` | — | user |

---

## API Endpoints by Functional Requirement

### Authentication & Onboarding

| FR | Method | Endpoint | Tag |
|---|---|---|---|
| FR-001 | POST | `/auth/otp` | OTP sign-up / verify |
| FR-002 | POST | `/auth/onboarding` | Profile setup + licence validation |
| FR-003 | POST | `/auth/otp` (returning user) | Sign-in |
| [special] | POST | `/crew/licence-validate` | Re-validate licence (settings) |

### Lead Management

| FR | Method | Endpoint | Tag |
|---|---|---|---|
| FR-004 | GET | `/leads` | List leads (tray) |
| FR-005 | GET | `/leads/{id}` | Lead detail |
| FR-005 | PATCH | `/leads/{id}` | Update lead |
| FR-006 | POST | `/webhooks/da-lead` | DA lead ingest |
| FR-007 | POST | `/leads` | Manual lead entry |
| FR-029 | POST | `/leads/{id}/complete` | Mark job complete (rate-card learning) |

### Photos

| FR | Method | Endpoint | Tag |
|---|---|---|---|
| FR-008 | POST | `/leads/{id}/photos?action=init` | Request upload URLs (camera) |
| FR-008 | POST | `/leads/{id}/photos?action=commit` | Commit uploaded photos |
| FR-009 | POST | `/leads/{id}/photos?action=init` | Request upload URLs (gallery) |
| FR-009 | POST | `/leads/{id}/photos?action=commit` | Commit gallery photos |

### Quote Generation & Review

| FR | Method | Endpoint | Tag |
|---|---|---|---|
| FR-011 | POST | `/leads/{id}/quote` | Enqueue AI generation |
| FR-015 | GET | `/leads/{id}/quote` | Get latest draft for review |
| FR-015 | PATCH | `/quotes/{id}/line-items/{lineId}` | Edit line item (tap-to-edit) |

### SMS Delivery & Acceptance

| FR | Method | Endpoint | Tag |
|---|---|---|---|
| FR-016 | POST | `/quotes/{id}/send` | Generate PDF + send SMS |
| FR-017 | POST | `/quotes/{id}/send` | SMS dispatch (Twilio AU long-code) |
| FR-018 | POST | `/webhooks/twilio/delivery` | SMS delivery status update |
| FR-018 | GET | `/webhooks/twilio/read` | Read-receipt tracking pixel |
| FR-019 | [async] | Email fallback (via worker) | On SMS failure |
| FR-020 | GET | `/quotes/{id}/view` | Customer quote view page |
| FR-021 | POST | `/quotes/{id}/accept` | One-tap acceptance (legal record) |
| FR-022 | POST | `/quotes/{id}/decline` | Customer decline |

### FSM Integration

| FR | Method | Endpoint | Tag |
|---|---|---|---|
| FR-027 | GET | `/fsm/servicem8/oauth/start` | ServiceM8 OAuth flow |
| FR-027 | GET | `/fsm/servicem8/oauth/callback` | ServiceM8 OAuth callback |
| FR-028 | GET | `/fsm/tradify/oauth/start` | Tradify OAuth flow |
| FR-028 | GET | `/fsm/tradify/oauth/callback` | Tradify OAuth callback |

### Notifications

| FR | Method | Endpoint | Tag |
|---|---|---|---|
| FR-032 | POST | `/notifications/push/subscribe` | Register push subscription |
| FR-032 | DELETE | `/notifications/push/subscribe` | Unsubscribe from push |

---

## Detailed Endpoint Reference

### Authentication

#### POST /auth/otp — Start or Verify Phone OTP (FR-001, FR-003)

**Two-in-one endpoint:** Sends OTP if no `token` field; verifies OTP if `token` is present.

**Request (start OTP):**

```json
{
  "phone": "+61412345678"
}
```

**Response (200 — OTP sent):**

```json
{
  "ok": true,
  "messageId": "optional-sms-id"
}
```

**Request (verify OTP):**

```json
{
  "phone": "+61412345678",
  "token": "123456"
}
```

**Response (200 — OTP verified):**

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "onboarding_required": true,
  "user_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Errors:**

| Status | Description |
|---|---|
| 400 | Invalid phone number (must be E.164: +614XXXXXXXX) |
| 401 | Invalid or expired OTP token |
| 429 | Rate limit (5/hr per phone for start; 10/hr for verify) |

**Notes:**

- New user: `onboarding_required: true` → redirect to `/auth/onboarding`
- Returning user: `onboarding_required: false` → land on tray
- Client stores tokens; Supabase JS SDK sets session cookies automatically

---

#### POST /auth/onboarding — Complete Crew Profile (FR-002)

**One-screen onboarding:** Creates crew record, validates NSW licence, embeds crew_id in JWT.

**Auth required:** Bearer JWT from `/auth/otp` verify response

**Request:**

```json
{
  "business_name": "Sydney Roofing Co",
  "trade_type": "roofer",
  "nsw_licence_number": "ABN12345678901",
  "default_labour_rate_aud": 75.50,
  "abn": "12345678901"
}
```

**Response (201):**

```json
{
  "crew_id": "550e8400-e29b-41d4-a716-446655440000",
  "licence_verified": true,
  "licence_verified_at": "2026-05-01T10:30:00Z"
}
```

**Errors:**

| Status | Description |
|---|---|
| 400 | Invalid JSON |
| 401 | Missing or invalid JWT |
| 409 | Onboarding already completed (crew_id in JWT) |
| 422 | Validation failed: business name too short, invalid trade_type, licence number format, labour rate out of range |
| 503 | Service NSW API unavailable (licence verification blocked) |

**Validation rules:**

- `business_name`: 2–128 chars, trimmed
- `trade_type`: enum (roofer, painter, electrician, plumber, landscaper)
- `nsw_licence_number`: 4–32 chars, uppercase, validated via Service NSW REST API
- `default_labour_rate_aud`: positive, ≤ $1,000/hr
- `abn`: optional, must be 11 digits (no spaces)

---

### Lead Management

#### GET /api/leads — List Leads (FR-004)

**Keyset pagination using cursor.** Returns leads for authenticated crew, newest first.

**Auth required:** Bearer JWT (RLS enforced by crew_id)

**Query parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| `cursor` | string (ISO timestamp) | No | For keyset pagination (last item's created_at) |
| `status` | enum | No | Filter by status (new, generating, draft_ready, sent, delivered, opened, won, lost) |
| `limit` | integer | No | Items per page (default: 20, max: 100) |

**Response (200):**

```json
{
  "items": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "crew_id": "550e8400-e29b-41d4-a716-446655440001",
      "source": "manual",
      "da_reference": null,
      "customer_name": "John Smith",
      "customer_mobile": "+61412345678",
      "customer_email": "john@example.com",
      "address": "42 Maple St, Sydney NSW 2000",
      "description": "Roof repair needed",
      "status": "draft_ready",
      "sms_disabled_followup": false,
      "created_at": "2026-05-01T10:00:00Z",
      "updated_at": "2026-05-01T10:30:00Z"
    }
  ],
  "next_cursor": "2026-05-01T09:59:00Z",
  "total": 42
}
```

**Errors:**

| Status | Description |
|---|---|
| 400 | Invalid query parameters (e.g., invalid status enum) |
| 401 | Missing or invalid JWT |
| 429 | Rate limit exceeded (600/hr per crew) |

---

#### POST /api/leads — Create Manual Lead (FR-007)

**Create a lead from phone call or inbound SMS.** Only customer_name is required.

**Auth required:** Bearer JWT

**Request:**

```json
{
  "customer_name": "Jane Doe",
  "customer_mobile": "+61487654321",
  "customer_email": "jane@example.com",
  "address": "100 King St, Sydney NSW 2000",
  "description": "Painting interior walls"
}
```

**Response (201):**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "crew_id": "550e8400-e29b-41d4-a716-446655440001",
  "source": "manual",
  "da_reference": null,
  "customer_name": "Jane Doe",
  "customer_mobile": "+61487654321",
  "customer_email": "jane@example.com",
  "address": "100 King St, Sydney NSW 2000",
  "description": "Painting interior walls",
  "status": "new",
  "sms_disabled_followup": false,
  "created_at": "2026-05-01T10:30:00Z",
  "updated_at": "2026-05-01T10:30:00Z"
}
```

**Validation rules:**

- `customer_name`: required, 1–128 chars, trimmed
- `customer_mobile`: optional, E.164 format
- `customer_email`: optional, valid email
- `address`: optional, ≤ 512 chars
- `description`: optional, ≤ 280 chars

---

#### GET /api/leads/{id} — Lead Detail (FR-005)

**Fetch single lead with all attached photos.**

**Auth required:** Bearer JWT (RLS: crew_id match)

**Response (200):**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "crew_id": "550e8400-e29b-41d4-a716-446655440001",
  "source": "manual",
  "da_reference": null,
  "customer_name": "John Smith",
  "customer_mobile": "+61412345678",
  "customer_email": "john@example.com",
  "address": "42 Maple St, Sydney NSW 2000",
  "description": "Roof repair needed",
  "status": "draft_ready",
  "sms_disabled_followup": false,
  "created_at": "2026-05-01T10:00:00Z",
  "updated_at": "2026-05-01T10:30:00Z",
  "photos": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440010",
      "lead_id": "550e8400-e29b-41d4-a716-446655440000",
      "gcs_path": "photos/lead-xyz/0.jpg",
      "exif_data": {
        "lat": -33.8688,
        "lng": 151.2093,
        "timestamp": "2026-05-01T10:00:00Z",
        "device": "iPhone 14"
      },
      "uploaded_at": "2026-05-01T10:05:00Z"
    }
  ]
}
```

---

#### PATCH /api/leads/{id} — Update Lead (FR-005)

**Update lead status, contact info, or disable auto-followup.**

**Auth required:** Bearer JWT (RLS)

**Request:**

```json
{
  "status": "draft_ready",
  "sms_disabled_followup": true,
  "customer_name": "John Smith Updated"
}
```

**Response (200):** Updated lead object

**Allowed fields:**

- `status`: new, generating, draft_ready, sent, delivered, opened, won, lost
- `description`: ≤ 280 chars
- `sms_disabled_followup`: boolean
- `customer_name`, `customer_mobile`, `customer_email`, `address`: as per POST /leads

---

### Photos

#### POST /api/leads/{id}/photos?action=init — Request Upload URLs (FR-008, FR-009)

**Phase 1 of two-phase photo upload.** Returns signed GCS PUT URLs for client direct upload.

**Auth required:** Bearer JWT (RLS)

**Request:**

```json
{
  "count": 3,
  "mime_types": ["image/jpeg", "image/jpeg", "image/png"]
}
```

**Response (200):**

```json
{
  "uploads": [
    {
      "index": 0,
      "signed_url": "https://storage.googleapis.com/... [signed PUT URL]",
      "gcs_path": "photos/lead-abc123/0.jpg",
      "expires_at": "2026-05-01T11:00:00Z"
    },
    {
      "index": 1,
      "signed_url": "https://storage.googleapis.com/... [signed PUT URL]",
      "gcs_path": "photos/lead-abc123/1.jpg",
      "expires_at": "2026-05-01T11:00:00Z"
    },
    {
      "index": 2,
      "signed_url": "https://storage.googleapis.com/... [signed PUT URL]",
      "gcs_path": "photos/lead-abc123/2.png",
      "expires_at": "2026-05-01T11:00:00Z"
    }
  ]
}
```

**Notes:**

- Client performs `PUT` to each `signed_url` with photo binary data + EXIF preserved
- Signed URLs expire in 1 hour
- Max 15 photos per lead total

**Errors:**

| Status | Description |
|---|---|
| 409 | Would exceed 15-photo limit |
| 422 | Invalid mime_type or count |

---

#### POST /api/leads/{id}/photos?action=commit — Commit Uploaded Photos (FR-008, FR-009)

**Phase 2 of two-phase upload.** Records photo metadata in DB after client PUT to GCS.

**Auth required:** Bearer JWT (RLS)

**Request:**

```json
{
  "photos": [
    {
      "gcs_path": "photos/lead-abc123/0.jpg",
      "exif_data": {
        "lat": -33.8688,
        "lng": 151.2093,
        "timestamp": "2026-05-01T10:05:00Z",
        "device": "iPhone 14"
      }
    },
    {
      "gcs_path": "photos/lead-abc123/1.jpg",
      "exif_data": null
    }
  ]
}
```

**Response (201):**

```json
{
  "photos": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440010",
      "lead_id": "550e8400-e29b-41d4-a716-446655440000",
      "gcs_path": "photos/lead-abc123/0.jpg",
      "exif_data": { "lat": -33.8688, "lng": 151.2093, "timestamp": "2026-05-01T10:05:00Z", "device": "iPhone 14" },
      "uploaded_at": "2026-05-01T10:05:00Z"
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440011",
      "lead_id": "550e8400-e29b-41d4-a716-446655440000",
      "gcs_path": "photos/lead-abc123/1.jpg",
      "exif_data": null,
      "uploaded_at": "2026-05-01T10:06:00Z"
    }
  ]
}
```

---

### Quotes

#### POST /api/leads/{id}/quote — Enqueue AI Quote Generation (FR-011)

**Async quote generation via BullMQ.** Requires ≥1 photo. NSW licence must be verified.

**Auth required:** Bearer JWT (RLS)

**Request:**

```json
{
  "context": "Re-roof, colorbond, single-storey, gutters too"
}
```

**Response (202 — Accepted):**

```json
{
  "quote_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "generating"
}
```

**Lead status immediately updates to "generating".** Push notification fires when draft is ready (NFR-002: p50 ≤60s).

**Errors:**

| Status | Description |
|---|---|
| 403 | NSW contractor licence not verified (crew.licence_verified = false) |
| 409 | No photos attached to lead |
| 429 | Daily limit exceeded (100 quotes/day per crew) |
| 503 | Quote generation service unavailable (queue unavailable) |

---

#### GET /api/leads/{id}/quote — Get Latest Quote Draft (FR-015)

**Fetch most recent quote for review, including all line items.**

**Auth required:** Bearer JWT (RLS)

**Response (200):**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "lead_id": "550e8400-e29b-41d4-a716-446655440005",
  "crew_id": "550e8400-e29b-41d4-a716-446655440001",
  "status": "draft",
  "subtotal_aud": 1000.00,
  "gst_aud": 100.00,
  "total_aud": 1100.00,
  "licence_number_snapshot": null,
  "statutory_warranty_text": null,
  "pdf_gcs_path": null,
  "pdf_signed_url": null,
  "pdf_signed_url_expires_at": null,
  "rate_card_source": "live",
  "created_at": "2026-05-01T10:30:00Z",
  "sent_at": null,
  "quote_line_items": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440010",
      "quote_id": "550e8400-e29b-41d4-a716-446655440000",
      "description": "Colorbond roof (20 sq m)",
      "qty": 20,
      "unit": "sq m",
      "unit_price_aud": 45.50,
      "kind": "material",
      "confidence_score": 92,
      "sort_order": 0
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440011",
      "quote_id": "550e8400-e29b-41d4-a716-446655440000",
      "description": "Roof installation labour (40 hours)",
      "qty": 40,
      "unit": "hours",
      "unit_price_aud": 12.50,
      "kind": "labour",
      "confidence_score": 88,
      "sort_order": 1
    }
  ]
}
```

---

#### PATCH /api/quotes/{id}/line-items/{lineId} — Edit Line Item (FR-015)

**Tap-to-edit: update description, qty, unit, or unit_price_aud.** Auto-recalculates totals.

**Auth required:** Bearer JWT (RLS)

**Request:**

```json
{
  "qty": 25,
  "unit_price_aud": 48.00
}
```

**Response (200):** Updated quote with all line items and recalculated totals

**Notes:**

- At least one field must be provided
- Cannot edit quotes in sent/accepted/declined status
- Subtotal, GST, and total recalculate immediately
- GST = subtotal × 0.10 (10%), rounded to 2 decimals

---

#### POST /api/quotes/{id}/send — Generate PDF + Send SMS (FR-016, FR-017, FR-019)

**Approve quote, generate PDF, send SMS via Twilio AU long-code (or email fallback).**

**Auth required:** Bearer JWT (RLS)

**Request:**

```json
{
  "sms_body": "Hi John, here's your roofing quote. Valid for 7 days."
}
```

**sms_body is optional.** If not provided, defaults to a template:
> "Hi [customer_name], here's your quote for [address]. [quote_link]"

**Response (200):**

```json
{
  "status": "sent",
  "sms_event_id": "550e8400-e29b-41d4-a716-446655440000",
  "pdf_signed_url": "https://storage.googleapis.com/... [signed URL, expires 30d]",
  "quote_view_url": "https://app.quotingagent.com.au/q/abc123?t=...",
  "sent_by_email": false
}
```

**On SMS failure (if no mobile or Twilio error):**

```json
{
  "status": "sent_by_email",
  "sms_event_id": null,
  "pdf_signed_url": "https://storage.googleapis.com/...",
  "quote_view_url": "https://app.quotingagent.com.au/q/abc123?t=...",
  "sent_by_email": true
}
```

**Side effects:**

1. Snapshots NSW licence number + statutory warranty text into quote
2. Updates quote status → "approved" → "sent"
3. Updates lead status → "sent"
4. Records sms_event {sent}
5. Schedules D+3 / D+7 followup SMS (unless sms_disabled_followup = true)
6. Sends push notification to tradie: "Quote sent"

**Errors:**

| Status | Description |
|---|---|
| 403 | NSW licence not verified |
| 409 | Quote already in sent/accepted/declined status |
| 429 | Daily limit exceeded (100 sends/day per crew) |
| 500 | Failed to generate PDF |

---

#### GET /api/quotes/{id}/view — Public Quote View Page (FR-020)

**Unauthenticated endpoint.** Returns JSON for customer-facing mobile page.

**Auth required:** HMAC signed token in ?t= query param

**Fires read-receipt:** Updates lead status → "opened", sends push to tradie.

**Response (200):**

```json
{
  "quote": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "sent",
    "subtotal_aud": 1000.00,
    "gst_aud": 100.00,
    "total_aud": 1100.00,
    "licence_number": "ABN12345678901",
    "statutory_warranty_text": "The contractor warrants ...",
    "pdf_url": "https://storage.googleapis.com/... [signed URL]",
    "sent_at": "2026-05-01T10:30:00Z"
  },
  "lead": {
    "customer_name": "John Smith",
    "address": "42 Maple St, Sydney NSW 2000"
  },
  "crew": {
    "business_name": "Sydney Roofing Co",
    "abn": "12345678901",
    "nsw_licence_number": "ABN12345678901"
  },
  "line_items": [
    {
      "description": "Colorbond roof",
      "qty": 20,
      "unit": "sq m",
      "unit_price_aud": 45.50,
      "kind": "material"
    }
  ]
}
```

**Errors:**

| Status | Description |
|---|---|
| 403 | Invalid or expired signed token |
| 404 | Quote not found |
| 429 | Rate limit exceeded (60/min per IP) |

---

#### POST /api/quotes/{id}/accept — Customer Accepts Quote (FR-021)

**One-tap acceptance.** Records legally timestamped audit trail (7-year retention, NSW Home Building Act).

**Auth required:** HMAC signed token in request body (no bearer auth)

**Request:**

```json
{
  "signed_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "customer_name": "John Smith"
}
```

**Response (200):**

```json
{
  "accepted_at": "2026-05-01T10:35:00Z",
  "already_accepted": true
}
```

**Side effects:**

1. Records quote_acceptance (idempotent on quote_id)
2. Updates quote status → "accepted"
3. Updates lead status → "won"
4. Cancels pending D+3/D+7 followup SMS
5. Enqueues FSM push job (if ServiceM8/Tradify connected)
6. Sends push notification to tradie: "Quote accepted!"

**Errors:**

| Status | Description |
|---|---|
| 403 | Invalid or expired signed token |
| 404 | Quote not found |
| 409 | Quote already declined |
| 429 | Rate limit exceeded (10/min per IP) |

---

#### POST /api/quotes/{id}/decline — Customer Declines Quote (FR-022)

**Decline with optional reason.**

**Auth required:** HMAC signed token (no bearer auth)

**Request:**

```json
{
  "signed_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "reason": "Price too high, will get another quote"
}
```

**Response (200):**

```json
{
  "declined_at": "2026-05-01T10:35:00Z",
  "already_declined": true
}
```

**Side effects:**

1. Updates quote status → "declined"
2. Updates lead status → "lost"
3. Sends push notification to tradie with decline reason

---

### Compliance

#### POST /api/crew/licence-validate — Validate NSW Contractor Licence (FR-002)

**Validate or re-validate NSW licence against Service NSW REST API.**

**Auth required:** Bearer JWT (crew must be in JWT)

**Request:**

```json
{
  "nsw_licence_number": "ABN12345678901"
}
```

**Response (200):**

```json
{
  "valid": true,
  "expires_at": "2027-05-01T00:00:00Z",
  "licence_holder_name": "John Smith",
  "error": null
}
```

**If invalid:**

```json
{
  "valid": false,
  "expires_at": null,
  "licence_holder_name": null,
  "error": "Licence not found or expired"
}
```

**Caching:**

- Valid results cached in Redis for 24h
- If valid, crew.licence_verified is updated

**Errors:**

| Status | Description |
|---|---|
| 401 | Missing or invalid JWT |
| 403 | Onboarding not complete (crew_id not in JWT) |
| 422 | Invalid licence number format |
| 429 | Rate limit exceeded (30/hr per crew) |
| 503 | Service NSW API unavailable |

---

### Webhooks

#### POST /api/webhooks/da-lead — DA Aggregator Lead Ingest (FR-006)

**Receive Development Application notifications.** No bearer auth — HMAC-SHA256 signature only.

**Auth required:** HMAC-SHA256 signature in X-DA-Signature header

**Request:**

```json
{
  "da_reference": "DA-2026-00123456",
  "address": "42 Maple Street, Sydney NSW 2000",
  "description": "Residential roof replacement — asbestos removal",
  "council": "Sydney City Council",
  "received_at": "2026-05-01T10:00:00Z",
  "customer_name": "John Smith",
  "customer_mobile": "+61412345678"
}
```

**Response (200):**

```json
{
  "accepted": true,
  "lead_id": "550e8400-e29b-41d4-a716-446655440000",
  "duplicate": false
}
```

**Side effects:**

1. Deduplicates by (crew_id, da_reference) — silently returns duplicate: true
2. Creates lead in tray
3. Sends push notification to crew owner: "New DA lead — [address]"

**Errors:**

| Status | Description |
|---|---|
| 400 | Invalid payload or missing required fields |
| 401 | Invalid HMAC signature |
| 429 | Rate limit exceeded (1000/min per IP) |
| 500 | Failed to create lead (returns 200 with accepted: true on duplicate) |

---

#### POST /api/webhooks/twilio/delivery — Twilio SMS Delivery Status (FR-018)

**Called by Twilio when SMS status changes.** Form-encoded POST. No bearer auth — Twilio signature only.

**Auth required:** X-Twilio-Signature header validation

**Form body:**

```
MessageSid=SM12345678...&MessageStatus=delivered&To=%2B614...&From=%2B614...&ErrorCode=null
```

**Response (200):**

```xml
<Response></Response>
```

**Side effects:**

1. Records sms_event {sent|delivered|failed|opened}
2. Updates lead status based on event type
3. On delivery: sends push to tradie "Quote delivered"
4. On failure: triggers email fallback if customer has email + SMS disabled

---

#### GET /api/webhooks/twilio/read — SMS Read-Receipt Tracking Pixel (FR-018)

**Returns 1×1 transparent GIF.** Fire-and-forget read-receipt tracking.

**Query params:**

| Param | Value |
|---|---|
| `q` | Quote ID (for tracking purposes) |

**Response (200):**

```
[1×1 transparent GIF binary]
```

**Headers:**

```
Content-Type: image/gif
Cache-Control: no-store, no-cache, must-revalidate
```

---

### FSM Integration

#### GET /api/fsm/{provider}/oauth/start — Start FSM OAuth (FR-027, FR-028)

**Redirect to ServiceM8 or Tradify OAuth authorization.**

**Auth required:** Bearer JWT (crew must be in JWT)

**Supported providers:** servicem8, tradify

**Response (302 redirect):**

```
Location: https://servicem8.com/oauth/authorize?client_id=...&redirect_uri=...&state=...
```

**Side effects:**

1. Generates CSRF state token
2. Stores state + crew_id in Redis (10 min TTL)
3. Redirects to provider OAuth endpoint

---

### Notifications

#### POST /api/notifications/push/subscribe — Register Push Subscription (FR-032)

**Save VAPID web push subscription after user grants permission.**

**Auth required:** Bearer JWT

**Request:**

```json
{
  "endpoint": "https://fcm.googleapis.com/fcm/send/dP...",
  "keys": {
    "p256dh": "base64-encoded-p256dh-key",
    "auth": "base64-encoded-auth-key"
  }
}
```

**Response (200):**

```json
{
  "ok": true
}
```

**Notes:**

- Upserted (idempotent on user_id + endpoint)
- Used for all push notifications: draft ready, quote sent, quote opened, quote accepted, etc.

---

#### DELETE /api/notifications/push/subscribe — Unsubscribe (FR-032)

**Remove a push subscription.**

**Auth required:** Bearer JWT

**Request:**

```json
{
  "endpoint": "https://fcm.googleapis.com/fcm/send/dP..."
}
```

**Response (204):** No content

---

## Requirements Traceability

### Functional Requirements Coverage

| FR | Endpoints | Status |
|---|---|---|
| FR-001 | POST /auth/otp (start) | ✓ Implemented |
| FR-002 | POST /auth/onboarding, POST /crew/licence-validate | ✓ Implemented |
| FR-003 | POST /auth/otp (verify) | ✓ Implemented |
| FR-004 | GET /leads | ✓ Implemented |
| FR-005 | GET /leads/{id}, PATCH /leads/{id}, GET /leads/{id}/quote | ✓ Implemented |
| FR-006 | POST /webhooks/da-lead | ✓ Implemented |
| FR-007 | POST /leads | ✓ Implemented |
| FR-008 | POST /leads/{id}/photos?action=init, ?action=commit | ✓ Implemented |
| FR-009 | POST /leads/{id}/photos?action=init, ?action=commit | ✓ Implemented |
| FR-010 | [context note in QuoteEnqueueReq] | ✓ Implemented |
| FR-011 | POST /leads/{id}/quote, GET /leads/{id}/quote | ✓ Implemented |
| FR-012 | [AI cost tracking in worker] | ✓ Implemented (worker) |
| FR-013 | [Rate card caching in worker] | ✓ Implemented (worker) |
| FR-014 | [confidence_score in GET /leads/{id}/quote] | ✓ Implemented |
| FR-015 | PATCH /quotes/{id}/line-items/{lineId} | ✓ Implemented |
| FR-016 | POST /quotes/{id}/send (PDF generation) | ✓ Implemented |
| FR-017 | POST /quotes/{id}/send (SMS dispatch) | ✓ Implemented |
| FR-018 | POST /webhooks/twilio/delivery, GET /webhooks/twilio/read | ✓ Implemented |
| FR-019 | POST /quotes/{id}/send (email fallback) | ✓ Implemented |
| FR-020 | GET /quotes/{id}/view | ✓ Implemented |
| FR-021 | POST /quotes/{id}/accept | ✓ Implemented |
| FR-022 | POST /quotes/{id}/decline | ✓ Implemented |
| FR-023 | [BullMQ scheduled job in worker] | ✓ Implemented (worker) |
| FR-024 | [licence_verified check in POST /leads/{id}/quote, POST /quotes/{id}/send] | ✓ Implemented |
| FR-025 | [statutory_warranty_text snapshot in POST /quotes/{id}/send] | ✓ Implemented |
| FR-026 | [GST calculation in POST /quotes/{id}/line-items/{lineId}] | ✓ Implemented |
| FR-027 | GET /fsm/servicem8/oauth/start, GET /fsm/servicem8/oauth/callback | ✓ Implemented |
| FR-028 | GET /fsm/tradify/oauth/start, GET /fsm/tradify/oauth/callback | ✓ Implemented |
| FR-029 | POST /leads/{id}/complete (via PATCH handler) | ✓ Implemented |
| FR-030 | [Rate-card learning in AI worker] | ✓ Implemented (worker) |
| FR-031 | [promptfoo eval in CI] | ✓ Configured |
| FR-032 | POST /notifications/push/subscribe, DELETE /notifications/push/subscribe | ✓ Implemented |

### Non-Functional Requirements Coverage

| NFR | Implementation | Status |
|---|---|---|
| NFR-001 | Photo → SMS latency (p50 ≤ 5min) | ✓ BullMQ worker async; Twilio AU long-code |
| NFR-002 | AI queue p50 ≤ 60s | ✓ Cloud Run worker; 20s LLM budget |
| NFR-003 | API p95 ≤ 200ms | ✓ pgbouncer pooling; Vercel edge |
| NFR-004 | Lighthouse ≥ 80 mobile | ✓ Next.js Server Components; lighthouse-ci |
| NFR-005 | AI cost ≤ A$0.30 | ✓ Cost guard in worker; haiku extraction |
| NFR-006 | AI accuracy ≥ 80% | ✓ promptfoo eval gate in CI |
| NFR-007 | SMS deliverability ≥ 98% | ✓ Twilio AU long-code; dual-carrier test |
| NFR-008 | Concurrency ≥ 20 jobs | ✓ Cloud Run min=1 max=5; 4 concurrency/instance |
| NFR-009 | RLS coverage 100% | ✓ All crew tables have RLS policies |
| NFR-010 | Auth security | ✓ Supabase Auth; OTP rate limit; JWT refresh |
| NFR-011 | HTTPS + CSP | ✓ HSTS; strict CSP; signed URLs |
| NFR-012 | Rate limiting | ✓ Upstash ratelimit on all hot endpoints |
| NFR-013 | Data privacy | ✓ Pino redaction; photo retention; consent |
| NFR-014 | Service availability | ✓ Vercel + Supabase SLA; BullMQ persistence |
| NFR-015 | Error tracking + alerting | ✓ Sentry; AI cost alerts; SMS failure alerts |
| NFR-016 | Code quality gates | ✓ TypeScript; ESLint; Vitest ≥80% coverage; Stryker; promptfoo; Playwright; Lighthouse |
| NFR-017 | Observability | ✓ Pino; Sentry traces; quote_ai_usage table |
| NFR-018 | Deployment + rollback | ✓ Buildkite CI; Vercel instant rollback |
| NFR-019 | NSW licence compliance | ✓ FR-024, POST /crew/licence-validate, snapshot in quote |
| NFR-020 | GST compliance | ✓ Static 10% calculation; ABN on quote |
| NFR-021 | AU data residency | ✓ Supabase ap-southeast-2; GCS australia-southeast1 |

---

## Error Response Format

All error responses use this standard format:

```json
{
  "error": "Human-readable error message",
  "details": {
    "fieldName": ["Error 1", "Error 2"]
  }
}
```

Example (422 Validation):

```json
{
  "error": "Validation failed",
  "details": {
    "business_name": ["Business name must be at least 2 characters"],
    "default_labour_rate_aud": ["Labour rate must be positive"]
  }
}
```

---

## Pagination

All list endpoints use **keyset pagination** (scroll-based) via a `cursor` parameter:

1. First request: omit `cursor`
2. Subsequent requests: pass `next_cursor` from previous response
3. When `next_cursor` is null, all items exhausted

**Advantages:** Efficient for large datasets; not affected by concurrent insertions.

---

## Versioning

- API version: **1.0.0**
- Next major version will introduce breaking changes (e.g., new auth flows, structural changes)
- Minor versions may add new endpoints without breaking existing ones
- Patch versions are bug fixes

Current version in OpenAPI spec: `/openapi.yaml`

---

## Support & Contact

- **API Documentation:** This file + `/openapi.yaml` (OpenAPI 3.1)
- **Swagger UI:** Available at `/api-docs` (interactive explorer)
- **Status:** Preview tier (public beta)
- **Scale tier:** Single AU region (Vercel syd1, Supabase ap-southeast-2)

---

*Last updated: 2026-05-01*
*Critic gate: not required for api-docs phase*
*Next phase: e2e-tester*
