import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ArrowRight, Info, ShieldCheck, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAdminBusinesses } from "@/hooks/useAdminBusinesses";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { isSupabaseConfigured } from "@/lib/supabase";
import { DEMO_BUSINESSES } from "@/lib/demoData";

export default function Login() {
  const { signIn, signUp, user, demoUser, enterDemoMode, requestPasswordReset } = useAuth();
  const navigate = useNavigate();
  const { data: businesses } = useAdminBusinesses(user?.id ?? null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);

  async function handleForgotPassword() {
    if (!email.trim()) {
      toast.error("Enter your email above, then click 'Forgot password' again");
      return;
    }
    setResetBusy(true);
    try {
      const { error } = await requestPasswordReset(email.trim());
      if (error) throw error;
      toast.success(`Reset link sent to ${email}. Check your inbox.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Reset failed");
    } finally {
      setResetBusy(false);
    }
  }

  // After auth, route to a workspace.
  useEffect(() => {
    if (demoUser) {
      navigate(`/admin/${DEMO_BUSINESSES[0].slug}`, { replace: true });
      return;
    }
    if (user && businesses && businesses.length > 0) {
      navigate(`/admin/${businesses[0].slug}`, { replace: true });
    }
  }, [user, demoUser, businesses, navigate]);

  async function handle(action: "in" | "up") {
    if (!email || !password) {
      toast.error("Email and password are required");
      return;
    }
    setBusy(true);
    try {
      const fn = action === "in" ? signIn : signUp;
      const { error } = await fn(email, password);
      if (error) throw error;
      toast.success(action === "in" ? "Signed in" : "Account created");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  function startDemo() {
    enterDemoMode(email.trim() || "demo@bookit.app");
    toast.success("Welcome — exploring the admin in demo mode");
  }

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-blue-500 to-emerald-400 text-white shadow-lg shadow-blue-500/25">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Bookit Admin</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage every booking, service, and team member.
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
                Real sign-up requires a connected Supabase project.
              </p>
              <p className="text-xs leading-relaxed opacity-90">
                You can still try the admin in demo mode below — every page works
                with the demo businesses and your changes save to this browser.
              </p>
            </div>
          </motion.div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Welcome</CardTitle>
            <CardDescription>Sign in or create your workspace.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="in">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="in">Sign in</TabsTrigger>
                <TabsTrigger value="up">Create account</TabsTrigger>
              </TabsList>
              {(["in", "up"] as const).map((action) => (
                <TabsContent key={action} value={action} className="space-y-3 pt-4">
                  <div className="space-y-1.5">
                    <Label htmlFor={`${action}-email`}>Email</Label>
                    <Input
                      id={`${action}-email`}
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`${action}-pw`}>Password</Label>
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
                        At least 8 characters.
                      </p>
                    )}
                  </div>
                  <Button
                    className="w-full"
                    disabled={busy || !isSupabaseConfigured}
                    onClick={() => handle(action)}
                  >
                    {busy ? "Working…" : action === "in" ? "Sign in" : "Create account"}
                  </Button>
                  {action === "in" && isSupabaseConfigured && (
                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      disabled={resetBusy}
                      className="block w-full text-center text-[11px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:opacity-50"
                    >
                      {resetBusy ? "Sending reset link…" : "Forgot password?"}
                    </button>
                  )}
                  {!isSupabaseConfigured && (
                    <p className="text-center text-[11px] text-muted-foreground">
                      Sign-in is disabled without Supabase. Use the demo below.
                    </p>
                  )}
                </TabsContent>
              ))}
            </Tabs>

            <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-wider text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              or
              <span className="h-px flex-1 bg-border" />
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={startDemo}
            >
              <Sparkles className="h-4 w-4" />
              Try the demo admin
              <ArrowRight className="h-4 w-4" />
            </Button>
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              Browse the admin against the live demo businesses. Changes save to
              your browser only.
            </p>

            {user && businesses?.length === 0 && (
              <p className="pt-4 text-center text-xs text-muted-foreground">
                You're signed in, but no workspace is linked to your account yet.
                Contact your administrator to be added as an owner.
              </p>
            )}
          </CardContent>
        </Card>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          <Link to="/" className="underline-offset-4 hover:underline">
            ← Back to demo
          </Link>
        </p>
      </div>
    </div>
  );
}
