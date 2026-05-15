import { Link, Outlet, useParams } from "react-router-dom";
import { useBusiness } from "@/hooks/useBusiness";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Skeleton } from "@/components/ui/skeleton";
import { MusicControls } from "@/components/customer/MusicControls";
import { LanguagePicker } from "@/components/customer/LanguagePicker";
import { initials } from "@/lib/utils";
import { useI18n } from "@/hooks/useI18n";
import { localizedCopy, pickLocale } from "@/lib/i18n";

export function CustomerLayout() {
  const { slug } = useParams();
  const { data, isLoading, error } = useBusiness(slug);
  const { locale, t } = useI18n();

  if (isLoading) {
    return (
      <div className="container py-12 space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container py-24 text-center">
        <h1 className="text-2xl font-semibold">Business not found</h1>
        <p className="mt-2 text-muted-foreground">
          The booking page for "{slug}" doesn't exist.
        </p>
      </div>
    );
  }

  const { business, config: rawConfig } = data;
  // Apply locale-aware copy override (Arabic businesses see Arabic hero/CTA/etc.)
  const config = {
    ...rawConfig,
    copy_json: localizedCopy(locale, rawConfig.copy_json, rawConfig.copy_json_ar),
  };
  const businessName = pickLocale(locale, business.name, business.name_ar);

  return (
    <ThemeProvider theme={config.theme_json}>
      <div className="min-h-screen bg-background text-foreground">
        <header className="sticky top-0 z-30 border-b border-border/60 bg-background/70 backdrop-blur-xl">
          <div className="container flex h-14 items-center justify-between">
            <Link to={`/business/${business.slug}`} className="flex items-center gap-2">
              {business.logo_url ? (
                <img src={business.logo_url} alt={businessName} className="h-8 w-8 rounded-lg object-cover" />
              ) : (
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-accent/15 text-xs font-bold text-accent">
                  {initials(business.name)}
                </div>
              )}
              <span className="font-semibold tracking-tight">{businessName}</span>
            </Link>
            <div className="flex items-center gap-2">
              <LanguagePicker />
              <Link
                to={`/business/${business.slug}/book`}
                className="rounded-full bg-accent px-4 py-1.5 text-xs font-medium text-accent-foreground shadow"
              >
                {config.copy_json.ctaText}
              </Link>
            </div>
          </div>
        </header>
        <main>
          <Outlet context={{ business, config }} />
        </main>
        <footer className="border-t border-border/60 mt-16">
          <div className="container flex flex-col items-center justify-between gap-2 py-6 text-xs text-muted-foreground sm:flex-row">
            <span>© {new Date().getFullYear()} {businessName}</span>
            <span>{t("invoice.poweredBy")}</span>
          </div>
        </footer>
        <MusicControls industry={business.industry} />
      </div>
    </ThemeProvider>
  );
}
