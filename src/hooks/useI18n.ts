import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  getStoredLocale,
  intlLocale,
  LOCALES,
  setStoredLocale,
  translate,
  type Locale,
  type TranslationKey,
} from "@/lib/i18n";

interface I18nContextValue {
  locale: Locale;
  dir: "ltr" | "rtl";
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey, fallback?: string) => string;
  /** BCP-47 tag for Intl.* formatters. */
  intl: (country?: string | null) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

interface ProviderProps {
  children: ReactNode;
  /** Optional override; otherwise reads from localStorage / browser. */
  initial?: Locale;
}

export function I18nProvider({ children, initial }: ProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(() => initial ?? getStoredLocale());

  // Reflect onto <html dir/lang> so CSS logical properties and a11y work.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const meta = LOCALES[locale];
    document.documentElement.lang = locale;
    document.documentElement.dir = meta.dir;
    document.documentElement.classList.toggle("rtl", meta.dir === "rtl");
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    setStoredLocale(next);
  }, []);

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      dir: LOCALES[locale].dir,
      setLocale,
      t: (key, fallback) => translate(locale, key, fallback),
      intl: (country) => intlLocale(locale, country),
    }),
    [locale, setLocale],
  );

  return createElement(I18nContext.Provider, { value }, children);
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // Permissive fallback so components keep rendering if mounted outside the
    // provider (e.g. error pages). Always returns English.
    return {
      locale: "en",
      dir: "ltr",
      setLocale: () => {},
      t: (key, fallback) => translate("en", key, fallback),
      intl: (country) => intlLocale("en", country),
    };
  }
  return ctx;
}
