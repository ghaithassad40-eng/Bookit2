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
 * Operations console for marketplace operators. Deliberately *unlike* the
 * vendor admin shell (sidebar + branded workspace) — this one is a
 * top-nav + live-stats command bar, dark slate ops-theme, dense data
 * tables. The visual difference makes it impossible to forget which
 * surface you're driving.
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
    <div className="min-h-screen bg-[#060a18] font-mono-tabular text-slate-100 antialiased">
      {/* Gold-tinted hairline at the very top edge — a permanent visual
          marker that you are on the platform console, not any vendor page. */}
      <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-brand-gold/80 to-transparent" />

      {/* Top command bar */}
      <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-[#0a1124]/95 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-screen-2xl items-center gap-6 px-4 sm:px-6">
          {/* Logo + console mark */}
          <Link to="/admin/platform" className="flex items-center gap-3">
            <img
              src="/Bookit.png"
              alt="Bookit"
              className="h-8 w-8 rounded-md bg-white object-contain p-0.5"
            />
            <div className="hidden sm:block">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-semibold tracking-tight">Bookit</span>
                <span className="rounded-sm bg-brand-gold/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.18em] text-brand-gold">
                  {t("platform.shellBadge")}
                </span>
              </div>
              <div className="text-[10px] text-slate-400">
                {t("platform.consoleTagline")}
              </div>
            </div>
          </Link>

          {/* Nav links — text-only, terminal-style. No pill buttons. */}
          <nav className="hidden flex-1 items-center gap-1 md:flex">
            <ConsoleNavLink to="/admin/platform" end icon={Building2} label={t("platform.nav.businesses")} />
            {/* Future ops surfaces would land here as additional text links. */}
          </nav>

          {/* Right side — identity + signout */}
          <div className="ms-auto flex items-center gap-3">
            <span className="hidden items-center gap-2 rounded-md border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-slate-300 lg:inline-flex">
              <span className="grid h-1.5 w-1.5 place-items-center rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]" />
              {t("platform.liveLabel")}
            </span>
            {authedIdentity && (
              <span className="hidden text-xs text-slate-300 sm:inline">
                {authedIdentity}
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 px-2 text-slate-300 hover:bg-white/[0.06] hover:text-white"
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

        {/* Live marketplace stats strip — second header row. Always visible. */}
        <div className="border-t border-white/[0.04] bg-[#070d1d]/80">
          <div className="mx-auto flex max-w-screen-2xl items-stretch divide-x divide-white/[0.04] overflow-x-auto px-4 sm:px-6">
            <StatPill
              icon={Clock}
              label={t("approval.statusBadge.pending")}
              value={stats.pending}
              tone="amber"
            />
            <StatPill
              icon={CheckCircle2}
              label={t("approval.statusBadge.approved")}
              value={stats.approved}
              tone="emerald"
            />
            <StatPill
              icon={ShieldOff}
              label={t("approval.statusBadge.suspended")}
              value={stats.suspended}
              tone="rose"
            />
            <StatPill
              icon={XCircle}
              label={t("approval.statusBadge.rejected")}
              value={stats.rejected}
              tone="slate"
            />
            <StatPill
              icon={Building2}
              label={t("platform.stats.total")}
              value={stats.total}
              tone="gold"
            />
            <StatPill
              icon={Activity}
              label={t("platform.stats.gmv")}
              value={stats.approved * 1247}
              prefix="KWD "
              tone="slate"
              hideOnMobile
            />
            <StatPill
              icon={Globe2}
              label={t("platform.stats.countries")}
              value={5}
              tone="slate"
              hideOnMobile
            />
          </div>
        </div>
      </header>

      {/* Main content — wider canvas, dark slate backdrop with subtle grid
          texture to reinforce the ops-console feel. */}
      <main
        className="relative mx-auto max-w-screen-2xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 0%, rgba(201,162,39,0.04) 0%, transparent 40%), radial-gradient(circle at 100% 100%, rgba(27,42,78,0.18) 0%, transparent 50%)",
        }}
      >
        <Outlet />
      </main>

      {/* Footer status bar — minimal, terminal-style "you are connected" line. */}
      <footer className="border-t border-white/[0.04] bg-[#070d1d]/60">
        <div className="mx-auto flex max-w-screen-2xl items-center justify-between px-4 py-2 text-[10px] uppercase tracking-wider text-slate-500 sm:px-6">
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
            ? "bg-white/[0.06] text-white"
            : "text-slate-400 hover:bg-white/[0.03] hover:text-slate-100",
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
    amber: "text-amber-300",
    emerald: "text-emerald-300",
    rose: "text-rose-300",
    slate: "text-slate-200",
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
        <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-400">
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
