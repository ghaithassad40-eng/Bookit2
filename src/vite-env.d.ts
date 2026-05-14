/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_USE_EDGE_BOOKING?: string;
  readonly VITE_USE_EDGE_PAYMENTS?: string;
  readonly VITE_USE_AI_CONCIERGE?: string;
  readonly VITE_MYFATOORAH_ENABLED?: string;
  readonly VITE_GOOGLE_MAPS_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
