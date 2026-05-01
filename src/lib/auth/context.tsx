/**
 * Auth context for React client components
 * Stack contract: auth.default=supabase-auth, frontend.framework=next
 *
 * Provides:
 *   - useAuth()   — current user + session state
 *   - useCrewId() — crew_id from JWT app_metadata (for RLS context)
 *
 * Pattern: Supabase → useUser() from @supabase/auth-helpers-react equivalent
 * using the browser client + onAuthStateChange listener.
 */

"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { User, Session } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/db/supabase-client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface AuthState {
  user: User | null;
  session: Session | null;
  crewId: string | null;
  isLoading: boolean;
  isOnboardingComplete: boolean;
}

interface AuthContextValue extends AuthState {
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------
const AuthContext = createContext<AuthContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    crewId: null,
    isLoading: true,
    isOnboardingComplete: false,
  });

  const supabase = getSupabaseBrowserClient();

  const deriveState = useCallback((user: User | null, session: Session | null): AuthState => {
    const crewId =
      (user?.app_metadata?.crew_id as string | undefined) ?? null;
    return {
      user,
      session,
      crewId,
      isLoading: false,
      isOnboardingComplete: crewId !== null,
    };
  }, []);

  useEffect(() => {
    // Get initial session
    supabase.auth.getUser().then(({ data: { user } }) => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setState(deriveState(user, session));
      });
    });

    // Subscribe to auth state changes (sign-in, sign-out, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null;
      setState(deriveState(user, session));
    });

    return () => subscription.unsubscribe();
  }, [supabase, deriveState]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, [supabase]);

  const refreshSession = useCallback(async () => {
    const { data, error } = await supabase.auth.refreshSession();
    if (!error && data.user) {
      setState(deriveState(data.user, data.session));
    }
  }, [supabase, deriveState]);

  return (
    <AuthContext.Provider value={{ ...state, signOut, refreshSession }}>
      {children}
    </AuthContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}

export function useCrewId(): string {
  const { crewId, isOnboardingComplete } = useAuth();
  if (!isOnboardingComplete || !crewId) {
    throw new Error("useCrewId called before onboarding is complete");
  }
  return crewId;
}

export function useUser(): User | null {
  return useAuth().user;
}
