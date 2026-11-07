import {createFileRoute} from "@tanstack/react-router";
import {useTheme, FinishStrength, Finish, ColorScheme} from "@/theme-provider";
import {Button, RadioButton} from "@yeahuz/kdsx-react";
import {useTranslation} from "react-i18next";

export let Route = createFileRoute("/_auth/settings/appearance")({
  beforeLoad: () => {
    return {
      backLink: {to: "/settings/language-and-appearance"},
    };
  },
  component: Appearance,
});

let COLOR_SCHEMES: ColorScheme[] = ["default", "blue", "indigo", "slate", "coral", "rose", "violet", "teal", "volt", "sunglow", "hotline", "cobalt"];

let FINISHES: Finish[] = ["flat", "sheen", "raised", "raised-sheen"];
let FINISH_KEYS: Record<Finish, string> = {flat: "flat", sheen: "sheen", raised: "raised", "raised-sheen": "raisedSheen"};
let FINISH_LABELS: Record<Finish, string> = {flat: "Flat", sheen: "Sheen", raised: "Raised", "raised-sheen": "Raised with sheen"};
let FINISH_STRENGTHS: FinishStrength[] = ["regular", "subtle"];

function Appearance() {
  let {t} = useTranslation();
  let {theme, setTheme, colorScheme, setColorScheme, finish, setFinish, finishStrength, setFinishStrength} = useTheme();

  return (
    <div className="w-full">
      <div className="flex flex-col gap-10 px-4">
        <div className="flex flex-col">
          <h1 className="mb-4 text-3xl font-semibold tracking-tight">{t("settings:appearance", {defaultValue: "Appearance"})}</h1>
          <RadioButton onChange={() => setTheme("light")} value={t("settings:light", {defaultValue: "Light"})} name="theme" defaultChecked={theme === "light"}>
            {t("settings:light", {defaultValue: "Light"})}
          </RadioButton>
          <RadioButton onChange={() => setTheme("dark")} value={t("settings:dark", {defaultValue: "Dark"})} name="theme" defaultChecked={theme === "dark"}>
            {t("settings:dark", {defaultValue: "Dark"})}
          </RadioButton>
        </div>
        <div className="flex flex-col">
          <h2 className="text-on-surface-secondary mb-4 text-sm font-medium">{t("settings:colorScheme", {defaultValue: "Colour scheme"})}</h2>
          {COLOR_SCHEMES.map((option) => {
            let label = option === "default" ? t("settings:default", {defaultValue: "Default"}) : option.charAt(0).toUpperCase() + option.slice(1);
            return (
              <RadioButton key={option} onChange={() => setColorScheme(option)} value={label} name="color-scheme" defaultChecked={colorScheme === option}>
                {label}
              </RadioButton>
            );
          })}
        </div>
        <div className="flex flex-col">
          <h2 className="text-on-surface-secondary mb-4 text-sm font-medium">{t("settings:finish", {defaultValue: "Finish"})}</h2>
          {FINISHES.map((option) => (
            <RadioButton key={option} onChange={() => setFinish(option)} value={option} name="finish" defaultChecked={finish === option}>
              {t(`settings:finish.${FINISH_KEYS[option]}`, {defaultValue: FINISH_LABELS[option]})}
            </RadioButton>
          ))}
        </div>
        <div className="flex flex-col">
          <h2 className="text-on-surface-secondary mb-4 text-sm font-medium">{t("settings:finishStrength", {defaultValue: "Finish strength"})}</h2>
          {FINISH_STRENGTHS.map((option) => (
            <RadioButton key={option} onChange={() => setFinishStrength(option)} value={option} name="finish-strength" defaultChecked={finishStrength === option}>
              {t(`settings:finishStrength.${option}`, {defaultValue: option === "regular" ? "Regular" : "Subtle"})}
            </RadioButton>
          ))}
        </div>
        <div className="flex flex-col gap-4">
          <h2 className="text-on-surface-secondary text-sm font-medium">{t("settings:preview", {defaultValue: "Preview"})}</h2>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button">Save changes</Button>
            <Button type="button" color="neutral">
              Duplicate
            </Button>
            <Button type="button" color="danger">
              Delete item
            </Button>
            <Button type="button" variant="outline">
              Export
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
