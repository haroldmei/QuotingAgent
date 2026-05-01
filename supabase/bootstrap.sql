-- Bootstrap script for local-only Postgres (non-Supabase) environments.
--
-- Real Supabase provides the `auth` schema, `auth.users` table, `auth.uid()`,
-- `auth.jwt()`, and the `extensions` schema out of the box. For local dev
-- against a vanilla pgvector container, this script stubs the minimum surface
-- the project's migrations and the seed depend on.
--
-- DO NOT run this in production. Hosted Supabase provides the real
-- implementations and conflicts with these stubs.

-- 1. extensions schema (pgvector lives here per docs/00-tech-stack.md)
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS vector SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pgcrypto" SCHEMA extensions;

-- Make uuid-ossp + pgcrypto callable without schema prefix (matches Supabase default).
ALTER DATABASE quotingagent SET search_path TO public, extensions;

-- 2. auth schema + minimal users table
CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE IF NOT EXISTS auth.users (
  id          uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  phone       text UNIQUE,
  email       text UNIQUE,
  created_at  timestamptz DEFAULT now(),
  raw_app_meta_data jsonb DEFAULT '{}'::jsonb,
  raw_user_meta_data jsonb DEFAULT '{}'::jsonb
);

-- 3. auth.uid() — reads `request.jwt.claims` GUC (set by Supabase PostgREST).
-- Falls back to NULL when no JWT is set (e.g. running the seed as superuser).
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql STABLE
AS $$
  SELECT (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid
$$;

-- 4. auth.jwt() — returns the parsed JWT claims as JSON (or empty object).
CREATE OR REPLACE FUNCTION auth.jwt()
RETURNS jsonb
LANGUAGE sql STABLE
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claims', true), '')::jsonb,
    '{}'::jsonb
  )
$$;

-- 5. Standard Supabase roles (seed scripts and migrations may GRANT to these).
DO $$ BEGIN
  CREATE ROLE anon NOLOGIN NOINHERIT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE ROLE authenticated NOLOGIN NOINHERIT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 6. Allow the app role to USAGE the auth + extensions schemas.
GRANT USAGE ON SCHEMA auth TO authenticated, anon, service_role;
GRANT USAGE ON SCHEMA extensions TO authenticated, anon, service_role, PUBLIC;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated, anon, service_role, PUBLIC;
GRANT EXECUTE ON FUNCTION auth.jwt() TO authenticated, anon, service_role, PUBLIC;
GRANT SELECT ON auth.users TO authenticated, service_role;
