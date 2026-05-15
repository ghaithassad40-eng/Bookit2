import { Link, Outlet, useParams } from "react-router-dom";
import { useBusiness } from "@/hooks/useBusiness";
import { ThemeProvider } from "@/components/ThemeProvider";
import { LoadingSplash } from "@/components/ui/LoadingSplash";
import { MusicControls } from "@/components/customer/MusicControls";
import { LanguagePicker } from "@/components/customer/LanguagePicker";
import { initials } from "@/lib/utils";
import { useI18n } from "@/hooks/useI18n";
import { useCustomerAuth } from "@/hooks/useCustomerAuth";
import { localizedCopy, pickLocale } from "@/lib/i18n";
import { Clock, LogOut, UserCircle2 } from "lucide-react";

export function CustomerLayout() {
  const { slug } = useParams();
  const { data, isLoading, error } = useBusiness(slug);
  const { locale, t } = useI18n();
  const { customer, signOut } = useCustomerAuth();

  if (isLoading) {
    return <LoadingSplash />;
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

  // Approval gate — block public access to businesses that haven't been
  // approved by the platform yet (or have been suspended). Rows with no
  // `status` column are treated as approved for back-compat with older prod
  // data. Vendors hitting their own /admin/<slug> bypass this gate because
  // they go through AdminLayout, not CustomerLayout.
  const approved = !business.status || business.status === "approved";
  if (!approved) {
    const isSuspended = business.status === "suspended";
    return (
      <div className="grid min-h-screen place-items-center bg-background px-4 py-12 text-foreground">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-muted text-muted-foreground">
            <Clock className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {isSuspended ? t("approval.suspended.title") : t("approval.comingSoon.title")}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {isSuspended ? t("approval.suspended.body") : t("approval.comingSoon.body")}
          </p>
          <div className="mt-5">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-foreground"
            >
              {t("approval.browseOthers")}
            </Link>
          </div>
        </div>
      </div>
    );
  }
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
              {customer && (
                <div
                  className="hidden items-center gap-1.5 rounded-full border border-border bg-card/60 px-2.5 py-1 text-xs sm:inline-flex"
                  title={`${t("customerAuth.signedInAs")} ${customer.email}`}
                >
                  <UserCircle2 className="h-3.5 w-3.5 text-accent" />
                  <span className="max-w-[120px] truncate">{customer.name}</span>
                  <button
                    onClick={signOut}
                    aria-label={t("customerAuth.signOut")}
                    className="ms-1 text-muted-foreground hover:text-foreground"
                  >
                    <LogOut className="h-3 w-3" />
                  </button>
                </div>
              )}
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
