/**
 * Supabase browser client (singleton)
 * Stack contract: auth.default=supabase-auth, auth.session=jwt-with-refresh
 *
 * Used in:
 *   - React client components for auth state subscription
 *   - SWR fetchers that need the user JWT
 *
 * Sessions stored in __Host- prefixed httpOnly cookies via @supabase/ssr.
 */

"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/db/database.types";

let _client: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function getSupabaseBrowserClient() {
  if (_client) return _client;

  _client = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  return _client;
}
