/**
 * Wedge-critical event definitions — QuotingAgent analytics tracking plan.
 *
 * Stack contract: analytics.product=posthog, analytics.consent=required-before-load
 * Wedge: lead_received → photos_uploaded → quote_sent → quote_accepted
 *
 * ONLY instrument the wedge workflow. No vanity metrics.
 *
 * KPIs tracked here:
 *   - p50 photo-to-SMS ≤ 5min   (photos_uploaded → quote_sent timestamps)
 *   - AI accuracy ≥ 80%         (confidence_score on quote_generation_completed)
 *   - Cost ≤ A$0.30/quote       (ai_cost_aud on quote_generation_completed)
 *   - Acceptance rate ≥ 35%     (quote_sent → quote_accepted funnel)
 */

// ---------------------------------------------------------------------------
// Event name constants
// ---------------------------------------------------------------------------

export const EVENTS = {
  /** DA webhook ingest OR manual lead entry. Top of the wedge funnel. */
  LEAD_RECEIVED: "lead_received",

  /** Photos attached to a lead (camera or gallery upload). */
  PHOTOS_UPLOADED: "photos_uploaded",

  /** Tradie tapped "Generate quote" — job enqueued in BullMQ. */
  QUOTE_GENERATION_STARTED: "quote_generation_started",

  /** AI worker completed the quote draft. Core latency + cost KPI event. */
  QUOTE_GENERATION_COMPLETED: "quote_generation_completed",

  /** Tradie sent the quote to the customer (SMS or email fallback). */
  QUOTE_SENT: "quote_sent",

  /** Customer opened the SMS link (Twilio delivery webhook). */
  QUOTE_READ: "quote_read",

  /** Customer tapped "Accept Quote". Bottom of the wedge funnel. */
  QUOTE_ACCEPTED: "quote_accepted",

  /** Customer tapped "Decline" (optional reason). */
  QUOTE_DECLINED: "quote_declined",
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];

// ---------------------------------------------------------------------------
// Per-event property types
// ---------------------------------------------------------------------------

export interface LeadReceivedProps {
  /** "da_webhook" | "manual" */
  source: "da_webhook" | "manual";
  /** Hashed crew identifier — no PII. */
  crew_id_hash: string;
}

export interface PhotosUploadedProps {
  /** Number of photos attached to this lead in this upload action. */
  count: number;
  /** Total bytes of uploaded photos. */
  total_bytes: number;
  /** Hashed lead identifier. */
  lead_id_hash: string;
  /** Whether the tradie also added a context note. */
  has_context_note: boolean;
}

export interface QuoteGenerationStartedProps {
  /** Hashed lead identifier. */
  lead_id_hash: string;
}

export interface QuoteGenerationCompletedProps {
  /** Hashed quote identifier. */
  quote_id_hash: string;
  /** Wall-clock ms from job enqueue to draft-ready. */
  latency_ms: number;
  /** AI token cost in AUD for this quote (KPI: ≤ A$0.30). */
  ai_cost_aud: number;
  /** Model used for the vision pass (e.g. "claude-opus-4-7"). */
  model_used: string;
  /** Number of line items in the generated quote. */
  line_item_count: number;
  /** Overall quote confidence score (0–100). */
  confidence_score: number;
}

export interface QuoteSentProps {
  /** Hashed quote identifier. */
  quote_id_hash: string;
  /** Delivery channel. */
  channel: "sms" | "email";
  /** Number of SMS segments used (relevant for cost — 1 segment = 160 chars). */
  sms_segments?: number;
  /** Quote total in AUD (for funnel value metrics). */
  total_aud: number;
}

export interface QuoteReadProps {
  /** Hashed quote identifier. */
  quote_id_hash: string;
  /** Elapsed ms from quote_sent to customer opening the link. */
  time_from_send_ms: number;
}

export interface QuoteAcceptedProps {
  /** Hashed quote identifier. */
  quote_id_hash: string;
  /** Elapsed ms from quote_sent to acceptance. */
  time_from_send_ms: number;
}

export interface QuoteDeclinedProps {
  /** Hashed quote identifier. */
  quote_id_hash: string;
  /** Optional reason the customer gave. */
  reason?: string;
}

/** Union type covering all wedge event property shapes. */
export type WedgeEventProps =
  | LeadReceivedProps
  | PhotosUploadedProps
  | QuoteGenerationStartedProps
  | QuoteGenerationCompletedProps
  | QuoteSentProps
  | QuoteReadProps
  | QuoteAcceptedProps
  | QuoteDeclinedProps;

// ---------------------------------------------------------------------------
// Funnel definition
// ---------------------------------------------------------------------------

/**
 * Primary wedge funnel (used by PostHog funnel analysis).
 * Steps must be in order.
 */
export const WEDGE_FUNNEL = [
  EVENTS.LEAD_RECEIVED,
  EVENTS.PHOTOS_UPLOADED,
  EVENTS.QUOTE_SENT,
  EVENTS.QUOTE_ACCEPTED,
] as const;

export type WedgeFunnelStep = (typeof WEDGE_FUNNEL)[number];
