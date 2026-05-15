import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import {
  clearDemoUser,
  getDemoUser,
  onDemoAuthChange,
  setDemoUser,
  type DemoUser,
  type UserRole,
} from "@/lib/demoAuth";

/** Resolved RBAC role for the active operator-side session.
 *  - 'vendor' when the user manages a single business
 *  - 'platform_admin' when the user runs the marketplace itself
 *  - null when no operator-side session is active (customer-only mode)
 *
 *  In Supabase mode this is read from the user's `app_metadata.role` field
 *  (set server-side); in demo mode it's stored on the DemoUser record. */
export type ResolvedRole = UserRole | null;

export interface AuthState {
  session: Session | null;
  user: User | null;
  demoUser: DemoUser | null;
  isDemoMode: boolean;
  /** Resolved RBAC role, regardless of demo / real-Supabase mode. */
  role: ResolvedRole;
  isPlatformAdmin: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  /** Sign in as a demo operator. Defaults to 'vendor'; pass 'platform_admin'
   *  to bootstrap a marketplace operator session in demo mode. */
  enterDemoMode: (email?: string, role?: UserRole) => DemoUser;
  requestPasswordReset: (email: string) => Promise<{ error: Error | null }>;
}

export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(null);
  const [demoUser, setDemoUserState] = useState<DemoUser | null>(null);
  const [loading, setLoading] = useState(true);

  // ── Real Supabase session ────────────────────────────────────────────────
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // ── Demo session ─────────────────────────────────────────────────────────
  useEffect(() => {
    setDemoUserState(getDemoUser());
    if (!isSupabaseConfigured) setLoading(false);
    return onDemoAuthChange(() => setDemoUserState(getDemoUser()));
  }, []);

  // Helpers that gracefully handle "Supabase not configured" / fetch failures.
  async function signIn(email: string, password: string) {
    if (!isSupabaseConfigured) {
      return {
        error: new Error(
          "Supabase isn't connected. Use \"Try the demo admin\" below to explore without a backend.",
        ),
      };
    }
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error: error ?? null };
    } catch (err) {
      return { error: normalizeError(err) };
    }
  }

  async function signUp(email: string, password: string) {
    if (!isSupabaseConfigured) {
      return {
        error: new Error(
          "Supabase isn't connected. Use \"Try the demo admin\" below to explore without a backend.",
        ),
      };
    }
    if (password.length < 8) {
      return { error: new Error("Password must be at least 8 characters.") };
    }
    try {
      const { error } = await supabase.auth.signUp({ email, password });
      return { error: error ?? null };
    } catch (err) {
      return { error: normalizeError(err) };
    }
  }

  /**
   * Sends a password reset email. The link points back to
   * `${origin}/admin/reset-password` where the user sets a new one.
   */
  async function requestPasswordReset(email: string) {
    if (!isSupabaseConfigured) {
      return {
        error: new Error(
          "Supabase isn't connected. Password reset isn't available in demo mode.",
        ),
      };
    }
    try {
      const redirectTo = typeof window !== "undefined"
        ? `${window.location.origin}/admin/reset-password`
        : undefined;
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      return { error: error ?? null };
    } catch (err) {
      return { error: normalizeError(err) };
    }
  }

  async function signOut() {
    if (isSupabaseConfigured) {
      try {
        await supabase.auth.signOut();
      } catch {
        // ignore — fall through to clear demo state
      }
    }
    clearDemoUser();
  }

  function enterDemoMode(email = "demo@bookit.app", role: UserRole = "vendor"): DemoUser {
    return setDemoUser(email, role);
  }

  // Resolve role across both auth modes. Real Supabase puts role on
  // app_metadata (server-controlled, can't be tampered with client-side);
  // demo mode keeps it on the DemoUser record.
  //
  // SECURITY: the demoUser record lives in localStorage and is fully
  // attacker-controlled. We therefore *only* trust demoUser.role in
  // development builds. In production, role resolution comes exclusively
  // from Supabase app_metadata so a malicious user can't grant themselves
  // `platform_admin` by editing localStorage. (Demo mode is still allowed in
  // prod for vendor-side previews, but role-gated routes — i.e. the
  // platform admin console — will see role === null and reject.)
  const supabaseRole =
    (session?.user?.app_metadata?.role as UserRole | undefined) ?? null;
  const demoRole = import.meta.env.DEV ? demoUser?.role ?? null : null;
  const role: ResolvedRole = demoRole ?? supabaseRole;

  return {
    session,
    user: session?.user ?? null,
    demoUser,
    isDemoMode: !!demoUser,
    role,
    isPlatformAdmin: role === "platform_admin",
    loading,
    signIn,
    signUp,
    signOut,
    enterDemoMode,
    requestPasswordReset,
  };
}

function normalizeError(err: unknown): Error {
  if (err instanceof Error) {
    // Supabase + browsers report network-level failures as "Failed to fetch"
    // or TypeError. Translate so the UI can react properly.
    if (/failed to fetch|networkerror|load failed/i.test(err.message)) {
      return new Error(
        "Couldn't reach the auth service. Check your Supabase URL/anon key, or use the demo admin below.",
      );
    }
    return err;
  }
  return new Error(typeof err === "string" ? err : "Unknown error");
}
