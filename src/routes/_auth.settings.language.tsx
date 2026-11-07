import {createFileRoute} from "@tanstack/react-router";
import {locales, useLocale} from "@/locale-provider";
import {Combobox, Label} from "@yeahuz/kdsx-react";
import {useTranslation} from "react-i18next";

export let Route = createFileRoute("/_auth/settings/language")({
  beforeLoad: () => {
    return {
      backLink: {to: "/settings/language-and-appearance"},
    };
  },
  component: Language,
});

function Language() {
  let {locale, setLocale} = useLocale();
  let {t} = useTranslation();

  return (
    <div className="w-full md:max-w-xs">
      <div className="flex flex-col gap-10 px-4">
        <div className="flex flex-col gap-4">
          <h1 className="text-3xl font-semibold tracking-tight">{t("settings:language", {defaultValue: "Language"})}</h1>
          <div className="mt-4 flex flex-1 flex-col gap-2">
            <Label htmlFor="to">{t("settings:selectYourLanguage", {defaultValue: "Select your language"})}</Label>
            <Combobox
              label="label"
              placeholder={t("settings:selectYourLanguage", {defaultValue: "Select your language"})}
              initialValue={[locale.code]}
              value="code"
              name="locale"
              required
              items={locales}
              onChange={(locales) => (locales.length ? setLocale(locales[0]) : undefined)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
