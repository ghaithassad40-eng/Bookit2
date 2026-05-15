import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Building2, LogOut, ShieldCheck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/hooks/useI18n";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Shell for the website-admin (platform operator) console. Gated by
 * isPlatformAdmin — anyone else gets redirected to the role-appropriate
 * destination on mount (or to the login page if they aren't signed in).
 */
export function PlatformAdminLayout() {
  const navigate = useNavigate();
  const { user, demoUser, isPlatformAdmin, loading, signOut } = useAuth();
  const { t } = useI18n();
  const authedIdentity = user?.email ?? demoUser?.email ?? null;

  useEffect(() => {
    if (loading) return;
    if (!user && !demoUser) {
      navigate("/admin/login", { replace: true });
      return;
    }
    if (!isPlatformAdmin) {
      // Signed in but not a platform admin — bounce to vendor login flow.
      navigate("/admin/login", { replace: true });
    }
  }, [loading, user, demoUser, isPlatformAdmin, navigate]);

  if (loading || !isPlatformAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[260px_1fr]">
        <aside className="hidden border-r border-border/60 bg-card/40 backdrop-blur-xl lg:flex lg:flex-col">
          <div className="flex h-16 items-center gap-2 border-b border-border/60 px-5">
            <img
              src="/Bookit.png"
              alt="Bookit"
              className="h-8 w-8 rounded-lg object-contain bg-white p-0.5"
            />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">Bookit</div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {t("platform.shellBadge")}
              </div>
            </div>
          </div>
          <nav className="flex-1 space-y-1 p-3">
            <NavLink
              to="/admin/platform"
              end
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-accent/15 text-accent"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )
              }
            >
              <Building2 className="h-4 w-4" />
              {t("platform.nav.businesses")}
            </NavLink>
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
              <Link to="/admin/platform" className="font-semibold">
                Bookit · {t("platform.shellBadge")}
              </Link>
            </div>
            <div className="ms-auto flex items-center gap-3 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/40 bg-blue-500/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-300">
                <ShieldCheck className="h-3 w-3" />
                {t("platform.roleBadge")}
              </span>
              <span className="hidden sm:inline">{authedIdentity}</span>
            </div>
          </header>
          <main className="flex-1 p-4 sm:p-6 lg:p-8">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
