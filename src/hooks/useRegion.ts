import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  countryMeta,
  detectCountry,
  getStoredCountry,
  setStoredCountry,
  type CountryCode,
  type CountryMeta,
} from "@/lib/region";

interface RegionContextValue {
  /** The customer's selected country (or "ALL"). null = first visit, no choice yet. */
  country: CountryCode | null;
  meta: CountryMeta | null;
  setCountry: (code: CountryCode) => void;
  /** True when the user has never made a choice. Use to gate the Welcome modal. */
  isFirstVisit: boolean;
}

const RegionContext = createContext<RegionContextValue | null>(null);

export function RegionProvider({ children }: { children: ReactNode }) {
  const [country, setCountryState] = useState<CountryCode | null>(() => getStoredCountry());
  const [bootstrapped, setBootstrapped] = useState(false);

  // After mount, if no stored choice, try to pre-fill from timezone but DON'T
  // persist it — the Welcome modal will ask for confirmation.
  useEffect(() => {
    setBootstrapped(true);
  }, []);

  const setCountry = useCallback((code: CountryCode) => {
    setStoredCountry(code);
    setCountryState(code);
  }, []);

  const value = useMemo<RegionContextValue>(() => {
    const detected = country ?? detectCountry();
    return {
      country: country, // raw stored value (null if first visit)
      meta: detected ? countryMeta(detected) : null,
      setCountry,
      isFirstVisit: bootstrapped && country === null,
    };
  }, [country, setCountry, bootstrapped]);

  return createElement(RegionContext.Provider, { value }, children);
}

export function useRegion(): RegionContextValue {
  const ctx = useContext(RegionContext);
  if (!ctx) {
    return {
      country: null,
      meta: null,
      setCountry: () => {},
      isFirstVisit: false,
    };
  }
  return ctx;
}
