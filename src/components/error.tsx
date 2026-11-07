import {AlertCircle, RefreshCw} from "lucide-react";
import {Button} from "@yeahuz/kdsx-react";
import {useTranslation} from "react-i18next";
import type {ErrorComponentProps} from "@tanstack/react-router";

export function DefaultErrorComponent({reset, error}: ErrorComponentProps) {
  let {t} = useTranslation();

  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <div className="flex w-full max-w-md flex-col items-center gap-6 text-center">
        <div className="bg-error-low flex size-24 items-center justify-center rounded-full">
          <AlertCircle className="text-error-bright size-12" />
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-on-surface-accent text-5xl font-bold tracking-tighter">500</p>
          <h1 className="text-lg font-medium tracking-tight">{t("common:somethingWentWrong", {defaultValue: "Something went wrong"})}</h1>
          <p className="text-on-surface-secondary text-sm">{(error instanceof Error && error.message) || t("common:somethingWentWrongDescription", {defaultValue: "The page could not be loaded."})}</p>
        </div>
        <Button size="lg" color="neutral" className="w-full gap-2" onClick={() => reset()}>
          <RefreshCw size={20} />
          {t("common:tryAgain", {defaultValue: "Try again"})}
        </Button>
      </div>
    </main>
  );
}
