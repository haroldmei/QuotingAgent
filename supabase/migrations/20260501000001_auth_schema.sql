-- ============================================================================
-- Migration: 20260501000001_auth_schema
-- Auth schema for QuotingAgent
-- Stack contract: auth.default=supabase-auth, auth.strategy=phone-otp,
--                 auth.multi_tenant.model=crew-as-tenant, rls=required
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- Custom JWT claim helper
-- Returns the crew_id embedded in the JWT for RLS policies.
-- Supabase injects user_metadata into the JWT via the dashboard setting:
--   "Additional claims": { "crew_id": "{{user_metadata.crew_id}}" }
-- ============================================================================
CREATE OR REPLACE FUNCTION public.app_crew_id()
  RETURNS uuid
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
AS $$
  -- Supabase nests custom claims under app_metadata. Try that path first;
  -- fall back to top-level for app-issued JWTs (local dev / non-Supabase auth).
  SELECT COALESCE(
    (current_setting('request.jwt.claims', TRUE)::jsonb -> 'app_metadata' ->> 'crew_id')::uuid,
    (current_setting('request.jwt.claims', TRUE)::jsonb ->> 'crew_id')::uuid,
    NULL
  );
$$;

-- ============================================================================
-- crews
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.crews (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name           text        NOT NULL,
  trade_type              text        NOT NULL
                            CHECK (trade_type IN ('roofer','painter','electrician','plumber','landscaper')),
  nsw_licence_number      text        NOT NULL,
  licence_verified        boolean     NOT NULL DEFAULT false,
  licence_verified_at     timestamptz,
  default_labour_rate_aud numeric(10,2) NOT NULL,
  abn                     text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

-- Trigger: updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
  RETURNS trigger LANGUAGE plpgsql AS
$$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER crews_updated_at
  BEFORE UPDATE ON public.crews
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- users
-- id = auth.users.id (Supabase Auth UUID; foreign key to auth schema)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.users (
  id          uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  crew_id     uuid        NOT NULL REFERENCES public.crews(id) ON DELETE CASCADE,
  phone       text        NOT NULL, -- E.164
  role        text        NOT NULL DEFAULT 'owner'
                CHECK (role IN ('owner','member')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_crew ON public.users(crew_id);

-- ============================================================================
-- leads
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.leads (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_id               uuid        NOT NULL REFERENCES public.crews(id) ON DELETE CASCADE,
  source                text        NOT NULL
                          CHECK (source IN ('da','manual','inbound_sms')),
  da_reference          text,
  customer_name         text        NOT NULL,
  customer_mobile       text,  -- E.164
  customer_email        text,
  address               text,
  description           varchar(280),
  status                text        NOT NULL DEFAULT 'new'
                          CHECK (status IN ('new','generating','draft_ready','sent','delivered','opened','won','lost')),
  sms_disabled_followup boolean     NOT NULL DEFAULT false,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- DA dedup per crew
CREATE UNIQUE INDEX IF NOT EXISTS idx_lead_crew_da
  ON public.leads(crew_id, da_reference)
  WHERE da_reference IS NOT NULL;

-- List query index (NFR-003: p95 ≤200ms)
CREATE INDEX IF NOT EXISTS idx_lead_crew_created
  ON public.leads(crew_id, created_at DESC);

CREATE TRIGGER leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- photos
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.photos (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id     uuid        NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  gcs_path    text        NOT NULL,
  exif_data   jsonb,  -- {lat, lng, timestamp, device}
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_photos_lead ON public.photos(lead_id);

-- ============================================================================
-- quotes
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.quotes (
  id                          uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id                     uuid            NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  crew_id                     uuid            NOT NULL REFERENCES public.crews(id) ON DELETE CASCADE,
  status                      text            NOT NULL DEFAULT 'draft'
                                CHECK (status IN ('draft','approved','sent','accepted','declined')),
  subtotal_aud                numeric(12,2),
  gst_aud                     numeric(12,2),
  total_aud                   numeric(12,2),
  licence_number_snapshot     text,
  licence_verified_snapshot   boolean,
  statutory_warranty_text     text,
  pdf_gcs_path                text,
  pdf_signed_url              text,
  pdf_signed_url_expires_at   timestamptz,
  rate_card_source            text            NOT NULL DEFAULT 'live'
                                CHECK (rate_card_source IN ('live','cached','learned')),
  created_at                  timestamptz     NOT NULL DEFAULT now(),
  sent_at                     timestamptz
);

CREATE INDEX IF NOT EXISTS idx_quote_lead ON public.quotes(lead_id);
CREATE INDEX IF NOT EXISTS idx_quote_crew ON public.quotes(crew_id);

-- ============================================================================
-- quote_line_items
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.quote_line_items (
  id               uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id         uuid           NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  description      text           NOT NULL,
  qty              numeric(10,3)  NOT NULL,
  unit             varchar(32)    NOT NULL,
  unit_price_aud   numeric(12,2)  NOT NULL,
  confidence_score smallint       NOT NULL CHECK (confidence_score BETWEEN 0 AND 100),
  kind             text           NOT NULL DEFAULT 'material'
                     CHECK (kind IN ('material','labour','other')),
  sort_order       integer        NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_line_items_quote ON public.quote_line_items(quote_id);

-- ============================================================================
-- quote_acceptances (legal audit trail — 7-year retention)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.quote_acceptances (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id              uuid        UNIQUE NOT NULL REFERENCES public.quotes(id),
  accepted_at           timestamptz NOT NULL DEFAULT now(),
  ip_address            text        NOT NULL,  -- stored as text; originally inet
  user_agent            text        NOT NULL,
  customer_name_snapshot text       NOT NULL,
  retention_until       date        NOT NULL   -- now() + 7 years
);

CREATE INDEX IF NOT EXISTS idx_acceptance_retention ON public.quote_acceptances(retention_until);

-- ============================================================================
-- quote_ai_usage (token cost per quote — NFR-005)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.quote_ai_usage (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id         uuid        UNIQUE NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  model_vision     text        NOT NULL,
  model_extraction text        NOT NULL,
  input_tokens     integer     NOT NULL,
  output_tokens    integer     NOT NULL,
  cost_aud         numeric(8,4) NOT NULL,
  cost_overrun     boolean     NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- sms_events
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.sms_events (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id            uuid        NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  twilio_message_sid  text,
  event_type          text        NOT NULL
                        CHECK (event_type IN ('sent','delivered','failed','opened')),
  occurred_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sms_events_quote ON public.sms_events(quote_id, occurred_at DESC);

-- ============================================================================
-- job_completions (rate-card learning)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.job_completions (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id             uuid        NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  crew_id             uuid        NOT NULL REFERENCES public.crews(id) ON DELETE CASCADE,
  quoted_amount_aud   numeric(12,2) NOT NULL,
  invoiced_amount_aud numeric(12,2),
  trade_type          text        NOT NULL
                        CHECK (trade_type IN ('roofer','painter','electrician','plumber','landscaper')),
  completed_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_job_completions_crew ON public.job_completions(crew_id, completed_at DESC);

-- ============================================================================
-- fsm_connections (ServiceM8 / Tradify OAuth)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.fsm_connections (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_id                uuid        NOT NULL REFERENCES public.crews(id) ON DELETE CASCADE,
  provider               text        NOT NULL CHECK (provider IN ('servicem8','tradify')),
  encrypted_oauth_token  text        NOT NULL,  -- AES-256-GCM encrypted
  expires_at             timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now(),
  UNIQUE (crew_id, provider)
);

-- ============================================================================
-- followup_schedules (D+3 / D+7 auto-SMS)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.followup_schedules (
  id       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id  uuid        NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  stage    text        NOT NULL CHECK (stage IN ('d3','d7')),
  fire_at  timestamptz NOT NULL,
  fired    boolean     NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_followup_fire_at
  ON public.followup_schedules(fire_at)
  WHERE fired = false;

-- ============================================================================
-- push_subscriptions (Web Push VAPID — STACK_GAP-003)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  endpoint   text        NOT NULL,
  p256dh     text        NOT NULL,
  auth_key   text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, endpoint)
);

-- ============================================================================
-- rate_card_items (Bunnings / Reece pricing cache)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.rate_card_items (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier    varchar(64) NOT NULL,
  sku         varchar(128) NOT NULL,
  description text        NOT NULL,
  price_aud   numeric(10,2) NOT NULL,
  fetched_at  timestamptz NOT NULL,
  stale       boolean     NOT NULL DEFAULT false,
  UNIQUE (supplier, sku)
);

CREATE INDEX IF NOT EXISTS idx_rate_card_stale ON public.rate_card_items(stale, fetched_at);
