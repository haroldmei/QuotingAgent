-- Bootstrap script for the QuotingAgent database.
--
-- Idempotent + safe to run against any Postgres flavor:
--   • local pgvector container — creates everything from scratch
--   • Neon (or other managed) — creates auth schema + stubs (no superuser ALTERs)
--   • hosted Supabase         — detects and skips the things Supabase already provides
--
-- Detection of hosted Supabase: presence of the `supabase_auth_admin` role.
-- When detected, we skip everything inside the `auth` schema and skip role
-- creation — Supabase manages those for you.

-- ---------------------------------------------------------------------------
-- 1. extensions schema (pgvector lives here per docs/00-tech-stack.md)
-- ---------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS vector SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pgcrypto" SCHEMA extensions;

-- ---------------------------------------------------------------------------
-- 2. search_path — best-effort; managed Postgres often denies this
-- ---------------------------------------------------------------------------
DO $bootstrap$
DECLARE
  db_name text := current_database();
BEGIN
  EXECUTE format('ALTER DATABASE %I SET search_path TO public, extensions', db_name);
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'skipping ALTER DATABASE search_path (no permission on %)', db_name;
END $bootstrap$;

-- ---------------------------------------------------------------------------
-- 3. auth — Supabase-compatible schema. Skip the body if we ARE on Supabase.
-- ---------------------------------------------------------------------------
DO $bootstrap_auth$
DECLARE
  on_supabase boolean := EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin');
BEGIN
  IF on_supabase THEN
    RAISE NOTICE 'detected hosted Supabase — skipping auth schema bootstrap (Supabase manages it)';
    RETURN;
  END IF;

  -- Non-Supabase: create the auth schema + stub auth.users + auth.uid() / auth.jwt()
  CREATE SCHEMA IF NOT EXISTS auth;

  CREATE TABLE IF NOT EXISTS auth.users (
    id                  uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    phone               text UNIQUE,
    email               text UNIQUE,
    created_at          timestamptz DEFAULT now(),
    raw_app_meta_data   jsonb DEFAULT '{}'::jsonb,
    raw_user_meta_data  jsonb DEFAULT '{}'::jsonb
  );

  -- auth.uid() — reads request.jwt.claims (set by PostgREST or app code)
  EXECUTE $func$
    CREATE OR REPLACE FUNCTION auth.uid()
    RETURNS uuid
    LANGUAGE sql STABLE
    AS 'SELECT (NULLIF(current_setting(''request.jwt.claims'', true), '''')::jsonb ->> ''sub'')::uuid'
  $func$;

  -- auth.jwt() — returns the parsed JWT claims (or empty object)
  EXECUTE $func$
    CREATE OR REPLACE FUNCTION auth.jwt()
    RETURNS jsonb
    LANGUAGE sql STABLE
    AS 'SELECT COALESCE(NULLIF(current_setting(''request.jwt.claims'', true), '''')::jsonb, ''{}''::jsonb)'
  $func$;

  RAISE NOTICE 'auth schema + auth.users + auth.uid()/auth.jwt() created';
END $bootstrap_auth$;

-- ---------------------------------------------------------------------------
-- 4. Standard Supabase roles — already exist on hosted Supabase
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE ROLE anon NOLOGIN NOINHERIT;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN insufficient_privilege THEN NULL;
END $$;

DO $$ BEGIN
  CREATE ROLE authenticated NOLOGIN NOINHERIT;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN insufficient_privilege THEN NULL;
END $$;

DO $$ BEGIN
  CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN insufficient_privilege THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- 5. GRANTs — wrap so failures (insufficient_privilege) don't abort the script
-- ---------------------------------------------------------------------------
DO $bootstrap_grants$
BEGIN
  BEGIN
    GRANT USAGE ON SCHEMA auth TO authenticated, anon, service_role;
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'skipping GRANT USAGE ON SCHEMA auth (managed by Supabase)';
  END;

  BEGIN
    GRANT USAGE ON SCHEMA extensions TO authenticated, anon, service_role, PUBLIC;
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;

  BEGIN
    GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated, anon, service_role, PUBLIC;
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
    WHEN undefined_function THEN NULL;
  END;

  BEGIN
    GRANT EXECUTE ON FUNCTION auth.jwt() TO authenticated, anon, service_role, PUBLIC;
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
    WHEN undefined_function THEN NULL;
  END;

  BEGIN
    GRANT SELECT ON auth.users TO authenticated, service_role;
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $bootstrap_grants$;
