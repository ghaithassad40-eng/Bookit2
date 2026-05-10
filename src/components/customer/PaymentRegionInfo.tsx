import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Globe2, Info, ShieldCheck } from "lucide-react";
import { PaymentBrandMark } from "./PaymentBrandMark";
import type { PaymentMethodId } from "@/lib/payments";
import { countryFlag } from "@/lib/location";

interface RegionRow {
  code: string;        // ISO-2 country
  flag: string;
  label: string;
  currency: string;
  methods: PaymentMethodId[];
  /** Special routing notes — e.g. "Apple Pay → KNET". */
  notes?: { method: PaymentMethodId; via: string }[];
}

const REGIONS: RegionRow[] = [
  {
    code: "KW",
    flag: countryFlag("KW"),
    label: "Kuwait",
    currency: "KWD",
    methods: ["knet", "apple_pay", "google_pay", "visa", "samsung_pay"],
    notes: [
      { method: "apple_pay", via: "via KNET" },
      { method: "google_pay", via: "via KNET" },
    ],
  },
  {
    code: "SA",
    flag: countryFlag("SA"),
    label: "Saudi Arabia",
    currency: "SAR",
    methods: ["mada", "stcpay", "apple_pay", "google_pay", "visa", "amex"],
    notes: [
      { method: "apple_pay", via: "via Mada" },
      { method: "google_pay", via: "via Mada" },
    ],
  },
  {
    code: "AE",
    flag: countryFlag("AE"),
    label: "United Arab Emirates",
    currency: "AED",
    methods: ["uaecc", "visa", "apple_pay", "google_pay", "amex"],
  },
  {
    code: "BH",
    flag: countryFlag("BH"),
    label: "Bahrain",
    currency: "BHD",
    methods: ["visa", "apple_pay", "google_pay"],
  },
  {
    code: "QA",
    flag: countryFlag("QA"),
    label: "Qatar",
    currency: "QAR",
    methods: ["visa", "apple_pay", "google_pay"],
  },
  {
    code: "OM",
    flag: countryFlag("OM"),
    label: "Oman",
    currency: "OMR",
    methods: ["visa", "apple_pay", "google_pay"],
  },
  {
    code: "EG",
    flag: countryFlag("EG"),
    label: "Egypt",
    currency: "EGP",
    methods: ["visa", "apple_pay", "google_pay"],
  },
  {
    code: "JO",
    flag: countryFlag("JO"),
    label: "Jordan",
    currency: "JOD",
    methods: ["visa", "apple_pay", "google_pay"],
  },
];

interface Props {
  /** Optional — highlights this row visually. */
  highlightCountry?: string | null;
  defaultOpen?: boolean;
}

export function PaymentRegionInfo({ highlightCountry, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const highlight = highlightCountry?.toUpperCase() ?? null;

  return (
    <div className="rounded-2xl border border-border bg-card/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2.5 px-4 py-3 text-left"
        aria-expanded={open}
      >
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-accent/15 text-accent">
          <Globe2 className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold leading-tight">
            Payment methods by region
          </div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            Tap to see what's accepted in each country and how Apple/Google Pay route locally.
          </div>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="border-t border-border/60 p-3">
              <div className="space-y-2">
                {REGIONS.map((r) => {
                  const isMatch = highlight === r.code;
                  return (
                    <div
                      key={r.code}
                      className={`rounded-xl border p-3 ${
                        isMatch
                          ? "border-accent/40 bg-accent/5"
                          : "border-border/60 bg-card/30"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-base leading-none" aria-hidden>{r.flag}</span>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold leading-tight">
                              {r.label}
                              {isMatch && (
                                <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-medium text-accent">
                                  <ShieldCheck className="h-3 w-3" />
                                  Your region
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              Settlement currency · <span className="font-mono">{r.currency}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                        {r.methods.map((m) => {
                          const note = r.notes?.find((n) => n.method === m);
                          return (
                            <span
                              key={m}
                              className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/50 py-0.5 pl-0.5 pr-2 text-[10px]"
                              title={note?.via}
                            >
                              <PaymentBrandMark method={m} className="h-5 w-9 rounded text-[8px]" />
                              {note?.via && (
                                <span className="font-medium uppercase tracking-wide text-emerald-600 dark:text-emerald-300">
                                  {note.via}
                                </span>
                              )}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-3 flex items-start gap-2 rounded-xl border border-dashed border-border/60 p-3 text-[11px] text-muted-foreground">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <div>
                  Apple Pay, Google Pay and Samsung Pay are wallet shells — the actual
                  charge runs through the local network shown above so you pay in the
                  invoice currency without FX conversion.
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
