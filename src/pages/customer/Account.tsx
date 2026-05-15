import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  CreditCard,
  Hash,
  LogOut,
  Mail,
  MapPin,
  Phone,
  Plus,
  ShieldCheck,
  Trash2,
  User,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCustomerAuth } from "@/hooks/useCustomerAuth";
import {
  changeCustomerPassword,
  updateCustomerProfile,
} from "@/lib/customerAuth";
import {
  addPaymentMethod,
  detectBrandFromNumber,
  listPaymentMethods,
  onPaymentMethodsChange,
  removePaymentMethod,
  setAutoPay,
  setDefaultPaymentMethod,
  type CardBrand,
  type SavedPaymentMethod,
} from "@/lib/customerPaymentMethods";
import { getLocalBookings } from "@/lib/localBookings";
import { DEMO_BUSINESSES, DEMO_SERVICES, generateDemoSlots } from "@/lib/demoData";
import { formatCurrency, formatDate, formatTime, initials } from "@/lib/utils";
import { useI18n } from "@/hooks/useI18n";
import { pickLocale, type Locale } from "@/lib/i18n";
import type { BookingRow } from "@/lib/database.types";

/**
 * Customer self-service hub. Visible only when signed in (router
 * bounces anonymous customers to /). Three tabs:
 *
 *   1. Bookings  — every booking made under this customer's email,
 *                  across all vendors. Click through to the receipt.
 *   2. Profile   — edit name + phone + change password. Email stays
 *                  read-only (email-change needs a verify flow that
 *                  isn't in scope for the demo).
 *   3. Payment   — saved cards with default + auto-pay toggles. The
 *                  auto-pay flag is read by Book.tsx on the Payment
 *                  step to surface one-tap "Pay with saved card".
 */
export default function Account() {
  const { customer, isAuthenticated, signOut } = useCustomerAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { t } = useI18n();
  const tab = params.get("tab") ?? "bookings";

  // Bounce anonymous visitors back home — Account is signed-in only.
  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  if (!customer) return null;

  return (
    <div className="container max-w-4xl py-8 sm:py-12">
      <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-base font-bold text-primary">
            {initials(customer.name)}
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {t("account.title").replace("{{name}}", customer.name.split(" ")[0])}
            </h1>
            <p className="text-sm text-muted-foreground">{customer.email}</p>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            signOut();
            toast.success(t("account.toast.signedOut"));
            navigate("/");
          }}
        >
          <LogOut className="h-4 w-4" />
          {t("account.signOut")}
        </Button>
      </header>

      <Tabs
        value={tab}
        onValueChange={(v) => {
          const next = new URLSearchParams(params);
          next.set("tab", v);
          setParams(next, { replace: true });
        }}
      >
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="bookings">
            <Calendar className="h-3.5 w-3.5" />
            {t("account.tabs.bookings")}
          </TabsTrigger>
          <TabsTrigger value="profile">
            <User className="h-3.5 w-3.5" />
            {t("account.tabs.profile")}
          </TabsTrigger>
          <TabsTrigger value="payment">
            <CreditCard className="h-3.5 w-3.5" />
            {t("account.tabs.payment")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="bookings" className="mt-4">
          <BookingsTab customerEmail={customer.email} />
        </TabsContent>

        <TabsContent value="profile" className="mt-4">
          <ProfileTab />
        </TabsContent>

        <TabsContent value="payment" className="mt-4">
          <PaymentMethodsTab customerId={customer.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Bookings tab ───────────────────────────────────────────────────────────

function BookingsTab({ customerEmail }: { customerEmail: string }) {
  const { t, locale, intl } = useI18n();

  const bookings = useMemo(() => {
    const all = getLocalBookings();
    return all
      .filter((b) => b.customer_email?.toLowerCase() === customerEmail.toLowerCase())
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [customerEmail]);

  if (bookings.length === 0) {
    return (
      <Card>
        <CardContent className="py-10">
          <EmptyState
            title={t("account.bookings.emptyTitle")}
            description={t("account.bookings.emptyBody")}
            action={
              <Button asChild>
                <Link to="/">
                  {t("account.bookings.browse")} <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            }
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {bookings.map((b) => (
        <BookingRowCard key={b.id} booking={b} locale={locale} intlLoc={intl()} t={t} />
      ))}
    </div>
  );
}

function BookingRowCard({
  booking,
  locale,
  intlLoc,
  t,
}: {
  booking: BookingRow;
  locale: Locale;
  intlLoc: string;
  t: ReturnType<typeof useI18n>["t"];
}) {
  // Resolve slot start_time for the booking — demo only.
  const slot = useMemo(() => {
    return generateDemoSlots(booking.business_id).find((s) => s.id === booking.slot_id);
  }, [booking.business_id, booking.slot_id]);

  const service = DEMO_SERVICES.find((s) => s.id === booking.service_id);
  const business = DEMO_BUSINESSES.find((b) => b.id === booking.business_id);

  const statusVariant: Record<BookingRow["status"], "default" | "success" | "warning" | "destructive" | "secondary"> = {
    pending: "warning",
    confirmed: "default",
    completed: "success",
    cancelled: "destructive",
    no_show: "secondary",
  };

  return (
    <Card className="overflow-hidden">
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-accent/10 text-accent">
            <Calendar className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">
                {service ? pickLocale(locale, service.name, service.name_ar) : "—"}
              </span>
              <Badge variant={statusVariant[booking.status]} className="text-[10px] uppercase">
                {booking.status}
              </Badge>
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {business && (
                <>
                  <span>{pickLocale(locale, business.name, business.name_ar)}</span>
                  <span className="opacity-50">·</span>
                </>
              )}
              {slot && (
                <span>
                  {formatDate(slot.start_time, intlLoc)} · {formatTime(slot.start_time, intlLoc)}
                </span>
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
              <span className="font-mono uppercase">
                <Hash className="me-0.5 inline h-3 w-3" />
                {booking.booking_reference}
              </span>
              {booking.payment_amount != null && booking.payment_currency && (
                <>
                  <span className="opacity-50">·</span>
                  <span>{formatCurrency(booking.payment_amount, booking.payment_currency)}</span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 gap-2 sm:flex-col sm:items-end">
          {business && (
            <Button variant="outline" size="sm" asChild>
              <Link
                to={`/business/${business.slug}/confirmation?ref=${encodeURIComponent(booking.booking_reference)}`}
              >
                {t("account.bookings.viewReceipt")}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Profile tab ────────────────────────────────────────────────────────────

function ProfileTab() {
  const { customer } = useCustomerAuth();
  const { t } = useI18n();
  const [name, setName] = useState(customer?.name ?? "");
  const [phone, setPhone] = useState(customer?.phone ?? "");
  const [savingProfile, setSavingProfile] = useState(false);

  // Password change state.
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [savingPw, setSavingPw] = useState(false);

  function handleSaveProfile() {
    if (!name.trim()) {
      toast.error(t("account.profile.toast.nameRequired"));
      return;
    }
    setSavingProfile(true);
    try {
      const updated = updateCustomerProfile({ name, phone });
      if (updated) toast.success(t("account.profile.toast.saved"));
      else toast.error(t("account.profile.toast.failed"));
    } finally {
      setSavingProfile(false);
    }
  }

  function handleChangePassword() {
    if (!currentPw || !newPw) {
      toast.error(t("account.profile.toast.bothPwRequired"));
      return;
    }
    setSavingPw(true);
    const result = changeCustomerPassword(currentPw, newPw);
    setSavingPw(false);
    if (result.ok) {
      toast.success(t("account.profile.toast.pwChanged"));
      setCurrentPw("");
      setNewPw("");
      return;
    }
    if (result.error === "wrong-current") {
      toast.error(t("account.profile.toast.wrongCurrent"));
    } else if (result.error === "short-new") {
      toast.error(t("account.profile.toast.shortNew"));
    } else {
      toast.error(t("account.profile.toast.failed"));
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{t("account.profile.detailsTitle")}</CardTitle>
          <CardDescription>{t("account.profile.detailsBody")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Field label={t("account.profile.name")} icon={User}>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label={t("account.profile.phone")} icon={Phone}>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+965 XXXX XXXX"
            />
          </Field>
          <Field label={t("account.profile.email")} icon={Mail}>
            <Input value={customer?.email ?? ""} disabled readOnly />
            <p className="text-[11px] text-muted-foreground">
              {t("account.profile.emailLocked")}
            </p>
          </Field>
          <div className="sm:col-span-2">
            <Button disabled={savingProfile} onClick={handleSaveProfile}>
              <CheckCircle2 className="h-4 w-4" />
              {t("account.profile.save")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("account.profile.pwTitle")}</CardTitle>
          <CardDescription>{t("account.profile.pwBody")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Field label={t("account.profile.currentPw")} icon={ShieldCheck}>
            <Input
              type="password"
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              autoComplete="current-password"
            />
          </Field>
          <Field label={t("account.profile.newPw")} icon={ShieldCheck}>
            <Input
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              autoComplete="new-password"
              minLength={6}
            />
            <p className="text-[11px] text-muted-foreground">
              {t("account.profile.pwHint")}
            </p>
          </Field>
          <div className="sm:col-span-2">
            <Button disabled={savingPw} onClick={handleChangePassword}>
              <ShieldCheck className="h-4 w-4" />
              {t("account.profile.changePw")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Payment methods tab ────────────────────────────────────────────────────

function PaymentMethodsTab({ customerId }: { customerId: string }) {
  const { t } = useI18n();
  const [methods, setMethods] = useState(() => listPaymentMethods(customerId));
  const [addOpen, setAddOpen] = useState(false);

  // Live-refresh whenever the underlying storage changes (e.g. another
  // tab adds a card, or autoPay/default toggles fire below).
  useEffect(() => {
    return onPaymentMethodsChange(() => {
      setMethods(listPaymentMethods(customerId));
    });
  }, [customerId]);

  function handleRemove(id: string) {
    if (!confirm(t("account.payment.removeConfirm"))) return;
    removePaymentMethod(id);
    toast.success(t("account.payment.toast.removed"));
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              {t("account.payment.title")}
            </CardTitle>
            <CardDescription>{t("account.payment.subtitle")}</CardDescription>
          </div>
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" />
            {t("account.payment.addCard")}
          </Button>
        </CardHeader>
        <CardContent>
          {methods.length === 0 ? (
            <EmptyState
              title={t("account.payment.emptyTitle")}
              description={t("account.payment.emptyBody")}
              action={
                <Button onClick={() => setAddOpen(true)}>
                  <Plus className="h-4 w-4" />
                  {t("account.payment.addCard")}
                </Button>
              }
            />
          ) : (
            <ul className="space-y-2">
              {methods.map((m) => (
                <PaymentMethodRow key={m.id} method={m} onRemove={() => handleRemove(m.id)} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-start gap-3 p-4">
          <Zap className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <p className="text-xs text-muted-foreground">
            {t("account.payment.autoPayExplainer")}
          </p>
        </CardContent>
      </Card>

      <AddCardDialog
        open={addOpen}
        customerId={customerId}
        onOpenChange={setAddOpen}
      />
    </div>
  );
}

function PaymentMethodRow({
  method,
  onRemove,
}: {
  method: SavedPaymentMethod;
  onRemove: () => void;
}) {
  const { t } = useI18n();
  const brandLabel: Record<CardBrand, string> = {
    visa: "Visa",
    mastercard: "Mastercard",
    amex: "Amex",
    knet: "KNET",
    mada: "mada",
    apple_pay: "Apple Pay",
    google_pay: "Google Pay",
    other: t("account.payment.card"),
  };
  return (
    <li
      className={`flex flex-col gap-3 rounded-xl border p-3 transition-colors sm:flex-row sm:items-center sm:justify-between ${
        method.isDefault ? "border-accent/50 bg-accent/5" : "border-border bg-card"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-14 shrink-0 place-items-center rounded-md bg-muted text-[10px] font-bold uppercase">
          {brandLabel[method.brand]}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-semibold">•••• {method.last4}</span>
            {method.isDefault && (
              <Badge variant="default" className="text-[9px] uppercase">
                {t("account.payment.default")}
              </Badge>
            )}
            {method.autoPay && (
              <Badge variant="success" className="gap-1 text-[9px] uppercase">
                <Zap className="h-2.5 w-2.5" />
                {t("account.payment.autoPay")}
              </Badge>
            )}
          </div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            {method.cardholderName} ·{" "}
            {String(method.expMonth).padStart(2, "0")}/
            {String(method.expYear).slice(-2)}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1">
        {!method.isDefault && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDefaultPaymentMethod(method.id)}
          >
            {t("account.payment.makeDefault")}
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setAutoPay(method.id, !method.autoPay)}
        >
          {method.autoPay
            ? t("account.payment.turnOffAutoPay")
            : t("account.payment.turnOnAutoPay")}
        </Button>
        <Button variant="ghost" size="icon" onClick={onRemove} aria-label="Remove">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </li>
  );
}

function AddCardDialog({
  open,
  customerId,
  onOpenChange,
}: {
  open: boolean;
  customerId: string;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useI18n();
  const [number, setNumber] = useState("");
  const [name, setName] = useState("");
  const [exp, setExp] = useState("");
  const [cvc, setCvc] = useState("");
  const [autoPayOn, setAutoPayOn] = useState(true);
  const [setDefault, setSetDefault] = useState(true);

  function reset() {
    setNumber("");
    setName("");
    setExp("");
    setCvc("");
    setAutoPayOn(true);
    setSetDefault(true);
  }

  function handleSubmit() {
    const cleanedNumber = number.replace(/\s/g, "");
    if (cleanedNumber.length < 12) {
      toast.error(t("account.payment.toast.invalidNumber"));
      return;
    }
    if (!name.trim()) {
      toast.error(t("account.payment.toast.nameRequired"));
      return;
    }
    const match = /^(\d{1,2})\s*\/\s*(\d{2,4})$/.exec(exp.trim());
    if (!match) {
      toast.error(t("account.payment.toast.invalidExp"));
      return;
    }
    const month = parseInt(match[1], 10);
    let year = parseInt(match[2], 10);
    if (year < 100) year += 2000;
    if (month < 1 || month > 12) {
      toast.error(t("account.payment.toast.invalidExp"));
      return;
    }
    if (!/^\d{3,4}$/.test(cvc)) {
      toast.error(t("account.payment.toast.invalidCvc"));
      return;
    }

    addPaymentMethod({
      customer_id: customerId,
      brand: detectBrandFromNumber(cleanedNumber),
      last4: cleanedNumber.slice(-4),
      expMonth: month,
      expYear: year,
      cardholderName: name,
      setDefault,
      autoPay: autoPayOn,
    });
    toast.success(t("account.payment.toast.added"));
    reset();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="mb-3 grid h-11 w-11 place-items-center rounded-xl bg-accent/15 text-accent">
            <CreditCard className="h-5 w-5" />
          </div>
          <DialogTitle>{t("account.payment.addTitle")}</DialogTitle>
          <DialogDescription>
            {t("account.payment.addBody")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Field label={t("account.payment.field.number")} icon={CreditCard}>
            <Input
              value={number}
              onChange={(e) => {
                // Group the input visually as XXXX XXXX XXXX XXXX.
                const cleaned = e.target.value.replace(/\D/g, "").slice(0, 19);
                setNumber(cleaned.replace(/(.{4})/g, "$1 ").trim());
              }}
              placeholder="4242 4242 4242 4242"
              inputMode="numeric"
              autoComplete="cc-number"
            />
          </Field>
          <Field label={t("account.payment.field.name")} icon={User}>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("account.payment.field.namePlaceholder")}
              autoComplete="cc-name"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("account.payment.field.exp")} icon={Calendar}>
              <Input
                value={exp}
                onChange={(e) => {
                  // Allow "MM/YY" or "MM / YYYY"
                  const cleaned = e.target.value.replace(/[^\d/]/g, "").slice(0, 7);
                  setExp(cleaned);
                }}
                placeholder="12 / 27"
                inputMode="numeric"
                autoComplete="cc-exp"
              />
            </Field>
            <Field label={t("account.payment.field.cvc")} icon={ShieldCheck}>
              <Input
                value={cvc}
                onChange={(e) => setCvc(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="123"
                inputMode="numeric"
                autoComplete="cc-csc"
              />
            </Field>
          </div>
          <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-3">
            <Checkbox
              checked={setDefault}
              onChange={setSetDefault}
              label={t("account.payment.field.setDefault")}
            />
            <Checkbox
              checked={autoPayOn}
              onChange={setAutoPayOn}
              label={t("account.payment.field.autoPay")}
              hint={t("account.payment.field.autoPayHint")}
            />
          </div>
          <div className="flex items-start gap-2 text-[11px] text-muted-foreground">
            <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
            <span>{t("account.payment.demoNote")}</span>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">{t("admin.action.cancel")}</Button>
          </DialogClose>
          <Button onClick={handleSubmit}>
            <Plus className="h-4 w-4" />
            {t("account.payment.addCard")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Small helpers ──────────────────────────────────────────────────────────

function Field({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon?: typeof User;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </Label>
      {children}
    </div>
  );
}

function Checkbox({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-accent/40"
      />
      <span className="text-sm">
        <span className="font-medium">{label}</span>
        {hint && <span className="ms-1 text-[11px] text-muted-foreground">{hint}</span>}
      </span>
    </label>
  );
}
