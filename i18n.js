import i18n from "i18next";
import {initReactI18next} from "react-i18next";
import HttpBackend from "i18next-http-backend";
import LanguageDetector from "i18next-browser-languagedetector";

// Every t() call carries its English text as defaultValue, so the app reads correctly before a
// single locale file is filled in. Translations go in public/locales/<lng>/<ns>.json.
i18n
  .use(HttpBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: "en",
    debug: false,
    interpolation: {
      escapeValue: false,
    },
    backend: {
      loadPath: "/locales/{{lng}}/{{ns}}.json",
    },
    ns: ["common", "clients", "billing", "fleet", "team", "settings", "access", "reports"],
    defaultNS: "common",
  });

export default i18n;
