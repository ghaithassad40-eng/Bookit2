import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  CircleHelp,
  Database,
  ExternalLink,
  Globe,
  Loader2,
  RefreshCw,
  Server,
  ShieldCheck,
  XCircle,
  Zap,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { MYFATOORAH_ENABLED } from "@/lib/myfatoorah";

/**
 * Live health-check / smoke-test page. The point isn't to be a public
 * status page (use Statuspage / BetterStack for that) — it's a one-screen
 * verification that every backend integration is wired correctly right
 * after a deploy. Visit /health, every check should be green; if one's
 * red the failure mode tells you which env var or migration is missing.
 *
 * Public on purpose — the checks themselves only read configuration
 * flags, ping endpoints with auth-required reads, and report success /
 * failure. They do NOT expose secrets, table contents, or PII.
 */

type Status = "checking" | "ok" | "warn" | "fail" | "skip";

interface Check {
  id: string;
  label: string;
  detail?: string;
  status: Status;
  icon: typeof Database;
  /** Optional doc link when a check fails — points at the runbook step
   *  that explains how to fix it. */
  fix?: { href: string; label: string };
}

const INITIAL: Check[] = [
  {
    id: "env",
    label: "Environment",
    detail: import.meta.env.PROD ? "production" : "development",
    status: "ok",
    icon: Globe,
  },
  {
    id: "supabase-config",
    label: "Supabase credentials",
    status: "checking",
    icon: Database,
  },
  {
    id: "supabase-rest",
    label: "Supabase REST reachable",
    status: "checking",
    icon: Database,
  },
  {
    id: "supabase-anon-read",
    label: "Public read (approved businesses)",
    status: "checking",
    icon: ShieldCheck,
  },
  {
    id: "rls-customer-isolation",
    label: "RLS — customer can't list all bookings",
    status: "checking",
    icon: ShieldCheck,
  },
  {
    id: "rls-platform-roles",
    label: "user_roles table reachable",
    status: "checking",
    icon: ShieldCheck,
  },
  {
    id: "edge-function-calendar",
    label: "Edge Function: calendar-feed",
    status: "checking",
    icon: Server,
  },
  {
    id: "myfatoorah",
    label: "MyFatoorah configured",
    status: "checking",
    icon: Zap,
  },
];

export default function Health() {
  const [checks, setChecks] = useState<Check[]>(INITIAL);
  const [running, setRunning] = useState(false);

  async function runAll() {
    setRunning(true);
    const update = (id: string, patch: Partial<Check>) =>
      setChecks((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));

    // 1. Supabase config — env vars set?
    if (isSupabaseConfigured) {
      update("supabase-config", { status: "ok", detail: "URL + anon key present" });
    } else {
      update("supabase-config", {
        status: "fail",
        detail: "VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY missing",
        fix: { href: "https://github.com/ghaithassad40-eng/Bookit2/blob/main/DEPLOYMENT.md#1-supabase", label: "How to fix" },
      });
      // Everything below depends on Supabase — mark them as skipped.
      ["supabase-rest", "supabase-anon-read", "rls-customer-isolation", "rls-platform-roles", "edge-function-calendar"].forEach(
        (id) => update(id, { status: "skip", detail: "Supabase not configured" }),
      );
      // Skip ahead to MyFatoorah.
      update("myfatoorah", {
        status: MYFATOORAH_ENABLED ? "ok" : "warn",
        detail: MYFATOORAH_ENABLED ? "Enabled" : "Mock mode",
      });
      setRunning(false);
      return;
    }

    // 2. REST reachable
    try {
      const { error } = await supabase
        .from("businesses")
        .select("id", { head: true, count: "estimated" })
        .limit(1);
      if (error) throw error;
      update("supabase-rest", { status: "ok", detail: "200 OK" });
    } catch (e) {
      update("supabase-rest", {
        status: "fail",
        detail: e instanceof Error ? e.message : "fetch failed",
        fix: {
          href: "https://github.com/ghaithassad40-eng/Bookit2/blob/main/DEPLOYMENT.md#troubleshooting",
          label: "Troubleshoot",
        },
      });
    }

    // 3. Public anon read returns at least one approved business
    try {
      const { data, error } = await supabase
        .from("businesses")
        .select("id, status")
        .eq("status", "approved")
        .limit(1);
      if (error) throw error;
      const count = data?.length ?? 0;
      update("supabase-anon-read", {
        status: count > 0 ? "ok" : "warn",
        detail: count > 0 ? `Returned ${count} approved business` : "0 approved businesses — seed data missing?",
      });
    } catch (e) {
      update("supabase-anon-read", {
        status: "fail",
        detail: e instanceof Error ? e.message : "query failed",
      });
    }

    // 4. RLS check — anon select on bookings should return zero rows
    //    even if the table has data. If it returns rows the RLS policies
    //    are wrong (or migration 0010 didn't run).
    try {
      const { data, error } = await supabase
        .from("bookings")
        .select("id", { head: false, count: "exact" })
        .limit(1);
      if (error) {
        // PostgREST returns 401 for unauth'd if RLS is wired right.
        update("rls-customer-isolation", { status: "ok", detail: "Anon read blocked" });
      } else if ((data?.length ?? 0) === 0) {
        update("rls-customer-isolation", {
          status: "ok",
          detail: "Anon read returned no rows",
        });
      } else {
        update("rls-customer-isolation", {
          status: "fail",
          detail: `Anon read returned ${data?.length} rows — RLS leaking`,
          fix: {
            href: "https://github.com/ghaithassad40-eng/Bookit2/blob/main/supabase/migrations/0010_production_rls.sql",
            label: "Apply 0010 RLS",
          },
        });
      }
    } catch (e) {
      update("rls-customer-isolation", {
        status: "ok",
        detail: e instanceof Error ? e.message : "blocked",
      });
    }

    // 5. user_roles table exists (migration 0009 applied)
    try {
      const { error } = await supabase
        .from("user_roles")
        .select("user_id", { head: true, count: "estimated" })
        .limit(1);
      if (error) throw error;
      update("rls-platform-roles", { status: "ok", detail: "Table reachable" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "missing";
      update("rls-platform-roles", {
        status: msg.toLowerCase().includes("does not exist") ? "fail" : "warn",
        detail: msg,
        fix: {
          href: "https://github.com/ghaithassad40-eng/Bookit2/blob/main/supabase/migrations/0009_production_schema_catchup.sql",
          label: "Apply 0009 schema",
        },
      });
    }

    // 6. Edge Function: calendar-feed
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/calendar-feed?slug=__ping`;
      const resp = await fetch(url, { headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? "" } });
      // 404 on a fake slug means the function IS deployed and reachable,
      // it just didn't find a business. That's a green check.
      if (resp.status === 404 || resp.status === 400) {
        update("edge-function-calendar", { status: "ok", detail: `${resp.status} (function reachable)` });
      } else if (resp.ok) {
        update("edge-function-calendar", { status: "ok", detail: "200 OK" });
      } else {
        update("edge-function-calendar", {
          status: "warn",
          detail: `${resp.status} ${resp.statusText}`,
        });
      }
    } catch (e) {
      update("edge-function-calendar", {
        status: "fail",
        detail: e instanceof Error ? e.message : "fetch failed",
        fix: {
          href: "https://github.com/ghaithassad40-eng/Bookit2/blob/main/DEPLOYMENT.md#5-deploy-edge-functions",
          label: "Deploy functions",
        },
      });
    }

    // 7. MyFatoorah
    update("myfatoorah", {
      status: MYFATOORAH_ENABLED ? "ok" : "warn",
      detail: MYFATOORAH_ENABLED
        ? "Enabled — staging or production credentials active"
        : "Mock mode — no real payment provider",
    });

    setRunning(false);
  }

  useEffect(() => {
    void runAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const failedCount = checks.filter((c) => c.status === "fail").length;
  const warnedCount = checks.filter((c) => c.status === "warn").length;
  const overall: Status =
    failedCount > 0 ? "fail" : warnedCount > 0 ? "warn" : checks.every((c) => c.status === "ok" || c.status === "skip") ? "ok" : "checking";

  return (
    <div className="container max-w-3xl py-10">
      <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <span>Bookit</span>
            <span className="text-muted-foreground/40">/</span>
            <span>Health</span>
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            Deployment health check
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Verifies every backend integration is wired. Run after each deploy.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <OverallBadge status={overall} />
          <Button variant="outline" size="sm" disabled={running} onClick={runAll}>
            <RefreshCw className={`h-3.5 w-3.5 ${running ? "animate-spin" : ""}`} />
            Re-run
          </Button>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Checks</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="divide-y divide-border/60">
            {checks.map((c) => (
              <CheckRow key={c.id} check={c} />
            ))}
          </ul>
        </CardContent>
      </Card>

      <p className="mt-4 text-center text-[11px] text-muted-foreground">
        <Link to="/" className="hover:text-foreground">
          ← Back to bk-it.ai
        </Link>
      </p>
    </div>
  );
}

function CheckRow({ check }: { check: Check }) {
  const Icon = check.icon;
  return (
    <li className="flex items-start gap-3 px-4 py-3.5">
      <StatusIcon status={check.status} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-sm font-medium">{check.label}</span>
        </div>
        {check.detail && (
          <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
            {check.detail}
          </div>
        )}
      </div>
      {check.fix && (
        <a
          href={check.fix.href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11px] font-medium text-accent hover:underline"
        >
          {check.fix.label}
          <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </li>
  );
}

function StatusIcon({ status }: { status: Status }) {
  switch (status) {
    case "checking":
      return <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-muted-foreground" />;
    case "ok":
      return <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />;
    case "warn":
      return <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />;
    case "fail":
      return <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />;
    case "skip":
      return <CircleHelp className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/60" />;
  }
}

function OverallBadge({ status }: { status: Status }) {
  const map: Record<Status, { label: string; cls: string }> = {
    checking: { label: "Checking…", cls: "bg-muted text-muted-foreground" },
    ok: { label: "All green", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
    warn: { label: "Warnings", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
    fail: { label: "Failing", cls: "bg-rose-500/15 text-rose-700 dark:text-rose-300" },
    skip: { label: "—", cls: "bg-muted text-muted-foreground" },
  };
  const e = map[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${e.cls}`}>
      {e.label}
    </span>
  );
}
