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

  // After auth, route to the right shell based on role.
  useEffect(() => {
    if (demoUser) {
      if (demoUser.role === "platform_admin") {
        navigate("/admin/platform", { replace: true });
      } else {
        navigate(`/admin/${DEMO_BUSINESSES[0].slug}`, { replace: true });
      }
      return;
    }
    if (user) {
      const role = user.app_metadata?.role as "platform_admin" | "vendor" | undefined;
      if (role === "platform_admin") {
        navigate("/admin/platform", { replace: true });
        return;
      }
      if (businesses && businesses.length > 0) {
        navigate(`/admin/${businesses[0].slug}`, { replace: true });
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
    enterDemoMode(email.trim() || "demo@bookit.app");
    toast.success(t("login.toastDemoStarted"));
  }

  function startPlatformDemo() {
    enterDemoMode(email.trim() || "platform@bookit.app", "platform_admin");
    toast.success(t("login.toastDemoPlatform"));
    navigate("/admin/platform", { replace: true });
  }

  // Arrow icons that point "forward" in the active reading direction.
  const ForwardArrow = dir === "rtl" ? ArrowLeft : ArrowRight;
  const BackArrow = dir === "rtl" ? ArrowRight : ArrowLeft;

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-blue-500 to-emerald-400 text-white shadow-lg shadow-blue-500/25">
            <ShieldCheck className="h-5 w-5" />
          </div>
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
            <Button
              variant="ghost"
              className="mt-2 w-full text-xs text-muted-foreground"
              onClick={startPlatformDemo}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              {t("login.demoPlatformBtn")}
            </Button>
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
