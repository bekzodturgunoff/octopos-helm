import {NavLink} from "@/components/nav-link";
import {createFileRoute} from "@tanstack/react-router";
import {useLocale} from "@/locale-provider";
import {useTheme} from "@/theme-provider";
import {NavOption, NavOptionAdornmentWithBg} from "@yeahuz/kdsx-react";
import {Contrast, MessageSquare} from "lucide-react";
import {useTranslation} from "react-i18next";

export let Route = createFileRoute("/_auth/settings/language-and-appearance")({
  beforeLoad: () => {
    return {
      backLink: {to: "/settings"},
    };
  },
  component: LanguageAndAppearance,
});

function LanguageAndAppearance() {
  let {t} = useTranslation();
  let {locale} = useLocale();
  let {theme} = useTheme();
  return (
    <div className="flex flex-col gap-5 px-4">
      <h1 className="text-3xl font-semibold tracking-tight">{t("settings:languageAndAppearance", {defaultValue: "Language and appearance"})}</h1>
      <ul>
        <li>
          <NavLink to="/settings/appearance">
            <NavOption
              startAdornment={
                <NavOptionAdornmentWithBg>
                  <Contrast size={20} />
                </NavOptionAdornmentWithBg>
              }
              title={t("settings:appearance", {defaultValue: "Appearance"})}
              subtitle={t(`settings:${theme}`, {defaultValue: theme === "dark" ? "Dark" : "Light"})}
            ></NavOption>
          </NavLink>
        </li>
        <li>
          <NavLink to="/settings/language">
            <NavOption
              startAdornment={
                <NavOptionAdornmentWithBg>
                  <MessageSquare size={20} />
                </NavOptionAdornmentWithBg>
              }
              title={t("settings:language", {defaultValue: "Language"})}
              subtitle={locale.label}
            ></NavOption>
          </NavLink>
        </li>
      </ul>
    </div>
  );
}
