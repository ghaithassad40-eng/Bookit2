import { useEffect, useMemo, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { ArrowLeft, Lock } from "lucide-react";
import type { BusinessRow, BusinessConfigRow } from "@/lib/database.types";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ServiceCard } from "@/components/customer/ServiceCard";
import { StaffCard } from "@/components/customer/StaffCard";
import { SlotPicker } from "@/components/customer/SlotPicker";
import { BookingForm } from "@/components/customer/BookingForm";
import { BookingStepper } from "@/components/customer/BookingStepper";
import { EquipmentShelf } from "@/components/customer/EquipmentShelf";
import { PaymentSelector } from "@/components/customer/PaymentSelector";
import { PaymentForm } from "@/components/customer/PaymentForm";
import { PaymentRegionInfo } from "@/components/customer/PaymentRegionInfo";
import { useServices } from "@/hooks/useServices";
import { useStaff } from "@/hooks/useStaff";
import { useSlots } from "@/hooks/useSlots";
import { useEquipment } from "@/hooks/useEquipment";
import { useBookingStore, type EquipmentCart } from "@/store/bookingStore";
import { useCreateBooking } from "@/hooks/useBookings";
import { formatCurrency, formatDate, formatTime } from "@/lib/utils";
import { charge, resolvePaymentMethodsForCustomer, type PaymentRequest, type PaymentResult } from "@/lib/payments";
import { useI18n } from "@/hooks/useI18n";
import { useRegion } from "@/hooks/useRegion";
import { useDisplayCurrency } from "@/hooks/useDisplayCurrency";
import { useCustomerAuth } from "@/hooks/useCustomerAuth";
import { CustomerAuthDialog } from "@/components/customer/CustomerAuthDialog";
import {
  MYFATOORAH_ENABLED,
  initiateMyFatoorahPayment,
  savePendingBooking,
  toMyFatoorahMethod,
} from "@/lib/myfatoorah";

interface Ctx {
  business: BusinessRow;
  config: BusinessConfigRow;
}

/** Resolved equipment line item — used by BookingSummary and the
 *  Confirmation invoice. Snapshot of name + unit_price at booking time. */
export interface EquipmentLine {
  equipment_id: string;
  name: string;
  name_ar: string | null;
  quantity: number;
  unit_price: number;
  currency: string;
  line_total: number;
  is_free: boolean;
}

export default function Book() {
  const { business, config } = useOutletContext<Ctx>();
  const navigate = useNavigate();
  const rules = config.booking_rules_json;

  const { t, intl, locale } = useI18n();
  const intlLocale = intl(business.country);
  const displayCurrency = useDisplayCurrency();

  const {
    step, service, staff, slot, customer,
    equipmentCart, setEquipmentQty,
    paymentMethod, setPaymentMethod, setPaymentResult,
    setStep, setService, setStaff, setSlot, setCustomer, reset,
  } = useBookingStore();
  const [charging, setCharging] = useState(false);
  const requirePayment = rules.requirePayment !== false;
  const { country: customerCountry } = useRegion();
  const enabled = resolvePaymentMethodsForCustomer(rules, customerCountry);

  // Customer auth gate — payment is only reachable after sign-in/sign-up.
  // The Details step stays anonymous so the customer can fill out their
  // info first and then authenticate when they see the cost on Review.
  const { customer: authedCustomer } = useCustomerAuth();
  const [authOpen, setAuthOpen] = useState(false);

  // If the customer is already signed in (returning user) and the Details
  // form is empty, pre-fill it from their profile so they're not asked to
  // type the same info again.
  useEffect(() => {
    if (!authedCustomer) return;
    if (customer.name || customer.email || customer.phone) return;
    setCustomer({
      name: authedCustomer.name,
      email: authedCustomer.email,
      phone: authedCustomer.phone ?? "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authedCustomer]);
  const reference = `BK-${slot?.id?.slice(-6).toUpperCase() ?? "PENDING"}`;

  const { data: services, isLoading: loadingSvc } = useServices(business.id);
  const { data: staffList, isLoading: loadingStaff } = useStaff(business.id);
  const { data: slots, isLoading: loadingSlots } = useSlots({
    businessId: business.id,
    serviceId: service?.id,
    staffId: rules.allowStaffSelection ? staff?.id : undefined,
  });
  const { data: equipmentList, isLoading: loadingEquipment } = useEquipment(business.id, {
    onlyActive: true,
  });
  const hasEquipment = (equipmentList?.length ?? 0) > 0;

  // Auto-skip the equipment step when the business has no add-ons configured.
  // The stepper hides it via the showEquipment prop, but the store still
  // lands on "equipment" after slot selection; bounce straight to details.
  useEffect(() => {
    if (step === "equipment" && !loadingEquipment && !hasEquipment) {
      setStep("details");
    }
  }, [step, loadingEquipment, hasEquipment, setStep]);

  // Resolve equipment add-on totals for the BookingSummary and invoice.
  // `equipmentTotals` carries (row, qty, lineTotal in service.currency).
  const equipmentTotals = useMemo(() => {
    if (!equipmentList || !service) return [] as EquipmentLine[];
    const out: EquipmentLine[] = [];
    for (const item of equipmentList) {
      const qty = equipmentCart[item.id] ?? 0;
      if (qty <= 0) continue;
      const unitPrice = item.price ?? 0;
      out.push({
        equipment_id: item.id,
        name: item.name,
        name_ar: item.name_ar ?? null,
        quantity: qty,
        unit_price: unitPrice,
        currency: item.currency,
        line_total: unitPrice * qty,
        is_free: item.price == null,
      });
    }
    return out;
  }, [equipmentList, equipmentCart, service]);

  // Sum of all paid equipment lines, in the **service** currency (assumed
  // matching since equipment+services for the same business share currency
  // by convention). Free lines contribute 0.
  const equipmentSubtotal = equipmentTotals.reduce(
    (sum, line) => sum + (line.is_free ? 0 : line.line_total),
    0,
  );

  const createBooking = useCreateBooking();

  useEffect(() => () => reset(), [reset]);

  function back() {
    if (step === "payment") setStep("review");
    else if (step === "review") setStep("details");
    else if (step === "details") setStep(hasEquipment ? "equipment" : "slot");
    else if (step === "equipment") setStep("slot");
    else if (step === "slot") setStep(rules.allowStaffSelection ? "staff" : "service");
    else if (step === "staff") setStep("service");
  }

  async function finalizeBooking(payment: PaymentResult | null) {
    if (!service || !slot) return;
    // Total charged = service price + paid equipment lines (free items are
    // included for free and don't appear in payment_amount).
    const total = service.price + equipmentSubtotal;
    try {
      const booking = await createBooking.mutateAsync({
        business_id: business.id,
        service_id: service.id,
        staff_id: staff?.id ?? null,
        slot_id: slot.id,
        customer_name: customer.name,
        customer_phone: customer.phone || null,
        customer_email: customer.email || null,
        notes: customer.notes || null,
        payment,
        payment_amount: payment ? total : null,
        payment_currency: payment ? service.currency : null,
        equipment: equipmentTotals.map((line) => ({
          equipment_id: line.equipment_id,
          quantity: line.quantity,
          unit_price: line.is_free ? 0 : line.unit_price,
          currency: line.currency,
        })),
      });
      reset();
      navigate(`/business/${business.slug}/confirmation?ref=${encodeURIComponent(booking.booking_reference)}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create booking");
    }
  }

  function handleReviewContinue() {
    // Gate: paid bookings require the customer to be signed in. Free
    // bookings (requirePayment === false) skip the gate since there's no
    // financial transaction.
    if (requirePayment && !authedCustomer) {
      setAuthOpen(true);
      return;
    }
    if (requirePayment) {
      setStep("payment");
    } else {
      void finalizeBooking(null);
    }
  }

  // After successful auth, write the authenticated profile into the booking
  // state (so the Payment step + final booking row carry the verified
  // identity), close the dialog, and advance the wizard to Payment.
  function handleAuthSuccess(profile: { name: string; email: string; phone: string | null }) {
    setCustomer({
      name: profile.name,
      email: profile.email,
      phone: profile.phone ?? "",
    });
    setAuthOpen(false);
    setStep("payment");
  }

  // When MyFatoorah is enabled (real or demo mock), redirect to the hosted
  // MyFatoorah page. Otherwise charge inline via the mock adapter.
  async function handlePay(req: PaymentRequest) {
    setCharging(true);
    try {
      const useRedirect = MYFATOORAH_ENABLED || (paymentMethod === "knet" || paymentMethod === "paypal");
      // PaymentForm passes service.price as `amount`; bump it by the
      // equipment subtotal so the customer pays the full cart total.
      const cartAmount = req.amount + equipmentSubtotal;
      if (useRedirect && service && slot) {
        const init = await initiateMyFatoorahPayment({
          method: toMyFatoorahMethod(req.method),
          amount: cartAmount,
          currency: req.currency,
          reference: req.reference,
          business_slug: business.slug,
          customer: {
            name: customer.name,
            phone: customer.phone || null,
            email: customer.email || null,
          },
          language: locale === "ar" ? "AR" : "EN",
          displayCurrency:
            displayCurrency.currency !== req.currency
              ? displayCurrency.currency
              : undefined,
        });
        if (!init.success || !init.paymentUrl) {
          toast.error(init.error ?? "Could not start payment");
          return;
        }
        savePendingBooking({
          reference: req.reference,
          invoiceId: init.invoiceId ?? null,
          business_id: business.id,
          business_slug: business.slug,
          service_id: service.id,
          staff_id: staff?.id ?? null,
          slot_id: slot.id,
          customer_name: customer.name,
          customer_phone: customer.phone || null,
          customer_email: customer.email || null,
          notes: customer.notes || null,
          amount: cartAmount,
          currency: req.currency,
          method: req.method,
          createdAt: Date.now(),
        });
        toast.message("Redirecting to MyFatoorah…");
        window.location.assign(init.paymentUrl);
        return;
      }

      // Inline (demo) charge for wallets / cards when MyFatoorah is off.
      // Override the request amount so we charge the cart total, not just
      // the service price.
      const result = await charge({ ...req, amount: cartAmount });
      setPaymentResult(result);
      if (!result.success) {
        toast.error(result.error ?? "Payment was declined");
        return;
      }
      toast.success("Payment confirmed");
      await finalizeBooking(result);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setCharging(false);
    }
  }

  return (
    <div className="container max-w-4xl py-6 sm:py-12">
      <div className="mb-6 flex items-center gap-3">
        {step !== "service" && (
          <Button variant="ghost" size="icon" onClick={back}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <BookingStepper
          current={step}
          showStaff={rules.allowStaffSelection}
          showEquipment={hasEquipment}
        />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {step === "service" && (
            <section>
              <h1 className="mb-4 text-2xl font-semibold">{t("book.chooseService")}</h1>
              {loadingSvc ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-44" />
                  ))}
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {services?.map((s) => (
                    <ServiceCard
                      key={s.id}
                      service={s}
                      selected={s.id === service?.id}
                      onSelect={(picked) => {
                        setService(picked);
                        if (!rules.allowStaffSelection) setStep("slot");
                      }}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          {step === "staff" && (
            <section>
              <h1 className="mb-4 text-2xl font-semibold">{t("book.chooseStaff")}</h1>
              <div className="mb-3">
                <Button variant="ghost" onClick={() => { setStaff(null); setStep("slot"); }}>
                  {t("book.noPreference")}
                </Button>
              </div>
              {loadingStaff ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-28" />
                  ))}
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {staffList?.map((p) => (
                    <StaffCard
                      key={p.id}
                      staff={p}
                      selected={p.id === staff?.id}
                      onSelect={setStaff}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          {step === "slot" && (
            <section>
              <h1 className="mb-4 text-2xl font-semibold">{t("book.pickTime")}</h1>
              {loadingSlots ? (
                <Skeleton className="h-72 w-full" />
              ) : (
                <SlotPicker
                  slots={slots ?? []}
                  selectedSlotId={slot?.id ?? null}
                  onSelect={setSlot}
                />
              )}
            </section>
          )}

          {step === "equipment" && (
            <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
              <div>
                <h1 className="text-2xl font-semibold">{t("book.addEquipment")}</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("book.addEquipmentSubtitle")}
                </p>
                <div className="mt-5">
                  {loadingEquipment ? (
                    <div className="space-y-3">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} className="h-20 w-full" />
                      ))}
                    </div>
                  ) : (
                    <EquipmentShelf
                      equipment={equipmentList ?? []}
                      cart={equipmentCart}
                      onChangeQty={setEquipmentQty}
                    />
                  )}
                </div>
                <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <Button
                    size="lg"
                    className="sm:min-w-[200px]"
                    onClick={() => setStep("details")}
                  >
                    {Object.keys(equipmentCart).length > 0
                      ? t("book.continueWithExtras")
                      : t("book.continueWithoutExtras")}
                  </Button>
                </div>
              </div>
              <BookingSummary
                service={service}
                staff={staff}
                slot={slot}
                equipmentLines={equipmentTotals}
                equipmentSubtotal={equipmentSubtotal}
              />
            </section>
          )}

          {step === "details" && (
            <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
              <div>
                <h1 className="mb-4 text-2xl font-semibold">{t("book.yourDetails")}</h1>
                <BookingForm
                  rules={rules}
                  initial={customer}
                  onSubmit={(values) => {
                    setCustomer(values);
                    setStep("review");
                  }}
                />
              </div>
              <BookingSummary
                service={service}
                staff={staff}
                slot={slot}
                equipmentLines={equipmentTotals}
                equipmentSubtotal={equipmentSubtotal}
              />
            </section>
          )}

          {step === "review" && (
            <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
              <Card>
                <CardHeader>
                  <CardTitle>{t("book.reviewYourBooking")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <Row label="Name" value={customer.name} />
                  {customer.email && <Row label="Email" value={customer.email} />}
                  {customer.phone && <Row label="Phone" value={customer.phone} />}
                  {customer.notes && <Row label="Notes" value={customer.notes} />}
                  <div className="pt-3">
                    <Button
                      size="lg"
                      className="w-full"
                      disabled={createBooking.isPending}
                      onClick={handleReviewContinue}
                    >
                      {requirePayment ? (
                        <>
                          <Lock className="h-4 w-4" />
                          {t("book.continueToPayment")}
                          {" · "}
                          {service
                            ? displayCurrency.format(
                                service.price + equipmentSubtotal,
                                service.currency,
                              ).display
                            : ""}
                        </>
                      ) : createBooking.isPending ? (
                        t("common.loading")
                      ) : (
                        t("book.confirmBooking")
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
              <BookingSummary
                service={service}
                staff={staff}
                slot={slot}
                equipmentLines={equipmentTotals}
                equipmentSubtotal={equipmentSubtotal}
              />
            </section>
          )}

          {step === "payment" && service && slot && (
            <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
              <div className="space-y-6">
                <div>
                  <h1 className="text-2xl font-semibold">{t("payment.title")}</h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("payment.subtitle")}
                  </p>
                </div>

                <div>
                  <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("payment.method")}
                  </h2>
                  <PaymentSelector
                    enabled={enabled}
                    value={paymentMethod}
                    onChange={setPaymentMethod}
                    currency={service.currency}
                  />
                </div>

                <PaymentRegionInfo highlightCountry={business.country} />

                {paymentMethod && (
                  <motion.div
                    key={paymentMethod}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <PaymentForm
                      method={paymentMethod}
                      amount={service.price}
                      currency={service.currency}
                      reference={reference}
                      submitting={charging || createBooking.isPending}
                      onSubmit={handlePay}
                    />
                  </motion.div>
                )}
              </div>
              <BookingSummary
                service={service}
                staff={staff}
                slot={slot}
                equipmentLines={equipmentTotals}
                equipmentSubtotal={equipmentSubtotal}
                paymentLabel={paymentMethod ? "Selected" : "Pending selection"}
              />
            </section>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Customer auth gate — opens when the customer hits 'Continue to
          payment' on the Review step while not signed in. */}
      <CustomerAuthDialog
        open={authOpen}
        onOpenChange={setAuthOpen}
        prefillName={customer.name}
        prefillEmail={customer.email}
        prefillPhone={customer.phone}
        onAuthSuccess={(profile) =>
          handleAuthSuccess({
            name: profile.name,
            email: profile.email,
            phone: profile.phone,
          })
        }
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/50 pb-2 last:border-none">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function BookingSummary({
  service,
  staff,
  slot,
  equipmentLines = [],
  equipmentSubtotal = 0,
  paymentLabel,
}: {
  service: ReturnType<typeof useBookingStore.getState>["service"];
  staff: ReturnType<typeof useBookingStore.getState>["staff"];
  slot: ReturnType<typeof useBookingStore.getState>["slot"];
  equipmentLines?: EquipmentLine[];
  equipmentSubtotal?: number;
  paymentLabel?: string;
}) {
  const { t, intl, locale } = useI18n();
  const intlLoc = intl();
  const { format } = useDisplayCurrency();
  if (!service) return null;
  const total = service.price + equipmentSubtotal;
  const totalFmt = format(total, service.currency);
  const servicePriceFmt = format(service.price, service.currency);
  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle>{t("book.summary")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <Row label={t("book.service")} value={service.name} />
        {staff && <Row label={t("book.specialist")} value={staff.name} />}
        {slot && (
          <Row
            label={t("book.when")}
            value={`${formatDate(slot.start_time, intlLoc)} · ${formatTime(slot.start_time, intlLoc)}`}
          />
        )}
        {paymentLabel && <Row label={t("invoice.payment")} value={paymentLabel} />}

        {/* Cart breakdown — only render when equipment lines exist. */}
        {equipmentLines.length > 0 && (
          <div className="space-y-1.5 rounded-xl bg-muted/30 p-3">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <span>{t("book.cartHeader")}</span>
              <span>{equipmentLines.length}</span>
            </div>
            <Row
              label={t("book.serviceLine")}
              value={servicePriceFmt.display}
            />
            {equipmentLines.map((line) => (
              <Row
                key={line.equipment_id}
                label={`${line.quantity}× ${pickLocaleSafe(locale, line.name, line.name_ar)}`}
                value={
                  line.is_free
                    ? t("equipment.included")
                    : format(line.line_total, line.currency).display
                }
              />
            ))}
          </div>
        )}

        <div className="flex items-start justify-between pt-3 text-base">
          <span className="text-muted-foreground">{t("book.total")}</span>
          <span className="text-right">
            <span className="block font-semibold">{totalFmt.display}</span>
            {totalFmt.converted && (
              <span className="mt-0.5 block text-[10px] font-mono text-muted-foreground">
                ≈ {totalFmt.native}
              </span>
            )}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

// Tiny inline helper so we don't have to import pickLocale from i18n twice.
function pickLocaleSafe(locale: string, en: string, ar: string | null) {
  if (locale === "ar" && ar) return ar;
  return en;
}
