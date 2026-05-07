import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !anonKey) {
  // eslint-disable-next-line no-console
  console.warn(
    "[Bookit] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set. " +
      "Copy .env.example to .env.local and fill in values.",
  );
}

// We rely on explicit Row interfaces (BusinessRow, ServiceRow, etc.) for
// strong typing rather than the generic Database<> supabase-js parameter,
// which has tightened in 2.105+ in ways that don't play well with hand-rolled
// types. Code that needs typing casts at the call site.
export const supabase = createClient(url ?? "https://invalid.local", anonKey ?? "invalid", {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: "bookit.auth",
  },
  global: {
    headers: { "x-client-info": "bookit-web" },
  },
});

export const isSupabaseConfigured = Boolean(url && anonKey);
