import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useAdminBusinesses } from "@/hooks/useAdminBusinesses";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export default function Login() {
  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();
  const { data: businesses } = useAdminBusinesses(user?.id ?? null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function handle(action: "in" | "up") {
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

  // already signed in?
  if (user && businesses && businesses.length > 0) {
    navigate(`/admin/${businesses[0].slug}`, { replace: true });
  }

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Bookit Admin</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage every booking, service, and team member.
          </p>
        </div>
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
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  <Button className="w-full" disabled={busy} onClick={() => handle(action)}>
                    {action === "in" ? "Sign in" : "Create account"}
                  </Button>
                </TabsContent>
              ))}
            </Tabs>
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
