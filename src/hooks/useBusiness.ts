import { useQuery } from "@tanstack/react-query";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type {
  BusinessConfigRow,
  BusinessRow,
} from "@/lib/database.types";
import {
  DEFAULT_COPY,
  DEFAULT_LAYOUT,
  DEFAULT_RULES,
  DEFAULT_THEME,
  withDefaults,
} from "@/lib/defaults";
import { findDemoBusinessBySlug } from "@/lib/demoData";

export interface BusinessBundle {
  business: BusinessRow;
  config: BusinessConfigRow;
}

function buildSafeConfig(
  rawConfig: Partial<BusinessConfigRow> | null | undefined,
  businessId: string,
): BusinessConfigRow {
  if (!rawConfig) {
    return {
      id: "virtual",
      business_id: businessId,
      theme_json: DEFAULT_THEME,
      copy_json: DEFAULT_COPY,
      booking_rules_json: DEFAULT_RULES,
      layout_json: DEFAULT_LAYOUT,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }
  return {
    ...(rawConfig as BusinessConfigRow),
    theme_json: withDefaults(rawConfig.theme_json, DEFAULT_THEME),
    copy_json: withDefaults(rawConfig.copy_json, DEFAULT_COPY),
    booking_rules_json: withDefaults(rawConfig.booking_rules_json, DEFAULT_RULES),
    layout_json: withDefaults(rawConfig.layout_json, DEFAULT_LAYOUT),
  };
}

async function fetchBusinessBySlug(slug: string): Promise<BusinessBundle | null> {
  // Demo fallback when Supabase isn't connected.
  if (!isSupabaseConfigured) {
    const demo = findDemoBusinessBySlug(slug);
    if (!demo) return null;
    return { business: demo.business, config: buildSafeConfig(demo.config, demo.business.id) };
  }

  const { data: business, error } = await supabase
    .from("businesses")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw error;
  if (!business) {
    // even if Supabase is configured, fall through to demo data so the
    // hard-coded demo slugs always render.
    const demo = findDemoBusinessBySlug(slug);
    if (demo) {
      return { business: demo.business, config: buildSafeConfig(demo.config, demo.business.id) };
    }
    return null;
  }

  const { data: config, error: cfgErr } = await supabase
    .from("business_configs")
    .select("*")
    .eq("business_id", business.id)
    .maybeSingle();
  if (cfgErr) throw cfgErr;

  return { business, config: buildSafeConfig(config, business.id) };
}

export function useBusiness(slug: string | undefined) {
  return useQuery({
    queryKey: ["business", slug],
    queryFn: () => (slug ? fetchBusinessBySlug(slug) : Promise.resolve(null)),
    enabled: Boolean(slug),
    staleTime: 60_000,
  });
}
