import { Link, NavLink, Outlet, useNavigate, useParams } from "react-router-dom";
import {
  CalendarRange,
  LayoutDashboard,
  LogOut,
  Settings,
  Sparkles,
  Tags,
  Users,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useBusiness } from "@/hooks/useBusiness";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ThemeProvider } from "@/components/ThemeProvider";
import { cn, initials } from "@/lib/utils";
import { useEffect } from "react";

const NAV = [
  { to: "", icon: LayoutDashboard, label: "Overview" },
  { to: "bookings", icon: CalendarRange, label: "Bookings" },
  { to: "services", icon: Tags, label: "Services" },
  { to: "staff", icon: Users, label: "Staff" },
  { to: "slots", icon: Sparkles, label: "Slots" },
  { to: "settings", icon: Settings, label: "Settings" },
];

export function AdminLayout() {
  const { slug } = useParams();
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const { data, isLoading } = useBusiness(slug);

  useEffect(() => {
    if (!loading && !user) navigate("/admin/login", { replace: true });
  }, [loading, user, navigate]);

  if (loading || isLoading) {
    return (
      <div className="container py-12 space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="container py-24 text-center">
        <h1 className="text-2xl font-semibold">Workspace not found</h1>
        <p className="mt-2 text-muted-foreground">No business with slug "{slug}".</p>
      </div>
    );
  }

  const { business, config } = data;

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
                <div className="truncate text-sm font-semibold">{business.name}</div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Admin
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
                  {item.label}
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
                Sign out
              </Button>
            </div>
          </aside>

          <div className="flex min-h-screen flex-col">
            <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border/60 bg-background/70 px-4 backdrop-blur-xl">
              <div className="flex items-center gap-3 lg:hidden">
                <Link to={`/admin/${slug}`} className="font-semibold">
                  {business.name}
                </Link>
              </div>
              <div className="ml-auto flex items-center gap-3 text-sm text-muted-foreground">
                <span className="hidden sm:inline">{user?.email}</span>
              </div>
            </header>
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
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
        </div>
      </div>
    </ThemeProvider>
  );
}
