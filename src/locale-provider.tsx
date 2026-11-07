import {createContext, useCallback, useContext, useEffect, useMemo, useState} from "react";
import {getLocale, saveLocale} from "./constants";
import {useTranslation} from "react-i18next";

export type Locale = {
  code: string;
  label: string;
};

export let locales: Locale[] = [
  {code: "en", label: "English"},
  {code: "uz", label: "O'zbek"},
  {code: "ru", label: "Русский"},
];

// The languages a printed document can be written in, with "follow the business
// language" first. Empty is a real choice rather than a missing one: a location
// that names no language follows general settings, so changing it there still
// reaches every branch that never overrode it.
export function printLanguages(inheritLabel: string): Locale[] {
  return [{code: "", label: inheritLabel}, ...locales];
}

let LocaleContext = createContext<{
  locale: Locale;
  setLocale: (locale: Locale) => void;
} | null>(null);

function getInitialLocale(): Locale {
  let saved = getLocale();
  let found = locales.find((l) => l.code === saved);
  return found || locales[0];
}

export function LocaleProvider({children}: {children: React.ReactNode}) {
  let {i18n} = useTranslation();
  let [locale, setLocaleState] = useState<Locale>(getInitialLocale);

  // i18next starts on English; adopt the saved choice once the provider mounts so
  // the UI's language and the loaded translations never disagree.
  useEffect(() => {
    if (i18n.language !== locale.code) i18n.changeLanguage(locale.code);
  }, [i18n, locale.code]);

  let setLocale = useCallback(
    (newLocale: Locale) => {
      saveLocale(newLocale.code);
      setLocaleState(newLocale);
      i18n.changeLanguage(newLocale.code);
    },
    [i18n],
  );

  let value = useMemo(() => ({locale, setLocale}), [locale, setLocale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  let context = useContext(LocaleContext);
  if (context == null) throw new Error("useLocale() must be used within LocaleProvider");
  return context;
}
