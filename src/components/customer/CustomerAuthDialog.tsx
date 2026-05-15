import { useState } from "react";
import { Loader2, Lock, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCustomerAuth } from "@/hooks/useCustomerAuth";
import { useI18n } from "@/hooks/useI18n";
import type { AuthError, CustomerProfile } from "@/lib/customerAuth";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called once the customer is successfully signed in or signed up. */
  onAuthSuccess: (customer: CustomerProfile) => void;
  /** Optional pre-fill if the customer typed their name/email on the booking
   *  form before we asked them to authenticate. */
  prefillName?: string;
  prefillEmail?: string;
  prefillPhone?: string;
}

const ERROR_KEYS: Record<AuthError, string> = {
  "invalid-email": "customerAuth.error.invalidEmail",
  "short-password": "customerAuth.error.shortPassword",
  "no-account": "customerAuth.error.noAccount",
  "wrong-password": "customerAuth.error.wrongPassword",
  "email-taken": "customerAuth.error.emailTaken",
};

export function CustomerAuthDialog({
  open,
  onOpenChange,
  onAuthSuccess,
  prefillName,
  prefillEmail,
  prefillPhone,
}: Props) {
  const { t } = useI18n();
  const { signIn, signUp } = useCustomerAuth();

  const [tab, setTab] = useState<"in" | "up">("in");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [signInEmail, setSignInEmail] = useState(prefillEmail ?? "");
  const [signInPassword, setSignInPassword] = useState("");

  const [signUpName, setSignUpName] = useState(prefillName ?? "");
  const [signUpEmail, setSignUpEmail] = useState(prefillEmail ?? "");
  const [signUpPhone, setSignUpPhone] = useState(prefillPhone ?? "");
  const [signUpPassword, setSignUpPassword] = useState("");

  function handleSignIn() {
    setError(null);
    setBusy(true);
    const result = signIn(signInEmail, signInPassword);
    setBusy(false);
    if (!result.ok) {
      setError(result.error ? t(ERROR_KEYS[result.error] as Parameters<typeof t>[0]) : "Sign-in failed");
      return;
    }
    if (result.customer) onAuthSuccess(result.customer);
  }

  function handleSignUp() {
    setError(null);
    if (!signUpName.trim()) {
      setError(t("customerAuth.error.nameRequired"));
      return;
    }
    setBusy(true);
    const result = signUp({
      name: signUpName,
      email: signUpEmail,
      phone: signUpPhone || null,
      password: signUpPassword,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error ? t(ERROR_KEYS[result.error] as Parameters<typeof t>[0]) : "Sign-up failed");
      return;
    }
    if (result.customer) onAuthSuccess(result.customer);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="mb-3 grid h-11 w-11 place-items-center rounded-xl bg-accent/15 text-accent">
            <Lock className="h-5 w-5" />
          </div>
          <DialogTitle>{t("customerAuth.title")}</DialogTitle>
          <DialogDescription>{t("customerAuth.subtitle")}</DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => { setTab(v as "in" | "up"); setError(null); }}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="in">{t("customerAuth.tabSignIn")}</TabsTrigger>
            <TabsTrigger value="up">{t("customerAuth.tabSignUp")}</TabsTrigger>
          </TabsList>

          <TabsContent value="in" className="space-y-3 pt-4">
            <Field label={t("customerAuth.email")}>
              <Input
                type="email"
                autoComplete="email"
                value={signInEmail}
                onChange={(e) => setSignInEmail(e.target.value)}
              />
            </Field>
            <Field label={t("customerAuth.password")}>
              <Input
                type="password"
                autoComplete="current-password"
                value={signInPassword}
                onChange={(e) => setSignInPassword(e.target.value)}
              />
            </Field>
            {error && tab === "in" && <p className="text-xs text-rose-500">{error}</p>}
            <Button
              className="w-full"
              size="lg"
              disabled={busy}
              onClick={handleSignIn}
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> {t("customerAuth.working")}
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" /> {t("customerAuth.signInBtn")}
                </>
              )}
            </Button>
          </TabsContent>

          <TabsContent value="up" className="space-y-3 pt-4">
            <Field label={t("customerAuth.name")}>
              <Input
                autoComplete="name"
                value={signUpName}
                onChange={(e) => setSignUpName(e.target.value)}
              />
            </Field>
            <Field label={t("customerAuth.email")}>
              <Input
                type="email"
                autoComplete="email"
                value={signUpEmail}
                onChange={(e) => setSignUpEmail(e.target.value)}
              />
            </Field>
            <Field label={t("customerAuth.phone")}>
              <Input
                type="tel"
                autoComplete="tel"
                value={signUpPhone}
                onChange={(e) => setSignUpPhone(e.target.value)}
              />
            </Field>
            <Field label={t("customerAuth.password")}>
              <Input
                type="password"
                autoComplete="new-password"
                minLength={6}
                value={signUpPassword}
                onChange={(e) => setSignUpPassword(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                {t("customerAuth.passwordHint")}
              </p>
            </Field>
            {error && tab === "up" && <p className="text-xs text-rose-500">{error}</p>}
            <Button
              className="w-full"
              size="lg"
              disabled={busy}
              onClick={handleSignUp}
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> {t("customerAuth.working")}
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" /> {t("customerAuth.signUpBtn")}
                </>
              )}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
