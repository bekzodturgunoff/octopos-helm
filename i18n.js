import i18n from "i18next";
import {initReactI18next} from "react-i18next";
import HttpBackend from "i18next-http-backend";

// Every t() call carries its English text as defaultValue, so the app reads correctly before a
// single locale file is filled in. Translations go in public/locales/<lng>/<ns>.json.
export const supportedLanguages = ["en", "uz", "ru"];

i18n
  .use(HttpBackend)
  .use(initReactI18next)
  .init({
    lng: "en",
    fallbackLng: "en",
    supportedLngs: supportedLanguages,
    nonExplicitSupportedLngs: true,
    load: "languageOnly",
    // Keys like "health.atRisk" and "subscriptionStatus.active" are stored flat, so a dot is part
    // of the key rather than a path into nested objects.
    keySeparator: false,
    debug: false,
    interpolation: {
      escapeValue: false,
    },
    backend: {
      loadPath: `${import.meta.env.BASE_URL}locales/{{lng}}/{{ns}}.json`,
    },
    ns: ["common", "clients", "billing", "fleet", "team", "settings", "access", "reports"],
    defaultNS: "common",
  });

export default i18n;
