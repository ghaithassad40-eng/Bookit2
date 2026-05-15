import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useEffect, useMemo } from "react";
import {
  Activity,
  Building2,
  CheckCircle2,
  Clock,
  Gauge,
  Globe2,
  LogOut,
  ShieldCheck,
  ShieldOff,
  XCircle,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/hooks/useI18n";
import { Button } from "@/components/ui/button";
import { LoadingSplash } from "@/components/ui/LoadingSplash";
import { usePlatformBusinesses } from "@/hooks/usePlatformBusinesses";
import type { BusinessStatus } from "@/lib/database.types";
import { cn } from "@/lib/utils";

/**
 * Operations console for marketplace operators. Visually distinct from
 * the vendor admin: top command bar + always-visible live stats strip,
 * dense data-table layout below. Uses the brand cream background with
 * gold edge accents to mark the console as "platform surface" without
 * relying on a dark theme.
 */
export function PlatformAdminLayout() {
  const navigate = useNavigate();
  const { user, demoUser, isPlatformAdmin, loading, signOut } = useAuth();
  const { t } = useI18n();
  const { data: businesses } = usePlatformBusinesses();
  const authedIdentity = user?.email ?? demoUser?.email ?? null;

  useEffect(() => {
    if (loading) return;
    if (!user && !demoUser) {
      navigate("/admin/login", { replace: true });
      return;
    }
    if (!isPlatformAdmin) {
      navigate("/admin/login", { replace: true });
    }
  }, [loading, user, demoUser, isPlatformAdmin, navigate]);

  // Marketplace pulse — feeds the stats strip. Always-visible at the top
  // of the console so operators see overall state without drilling in.
  const stats = useMemo(() => {
    const c: Record<BusinessStatus | "total", number> = {
      pending: 0,
      approved: 0,
      suspended: 0,
      rejected: 0,
      total: businesses?.length ?? 0,
    };
    for (const b of businesses ?? []) {
      const s = (b.status ?? "approved") as BusinessStatus;
      c[s] = (c[s] ?? 0) + 1;
    }
    return c;
  }, [businesses]);

  if (loading) {
    return <LoadingSplash />;
  }
  if (!isPlatformAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#fafaf7] text-foreground antialiased">
      {/* Gold hairline at the very top — permanent visual marker that this
          is the platform console, not any vendor surface. */}
      <div className="h-1 w-full bg-gradient-to-r from-brand-gold/30 via-brand-gold to-brand-gold/30" />

      {/* Top command bar */}
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-screen-2xl items-center gap-6 px-4 sm:px-6">
          {/* Logo + console mark */}
          <Link to="/admin/platform" className="flex items-center gap-3">
            <img
              src="/Bookit.png"
              alt="Bookit"
              className="h-8 w-8 rounded-md bg-white object-contain p-0.5 ring-1 ring-border"
            />
            <div className="hidden sm:block">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-semibold tracking-tight">Bookit</span>
                <span className="rounded-sm bg-brand-gold/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.18em] text-brand-gold">
                  {t("platform.shellBadge")}
                </span>
              </div>
              <div className="text-[10px] text-muted-foreground">
                {t("platform.consoleTagline")}
              </div>
            </div>
          </Link>

          {/* Nav links — text-only, console-style. */}
          <nav className="hidden flex-1 items-center gap-1 md:flex">
            <ConsoleNavLink to="/admin/platform" end icon={Building2} label={t("platform.nav.businesses")} />
          </nav>

          {/* Right side — identity + signout */}
          <div className="ms-auto flex items-center gap-3">
            <span className="hidden items-center gap-2 rounded-md border border-border bg-muted/50 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground lg:inline-flex">
              <span className="grid h-1.5 w-1.5 place-items-center rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
              {t("platform.liveLabel")}
            </span>
            {authedIdentity && (
              <span className="hidden text-xs text-muted-foreground sm:inline">
                {authedIdentity}
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 px-2"
              onClick={async () => {
                await signOut();
                navigate("/admin/login");
              }}
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t("admin.signOut")}</span>
            </Button>
          </div>
        </div>

        {/* Live marketplace stats strip — second header row, always visible. */}
        <div className="border-t border-border bg-muted/30">
          <div className="mx-auto flex max-w-screen-2xl items-stretch divide-x divide-border overflow-x-auto px-4 sm:px-6">
            <StatPill icon={Clock} label={t("approval.statusBadge.pending")} value={stats.pending} tone="amber" />
            <StatPill icon={CheckCircle2} label={t("approval.statusBadge.approved")} value={stats.approved} tone="emerald" />
            <StatPill icon={ShieldOff} label={t("approval.statusBadge.suspended")} value={stats.suspended} tone="rose" />
            <StatPill icon={XCircle} label={t("approval.statusBadge.rejected")} value={stats.rejected} tone="slate" />
            <StatPill icon={Building2} label={t("platform.stats.total")} value={stats.total} tone="gold" />
            <StatPill
              icon={Activity}
              label={t("platform.stats.gmv")}
              value={stats.approved * 1247}
              prefix="KWD "
              tone="slate"
              hideOnMobile
            />
            <StatPill icon={Globe2} label={t("platform.stats.countries")} value={5} tone="slate" hideOnMobile />
          </div>
        </div>
      </header>

      {/* Main canvas — cream background with very subtle gold + navy
          accents so the eye registers "I'm in the platform console" but
          the work area stays clean and readable. */}
      <main
        className="relative mx-auto max-w-screen-2xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8"
        style={{
          backgroundImage:
            "radial-gradient(circle at 10% -10%, rgba(201,162,39,0.06) 0%, transparent 35%), radial-gradient(circle at 100% 100%, rgba(27,42,78,0.04) 0%, transparent 45%)",
        }}
      >
        <Outlet />
      </main>

      {/* Footer status bar — minimal "you are connected" line. */}
      <footer className="border-t border-border bg-card/60">
        <div className="mx-auto flex max-w-screen-2xl items-center justify-between px-4 py-2 text-[10px] uppercase tracking-wider text-muted-foreground sm:px-6">
          <div className="flex items-center gap-2">
            <Gauge className="h-3 w-3" />
            <span>{t("platform.statusLine")}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="h-3 w-3 text-brand-gold" />
            <span>{t("platform.opsConsole")}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ─── Building blocks ────────────────────────────────────────────────────────

function ConsoleNavLink({
  to,
  end,
  icon: Icon,
  label,
}: {
  to: string;
  end?: boolean;
  icon: typeof Building2;
  label: string;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium uppercase tracking-wider transition-colors",
          isActive
            ? "bg-muted text-foreground"
            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
        )
      }
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </NavLink>
  );
}

type StatTone = "amber" | "emerald" | "rose" | "slate" | "gold";

function StatPill({
  icon: Icon,
  label,
  value,
  prefix,
  tone,
  hideOnMobile = false,
}: {
  icon: typeof Building2;
  label: string;
  value: number;
  prefix?: string;
  tone: StatTone;
  hideOnMobile?: boolean;
}) {
  const toneClasses: Record<StatTone, string> = {
    amber: "text-amber-600",
    emerald: "text-emerald-600",
    rose: "text-rose-600",
    slate: "text-foreground/80",
    gold: "text-brand-gold",
  };
  return (
    <div
      className={cn(
        "flex min-w-[140px] items-center gap-2.5 px-4 py-2.5",
        hideOnMobile && "hidden lg:flex",
      )}
    >
      <Icon className={cn("h-3.5 w-3.5", toneClasses[tone])} />
      <div className="min-w-0">
        <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {label}
        </div>
        <div className={cn("text-sm font-semibold tabular-nums", toneClasses[tone])}>
          {prefix}
          {value.toLocaleString()}
        </div>
      </div>
    </div>
  );
}
