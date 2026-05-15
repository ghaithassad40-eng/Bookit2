import { Link, NavLink, Outlet, useNavigate, useParams } from "react-router-dom";
import {
  Banknote,
  CalendarDays,
  CalendarRange,
  LayoutDashboard,
  LogOut,
  Package,
  Settings,
  Sparkles,
  Tags,
  Users,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useBusiness } from "@/hooks/useBusiness";
import { useI18n } from "@/hooks/useI18n";
import { pickLocale } from "@/lib/i18n";
import { LoadingSplash } from "@/components/ui/LoadingSplash";
import { Button } from "@/components/ui/button";
import { ThemeProvider } from "@/components/ThemeProvider";
import { cn, initials } from "@/lib/utils";
import { useEffect } from "react";
import type { TranslationKey } from "@/lib/i18n";

interface NavItem {
  to: string;
  icon: typeof LayoutDashboard;
  labelKey: TranslationKey;
}

const NAV: NavItem[] = [
  { to: "", icon: LayoutDashboard, labelKey: "admin.nav.overview" },
  { to: "bookings", icon: CalendarRange, labelKey: "admin.nav.bookings" },
  { to: "calendar", icon: CalendarDays, labelKey: "admin.nav.calendar" },
  { to: "services", icon: Tags, labelKey: "admin.nav.services" },
  { to: "equipment", icon: Package, labelKey: "admin.nav.equipment" },
  { to: "staff", icon: Users, labelKey: "admin.nav.staff" },
  { to: "slots", icon: Sparkles, labelKey: "admin.nav.slots" },
  { to: "payouts", icon: Banknote, labelKey: "admin.nav.payouts" },
  { to: "settings", icon: Settings, labelKey: "admin.nav.settings" },
];

export function AdminLayout() {
  const { slug } = useParams();
  const { user, demoUser, isDemoMode, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const { data, isLoading } = useBusiness(slug);
  const { t, locale } = useI18n();

  const authedIdentity = user?.email ?? demoUser?.email ?? null;

  useEffect(() => {
    if (!loading && !user && !demoUser) navigate("/admin/login", { replace: true });
  }, [loading, user, demoUser, navigate]);

  if (loading || isLoading) {
    return <LoadingSplash />;
  }

  if (!data) {
    return (
      <div className="container py-24 text-center">
        <h1 className="text-2xl font-semibold">{t("admin.workspaceNotFound")}</h1>
        <p className="mt-2 text-muted-foreground">
          {t("admin.workspaceNotFoundBody")} "{slug}".
        </p>
      </div>
    );
  }

  const { business, config } = data;
  const businessName = pickLocale(locale, business.name, business.name_ar);

  return (
    <ThemeProvider theme={config.theme_json}>
      <div className="min-h-screen bg-background text-foreground">
        <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[260px_1fr]">
          <aside className="hidden border-r border-border/60 bg-card/40 backdrop-blur-xl lg:flex lg:flex-col">
            <div className="flex h-16 items-center gap-2 border-b border-border/60 px-5">
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-accent/15 text-xs font-bold text-accent">
                {initials(business.name)}
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{businessName}</div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {t("admin.adminBadge")}
                </div>
              </div>
            </div>
            <nav className="flex-1 space-y-1 p-3">
              {NAV.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to ? `/admin/${slug}/${item.to}` : `/admin/${slug}`}
                  end={!item.to}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-accent/15 text-accent"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )
                  }
                >
                  <item.icon className="h-4 w-4" />
                  {t(item.labelKey)}
                </NavLink>
              ))}
            </nav>
            <div className="border-t border-border/60 p-3">
              <Button
                variant="ghost"
                className="w-full justify-start text-muted-foreground"
                onClick={async () => {
                  await signOut();
                  navigate("/admin/login");
                }}
              >
                <LogOut className="h-4 w-4" />
                {t("admin.signOut")}
              </Button>
            </div>
          </aside>

          <div className="flex min-h-screen flex-col">
            <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border/60 bg-background/70 px-4 backdrop-blur-xl">
              <div className="flex items-center gap-3 lg:hidden">
                <Link to={`/admin/${slug}`} className="font-semibold">
                  {businessName}
                </Link>
              </div>
              <div className="ms-auto flex items-center gap-3 text-sm text-muted-foreground">
                {isDemoMode && (
                  <span className="hidden items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-600 sm:inline-flex dark:text-amber-300">
                    {t("admin.demoMode")}
                  </span>
                )}
                <span className="hidden sm:inline">{authedIdentity}</span>
              </div>
            </header>
            {isDemoMode && (
              <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-center text-xs text-amber-900 dark:text-amber-100">
                {t("admin.demoBanner")}
              </div>
            )}
            {/* Approval-state banner. Shown for pending/suspended/rejected
                businesses so the vendor knows their page isn't yet (or no
                longer) visible to customers. */}
            {business.status && business.status !== "approved" && (
              <div
                className={`border-b px-4 py-3 text-center text-xs ${
                  business.status === "pending"
                    ? "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-100"
                    : "border-rose-500/30 bg-rose-500/10 text-rose-900 dark:text-rose-100"
                }`}
              >
                <span className="font-semibold">
                  {business.status === "pending"
                    ? t("approval.vendorBanner.pending.title")
                    : business.status === "suspended"
                      ? t("approval.vendorBanner.suspended.title")
                      : t("approval.vendorBanner.rejected.title")}
                </span>{" "}
                <span className="opacity-80">
                  {business.status === "pending"
                    ? t("approval.vendorBanner.pending.body")
                    : business.status === "suspended"
                      ? t("approval.vendorBanner.suspended.body")
                      : t("approval.vendorBanner.rejected.body")}
                </span>
                {business.status === "rejected" && business.rejection_reason && (
                  <div className="mt-1 text-[11px] opacity-80">
                    {t("approval.vendorBanner.reasonLabel")}: {business.rejection_reason}
                  </div>
                )}
              </div>
            )}
            <main className="flex-1 p-4 sm:p-6 lg:p-8">
              <Outlet context={{ business, config }} />
            </main>
            <nav className="sticky bottom-0 z-20 flex items-center justify-around border-t border-border/60 bg-background/90 backdrop-blur lg:hidden">
              {NAV.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to ? `/admin/${slug}/${item.to}` : `/admin/${slug}`}
                  end={!item.to}
                  className={({ isActive }) =>
                    cn(
                      "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px]",
                      isActive ? "text-accent" : "text-muted-foreground",
                    )
                  }
                >
                  <item.icon className="h-4 w-4" />
                  {t(item.labelKey)}
                </NavLink>
              ))}
            </nav>
          </div>
        </div>
      </div>
    </ThemeProvider>
  );
}
