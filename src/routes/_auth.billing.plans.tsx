import {Suspense} from "react";
import {useSuspenseQuery} from "@tanstack/react-query";
import {createFileRoute, Link, redirect} from "@tanstack/react-router";
import {Check} from "lucide-react";
import {useTranslation} from "react-i18next";
import {listPlansOptions} from "@/api";
import {PageHeader} from "@/components/page-header";
import {Skeleton} from "@/components/skeleton";
import {can} from "@/permission";

export let Route = createFileRoute("/_auth/billing/plans")({
  beforeLoad: ({context}) => {
    if (!can(context.user, "billing.read")) throw redirect({to: "/403"});
    return {backLink: {to: "/billing"}};
  },
  component: Plans,
});

// Feature keys are the API's FeatureKey names; split for reading.
function featureLabel(key: string) {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^QR/, "QR ")
    .replace(/^API/, "API ");
}

function Plans() {
  let {t} = useTranslation();
  return (
    <div className="flex flex-col gap-8 px-4">
      <PageHeader
        title={t("billing:plans", {defaultValue: "Plans"})}
        subtitle={t("billing:plansHint", {defaultValue: "Prices and features are defined in the API's billing/plan package; this is what clients are on today."})}
      />
      <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
        <PlanGrid />
      </Suspense>
    </div>
  );
}

function PlanGrid() {
  let {t} = useTranslation();
  let {data} = useSuspenseQuery(listPlansOptions());
  return (
    <ul className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {data.plans.map((plan) => (
        <li key={plan.id} className="bg-surface-300 flex flex-col gap-5 rounded-xl p-5">
          <div className="flex flex-col gap-1">
            <h2 className="text-xl font-semibold tracking-tight">{plan.name}</h2>
            {plan.prices.map((price) => (
              <span key={price.id} className="text-on-surface-secondary text-sm">
                <span className="text-on-surface font-medium tabular-nums">{price.value.display}</span> /{" "}
                {price.billingCycle === "monthly" ? t("billing:month", {defaultValue: "month"}) : t("billing:year", {defaultValue: "year"})}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Link to="/clients" search={{plan: plan.slug}} className="bg-surface-400 hover:bg-surface-500 flex flex-col rounded-lg p-3">
              <span className="text-on-surface-secondary text-xs">{t("clients:clients", {defaultValue: "Clients"})}</span>
              <span className="text-lg font-semibold tabular-nums">{plan.clientCount}</span>
            </Link>
            <div className="bg-surface-400 flex flex-col rounded-lg p-3">
              <span className="text-on-surface-secondary text-xs">{t("billing:mrr", {defaultValue: "MRR"})}</span>
              <span className="text-base font-semibold tabular-nums sm:text-lg">{plan.mrr.display}</span>
            </div>
          </div>
          <ul className="flex flex-col gap-2 text-sm">
            {plan.features.map((feature) => (
              <li key={feature.key} className="flex items-center gap-2">
                <Check size={14} className="text-on-surface-accent shrink-0" />
                <span>
                  {featureLabel(feature.key)}
                  {feature.type === "limit" ? <span className="text-on-surface-secondary"> · {t("billing:upTo", {defaultValue: "up to {{count}}", count: feature.limit})}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}
