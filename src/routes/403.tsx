import {createFileRoute, Link} from "@tanstack/react-router";
import {ShieldAlert} from "lucide-react";
import {Button} from "@yeahuz/kdsx-react";
import {useTranslation} from "react-i18next";

export const Route = createFileRoute("/403")({
  component: RouteComponent,
});

function RouteComponent() {
  let {t} = useTranslation();
  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <div className="flex w-full max-w-md flex-col items-center gap-6 text-center">
        <div className="bg-error-low flex size-24 items-center justify-center rounded-full">
          <ShieldAlert className="text-error-bright size-12" />
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-on-surface-accent text-5xl font-bold tracking-tighter">403</p>
          <h1 className="text-lg font-medium tracking-tight">{t("common:accessDenied", {defaultValue: "Access denied"})}</h1>
          <p className="text-on-surface-secondary text-sm">{t("common:accessDeniedDescription", {defaultValue: "Your role does not include this page. Ask an owner if you need it."})}</p>
        </div>
        <Button size="lg" color="neutral" className="w-full" asChild>
          <Link to="/">{t("common:backToHome", {defaultValue: "Back to overview"})}</Link>
        </Button>
      </div>
    </main>
  );
}
