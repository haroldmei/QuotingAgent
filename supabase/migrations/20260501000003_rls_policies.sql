-- ============================================================================
-- Migration: 20260501000003_rls_policies
-- Row-Level Security policies for crew-as-tenant multi-tenancy
-- Stack contract: auth.multi_tenant.model=crew-as-tenant, rls=required
--                 auth.default=supabase-auth
--
-- Design (docs/03-system-design.md §3.1):
--   Every table with crew_id carries:
--     SELECT/UPDATE/DELETE: USING (crew_id = public.app_crew_id())
--     INSERT:               WITH CHECK (crew_id = public.app_crew_id())
--   Indirect ownership (photo → lead.crew_id) uses EXISTS sub-select.
--   Cloud Run worker uses service role with explicit set_config() per job.
--   rate_card_* and quote_acceptances are tenant-agnostic (no RLS).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Helper: ensure the public.app_crew_id() function exists before policies run
-- (also defined in 000001, kept here for idempotency)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Enable RLS on all tenant tables
-- ---------------------------------------------------------------------------
ALTER TABLE public.crews               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photos              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_line_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_events          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_completions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fsm_connections     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.followup_schedules  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions  ENABLE ROW LEVEL SECURITY;

-- quote_acceptances: no RLS — keyed by signed URL token only; legal archive
-- quote_ai_usage: no RLS — internal analytics; accessed via service role
-- rate_card_items: no RLS — global cache; all crews read
-- rate_card_embeddings: no RLS — global cache

-- ---------------------------------------------------------------------------
-- crews: owner can read/update their own crew
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "crews_select_own" ON public.crews;
CREATE POLICY "crews_select_own"
  ON public.crews FOR SELECT
  USING (id = public.app_crew_id());

DROP POLICY IF EXISTS "crews_update_own" ON public.crews;
CREATE POLICY "crews_update_own"
  ON public.crews FOR UPDATE
  USING (id = public.app_crew_id())
  WITH CHECK (id = public.app_crew_id());

-- INSERT is performed by the service role during onboarding (no user JWT yet)

-- ---------------------------------------------------------------------------
-- users: each user sees only their own row; cannot see other crew members
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "users_select_own" ON public.users;
CREATE POLICY "users_select_own"
  ON public.users FOR SELECT
  USING (id = auth.uid());

DROP POLICY IF EXISTS "users_update_own" ON public.users;
CREATE POLICY "users_update_own"
  ON public.users FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- INSERT: service role performs the INSERT after OTP verification

-- ---------------------------------------------------------------------------
-- leads: all operations scoped to crew_id
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "leads_select_crew" ON public.leads;
CREATE POLICY "leads_select_crew"
  ON public.leads FOR SELECT
  USING (crew_id = public.app_crew_id());

DROP POLICY IF EXISTS "leads_insert_crew" ON public.leads;
CREATE POLICY "leads_insert_crew"
  ON public.leads FOR INSERT
  WITH CHECK (crew_id = public.app_crew_id());

DROP POLICY IF EXISTS "leads_update_crew" ON public.leads;
CREATE POLICY "leads_update_crew"
  ON public.leads FOR UPDATE
  USING (crew_id = public.app_crew_id())
  WITH CHECK (crew_id = public.app_crew_id());

DROP POLICY IF EXISTS "leads_delete_crew" ON public.leads;
CREATE POLICY "leads_delete_crew"
  ON public.leads FOR DELETE
  USING (crew_id = public.app_crew_id());

-- ---------------------------------------------------------------------------
-- photos: indirect ownership via lead.crew_id
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "photos_select_crew" ON public.photos;
CREATE POLICY "photos_select_crew"
  ON public.photos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = photos.lead_id
        AND l.crew_id = public.app_crew_id()
    )
  );

DROP POLICY IF EXISTS "photos_insert_crew" ON public.photos;
CREATE POLICY "photos_insert_crew"
  ON public.photos FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = photos.lead_id
        AND l.crew_id = public.app_crew_id()
    )
  );

DROP POLICY IF EXISTS "photos_delete_crew" ON public.photos;
CREATE POLICY "photos_delete_crew"
  ON public.photos FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = photos.lead_id
        AND l.crew_id = public.app_crew_id()
    )
  );

-- ---------------------------------------------------------------------------
-- quotes: scoped to crew_id
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "quotes_select_crew" ON public.quotes;
CREATE POLICY "quotes_select_crew"
  ON public.quotes FOR SELECT
  USING (crew_id = public.app_crew_id());

DROP POLICY IF EXISTS "quotes_insert_crew" ON public.quotes;
CREATE POLICY "quotes_insert_crew"
  ON public.quotes FOR INSERT
  WITH CHECK (crew_id = public.app_crew_id());

DROP POLICY IF EXISTS "quotes_update_crew" ON public.quotes;
CREATE POLICY "quotes_update_crew"
  ON public.quotes FOR UPDATE
  USING (crew_id = public.app_crew_id())
  WITH CHECK (crew_id = public.app_crew_id());

-- ---------------------------------------------------------------------------
-- quote_line_items: indirect ownership via quote.crew_id
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "line_items_select_crew" ON public.quote_line_items;
CREATE POLICY "line_items_select_crew"
  ON public.quote_line_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.quotes q
      WHERE q.id = quote_line_items.quote_id
        AND q.crew_id = public.app_crew_id()
    )
  );

DROP POLICY IF EXISTS "line_items_insert_crew" ON public.quote_line_items;
CREATE POLICY "line_items_insert_crew"
  ON public.quote_line_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.quotes q
      WHERE q.id = quote_line_items.quote_id
        AND q.crew_id = public.app_crew_id()
    )
  );

DROP POLICY IF EXISTS "line_items_update_crew" ON public.quote_line_items;
CREATE POLICY "line_items_update_crew"
  ON public.quote_line_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.quotes q
      WHERE q.id = quote_line_items.quote_id
        AND q.crew_id = public.app_crew_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.quotes q
      WHERE q.id = quote_line_items.quote_id
        AND q.crew_id = public.app_crew_id()
    )
  );

-- ---------------------------------------------------------------------------
-- sms_events: indirect ownership via quote.crew_id
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "sms_events_select_crew" ON public.sms_events;
CREATE POLICY "sms_events_select_crew"
  ON public.sms_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.quotes q
      WHERE q.id = sms_events.quote_id
        AND q.crew_id = public.app_crew_id()
    )
  );

-- INSERT/UPDATE by service role (worker) only

-- ---------------------------------------------------------------------------
-- job_completions: crew_id direct
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "job_completions_select_crew" ON public.job_completions;
CREATE POLICY "job_completions_select_crew"
  ON public.job_completions FOR SELECT
  USING (crew_id = public.app_crew_id());

DROP POLICY IF EXISTS "job_completions_insert_crew" ON public.job_completions;
CREATE POLICY "job_completions_insert_crew"
  ON public.job_completions FOR INSERT
  WITH CHECK (crew_id = public.app_crew_id());

-- ---------------------------------------------------------------------------
-- fsm_connections: crew_id direct
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "fsm_connections_select_crew" ON public.fsm_connections;
CREATE POLICY "fsm_connections_select_crew"
  ON public.fsm_connections FOR SELECT
  USING (crew_id = public.app_crew_id());

DROP POLICY IF EXISTS "fsm_connections_insert_crew" ON public.fsm_connections;
CREATE POLICY "fsm_connections_insert_crew"
  ON public.fsm_connections FOR INSERT
  WITH CHECK (crew_id = public.app_crew_id());

DROP POLICY IF EXISTS "fsm_connections_update_crew" ON public.fsm_connections;
CREATE POLICY "fsm_connections_update_crew"
  ON public.fsm_connections FOR UPDATE
  USING (crew_id = public.app_crew_id())
  WITH CHECK (crew_id = public.app_crew_id());

DROP POLICY IF EXISTS "fsm_connections_delete_crew" ON public.fsm_connections;
CREATE POLICY "fsm_connections_delete_crew"
  ON public.fsm_connections FOR DELETE
  USING (crew_id = public.app_crew_id());

-- ---------------------------------------------------------------------------
-- followup_schedules: indirect ownership via lead.crew_id
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "followup_select_crew" ON public.followup_schedules;
CREATE POLICY "followup_select_crew"
  ON public.followup_schedules FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = followup_schedules.lead_id
        AND l.crew_id = public.app_crew_id()
    )
  );

-- INSERT by service role (worker) only

-- ---------------------------------------------------------------------------
-- push_subscriptions: scoped to auth.uid()
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "push_sub_select_own" ON public.push_subscriptions;
CREATE POLICY "push_sub_select_own"
  ON public.push_subscriptions FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "push_sub_insert_own" ON public.push_subscriptions;
CREATE POLICY "push_sub_insert_own"
  ON public.push_subscriptions FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "push_sub_delete_own" ON public.push_subscriptions;
CREATE POLICY "push_sub_delete_own"
  ON public.push_subscriptions FOR DELETE
  USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- rate_card_items: readable by all authenticated users (global cache)
-- ---------------------------------------------------------------------------
ALTER TABLE public.rate_card_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rate_card_select_authenticated" ON public.rate_card_items;
CREATE POLICY "rate_card_select_authenticated"
  ON public.rate_card_items FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Writes by service role only (worker)
