import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Info, ShieldCheck, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAdminBusinesses } from "@/hooks/useAdminBusinesses";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { isSupabaseConfigured } from "@/lib/supabase";
import { DEMO_BUSINESSES } from "@/lib/demoData";
import { useI18n } from "@/hooks/useI18n";
import { getHostMode, goCrossHost } from "@/lib/host";

export default function Login() {
  const { signIn, signUp, user, demoUser, enterDemoMode, requestPasswordReset } = useAuth();
  const navigate = useNavigate();
  const { data: businesses } = useAdminBusinesses(user?.id ?? null);
  const { t, dir } = useI18n();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);

  async function handleForgotPassword() {
    if (!email.trim()) {
      toast.error(t("login.toastForgotEmpty"));
      return;
    }
    setResetBusy(true);
    try {
      const { error } = await requestPasswordReset(email.trim());
      if (error) throw error;
      toast.success(t("login.toastResetSent").replace("{{email}}", email));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("login.toastResetFailed"));
    } finally {
      setResetBusy(false);
    }
  }

  // Cross-host demo handoff. When someone clicks "Try platform admin" on
  // the main host (bk-it.ai), we redirect them here (admin.bk-it.ai) with
  // ?_demo=platform&_email=... — the original host's localStorage doesn't
  // reach this origin, so we recreate the demo session here on first
  // render. The URL params are stripped after consumption so a refresh
  // doesn't keep re-entering demo mode.
  useEffect(() => {
    if (demoUser || user) return;
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("_demo") === "platform") {
        const handoffEmail = params.get("_email") || "platform@bk-it.ai";
        enterDemoMode(handoffEmail, "platform_admin");
        // Clean the URL so refresh / back-button don't replay this.
        window.history.replaceState({}, "", window.location.pathname);
      }
    } catch {
      /* malformed URL — ignore */
    }
  }, [demoUser, user, enterDemoMode]);

  // After auth, route to the right shell based on role *and* host.
  //   - platform_admin → /admin/platform (cross-host jump if needed)
  //   - vendor         → /admin/:slug on the main host
  // Login can land on either host; this resolver makes sure the user
  // ends up on the host that actually serves their destination.
  useEffect(() => {
    const hostMode = getHostMode();

    const goToPlatform = () => {
      if (hostMode === "admin") {
        navigate("/admin/platform", { replace: true });
      } else {
        goCrossHost("admin", "/admin/platform");
      }
    };

    const goToVendor = (slug: string) => {
      if (hostMode === "main") {
        navigate(`/admin/${slug}`, { replace: true });
      } else {
        goCrossHost("main", `/admin/${slug}`);
      }
    };

    if (demoUser) {
      if (demoUser.role === "platform_admin") {
        goToPlatform();
      } else {
        goToVendor(DEMO_BUSINESSES[0].slug);
      }
      return;
    }
    if (user) {
      const role = user.app_metadata?.role as "platform_admin" | "vendor" | undefined;
      if (role === "platform_admin") {
        goToPlatform();
        return;
      }
      if (businesses && businesses.length > 0) {
        goToVendor(businesses[0].slug);
      }
    }
  }, [user, demoUser, businesses, navigate]);

  async function handle(action: "in" | "up") {
    if (!email || !password) {
      toast.error(t("login.toastCredsRequired"));
      return;
    }
    setBusy(true);
    try {
      const fn = action === "in" ? signIn : signUp;
      const { error } = await fn(email, password);
      if (error) throw error;
      toast.success(action === "in" ? t("login.toastSignedIn") : t("login.toastAccountCreated"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("login.toastAuthFailed"));
    } finally {
      setBusy(false);
    }
  }

  function startDemo() {
    enterDemoMode(email.trim() || "demo@bk-it.ai");
    toast.success(t("login.toastDemoStarted"));
  }

  function startPlatformDemo() {
    const demoEmail = email.trim() || "platform@bk-it.ai";
    // Important: localStorage is per-origin, so we cannot enter demo mode
    // on the main host and then cross-host to the admin console — the
    // admin host can't read the main host's localStorage. Instead, we
    // hop to the admin host's /admin/login with a `_demo=platform` hint,
    // and the admin host enters demo mode in its own localStorage on
    // first render (see the effect below that watches the param).
    if (getHostMode() === "admin") {
      enterDemoMode(demoEmail, "platform_admin");
      toast.success(t("login.toastDemoPlatform"));
      navigate("/admin/platform", { replace: true });
    } else {
      goCrossHost(
        "admin",
        `/admin/login?_demo=platform&_email=${encodeURIComponent(demoEmail)}`,
      );
    }
  }

  // Arrow icons that point "forward" in the active reading direction.
  const ForwardArrow = dir === "rtl" ? ArrowLeft : ArrowRight;
  const BackArrow = dir === "rtl" ? ArrowRight : ArrowLeft;

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <img
            src="/Bookit.png"
            alt="Bookit"
            className="mx-auto mb-3 h-20 w-20 rounded-2xl object-contain bg-white shadow-lg shadow-brand-navy/20"
          />
          <h1 className="text-2xl font-semibold tracking-tight">{t("login.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("login.subtitle")}
          </p>
        </div>

        {!isSupabaseConfigured && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 flex items-start gap-2.5 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-sm text-amber-900 dark:text-amber-100"
          >
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="space-y-1">
              <p className="font-medium leading-tight">
                {t("login.noSupabaseTitle")}
              </p>
              <p className="text-xs leading-relaxed opacity-90">
                {t("login.noSupabaseBody")}
              </p>
            </div>
          </motion.div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>{t("login.welcome")}</CardTitle>
            <CardDescription>{t("login.welcomeBody")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="in">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="in">{t("login.tabSignIn")}</TabsTrigger>
                <TabsTrigger value="up">{t("login.tabCreate")}</TabsTrigger>
              </TabsList>
              {(["in", "up"] as const).map((action) => (
                <TabsContent key={action} value={action} className="space-y-3 pt-4">
                  <div className="space-y-1.5">
                    <Label htmlFor={`${action}-email`}>{t("login.email")}</Label>
                    <Input
                      id={`${action}-email`}
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`${action}-pw`}>{t("login.password")}</Label>
                    <Input
                      id={`${action}-pw`}
                      type="password"
                      autoComplete={action === "in" ? "current-password" : "new-password"}
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    {action === "up" && (
                      <p className="text-[11px] text-muted-foreground">
                        {t("login.passwordHint")}
                      </p>
                    )}
                  </div>
                  <Button
                    className="w-full"
                    disabled={busy || !isSupabaseConfigured}
                    onClick={() => handle(action)}
                  >
                    {busy
                      ? t("login.working")
                      : action === "in"
                        ? t("login.signInBtn")
                        : t("login.createBtn")}
                  </Button>
                  {action === "in" && isSupabaseConfigured && (
                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      disabled={resetBusy}
                      className="block w-full text-center text-[11px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:opacity-50"
                    >
                      {resetBusy ? t("login.sendingReset") : t("login.forgot")}
                    </button>
                  )}
                  {!isSupabaseConfigured && (
                    <p className="text-center text-[11px] text-muted-foreground">
                      {t("login.disabledNote")}
                    </p>
                  )}
                </TabsContent>
              ))}
            </Tabs>

            <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-wider text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              {t("login.or")}
              <span className="h-px flex-1 bg-border" />
            </div>

            <Button variant="outline" className="w-full" onClick={startDemo}>
              <Sparkles className="h-4 w-4" />
              {t("login.demoBtn")}
              <ForwardArrow className="h-4 w-4" />
            </Button>
            {/* Platform-admin demo is dev-only — in production, role resolution
                ignores the localStorage DemoUser.role anyway (see useAuth.ts),
                but we also hide the CTA so prod users can't even attempt to
                self-elevate. Real platform admins sign in via Supabase. */}
            {import.meta.env.DEV && (
              <Button
                variant="ghost"
                className="mt-2 w-full text-xs text-muted-foreground"
                onClick={startPlatformDemo}
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                {t("login.demoPlatformBtn")}
              </Button>
            )}
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              {t("login.demoNote")}
            </p>

            {user && businesses?.length === 0 && (
              <p className="pt-4 text-center text-xs text-muted-foreground">
                {t("login.noWorkspace")}
              </p>
            )}
          </CardContent>
        </Card>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          <Link to="/" className="inline-flex items-center gap-1 underline-offset-4 hover:underline">
            <BackArrow className="h-3 w-3" />
            {t("login.backToDemo")}
          </Link>
        </p>
      </div>
    </div>
  );
}
