// Hook that derives the customer's preferred display currency from their
// selected country (set in the Welcome modal). Components use this to show
// prices in the visitor's own currency while keeping the merchant charge
// in the business's native currency at checkout time.

import { useMemo } from "react";
import { useRegion } from "./useRegion";
import { useI18n } from "./useI18n";
import { countryMeta } from "@/lib/region";
import { formatCustomerPrice, type DisplayPrice } from "@/lib/fx";

interface UseDisplayCurrencyApi {
  /** The active display currency code (KWD, SAR, AED, USD, …). */
  currency: string;
  /** ISO country code currently selected (or null if first visit). */
  country: string | null;
  /**
   * Format a price for display in the customer's currency, returning both
   * the converted string AND the merchant's native string so the UI can
   * disclose the actual charge.
   */
  format: (amount: number, merchantCurrency: string) => DisplayPrice;
}

export function useDisplayCurrency(): UseDisplayCurrencyApi {
  const { country } = useRegion();
  const { intl } = useI18n();

  return useMemo(() => {
    const meta = country && country !== "ALL" ? countryMeta(country) : null;
    const displayCurrency = meta?.currency ?? "USD";
    const intlTag = intl(country && country !== "ALL" ? country : undefined);

    return {
      currency: displayCurrency,
      country,
      format: (amount: number, merchantCurrency: string) =>
        formatCustomerPrice(amount, merchantCurrency, displayCurrency, intlTag),
    };
  }, [country, intl]);
}
