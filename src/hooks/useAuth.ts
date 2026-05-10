import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import {
  clearDemoUser,
  getDemoUser,
  onDemoAuthChange,
  setDemoUser,
  type DemoUser,
} from "@/lib/demoAuth";

export interface AuthState {
  session: Session | null;
  user: User | null;
  demoUser: DemoUser | null;
  isDemoMode: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  enterDemoMode: (email?: string) => DemoUser;
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
    try {
      const { error } = await supabase.auth.signUp({ email, password });
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

  function enterDemoMode(email = "demo@bookit.app"): DemoUser {
    return setDemoUser(email);
  }

  return {
    session,
    user: session?.user ?? null,
    demoUser,
    isDemoMode: !!demoUser,
    loading,
    signIn,
    signUp,
    signOut,
    enterDemoMode,
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
