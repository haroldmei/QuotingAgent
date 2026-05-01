/**
 * Supabase server-side client helpers
 * Stack contract: auth.default=supabase-auth, database.provider=supabase
 *
 * Two clients:
 *   1. createServerClient  — for Next.js Route Handlers / Server Components
 *      Uses the user's JWT → honours RLS
 *   2. createServiceClient — for the BullMQ worker and onboarding writes
 *      Uses SUPABASE_SERVICE_ROLE_KEY → bypasses RLS (use sparingly)
 */

import { createServerClient as _createServerClient } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "@/lib/db/database.types";

// ---------------------------------------------------------------------------
// Server client (honours RLS — cookie-based JWT)
// Use in Route Handlers and Server Components.
// ---------------------------------------------------------------------------
export async function createServerClient() {
  const cookieStore = await cookies();

  // NOTE: Generic is omitted intentionally — hand-written Database type does not fully
  // satisfy Supabase's GenericSchema constraint (no FK Relationships).
  // The service client uses createClient<Database> which works for the worker.
  // Route handlers use explicit type assertions when needed.
  const client = _createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component read-only cookie store; ignore
          }
        },
      },
    }
  );
  // Cast to typed client — safe because runtime behaviour is identical
  return client as unknown as ReturnType<typeof createServiceClient>;
}

// ---------------------------------------------------------------------------
// Service-role client (bypasses RLS)
// Use only in:
//   - /api/auth/onboarding  (writes crew + user before JWT has crew_id)
//   - BullMQ worker jobs    (sets request.jwt.claims per job for audit)
//   - Webhook handlers      (DA ingest, Twilio, etc.)
// ---------------------------------------------------------------------------
export function createServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
