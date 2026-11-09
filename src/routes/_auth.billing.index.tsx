import {Suspense} from "react";
import {useSuspenseQuery} from "@tanstack/react-query";
import {createFileRoute, Link, redirect} from "@tanstack/react-router";
import {NavOption, NavOptionAdornmentWithBg} from "@yeahuz/kdsx-react";
import {AlertTriangle, CalendarClock, CreditCard, FileChartColumn, HeartHandshake, Layers, ReceiptText, Workflow} from "lucide-react";
import {useTranslation} from "react-i18next";
import {getOverviewMetricsOptions} from "@/api";
import {StatCard} from "@/components/stat-card";
import {Skeleton} from "@/components/skeleton";
import {formatPercent} from "@/lib/format";
import {can, canAny} from "@/permission";

export let Route = createFileRoute("/_auth/billing/")({
  beforeLoad: ({context}) => {
    // The area holds money pages and reports; either is reason enough to open it.
    if (!canAny(context.user, "billing.read", "report.read")) throw redirect({to: "/403"});
    return {backLink: {to: "/"}};
  },
  loader: ({context}) => {
    if (can(context.user, "billing.read")) context.queryClient.prefetchQuery(getOverviewMetricsOptions());
  },
  component: Billing,
});

function Billing() {
  let {t} = useTranslation();
  let {user} = Route.useRouteContext();
  let billing = can(user, "billing.read");
  let entries = [
    {
      to: "/billing/renewals",
      icon: CalendarClock,
      title: t("billing:renewals", {defaultValue: "Upcoming renewals"}),
      subtitle: t("billing:renewalsSubtitle", {defaultValue: "Who pays next, and who will need a nudge"}),
    },
    {
      to: "/billing/overdue",
      icon: AlertTriangle,
      title: t("billing:overdue", {defaultValue: "Overdue"}),
      subtitle: t("billing:overdueSubtitle", {defaultValue: "The dunning queue: remind, final notice, suspend"}),
    },
    {
      to: "/billing/payment-chasing",
      icon: Workflow,
      title: t("billing:paymentChasing", {defaultValue: "Payment chasing"}),
      subtitle: t("billing:paymentChasingSubtitle", {defaultValue: "Retries, reminders, grace period and messages — what runs on its own"}),
    },
    {
      to: "/billing/win-back",
      icon: HeartHandshake,
      title: t("billing:winBack", {defaultValue: "Win-back"}),
      subtitle: t("billing:winBackSubtitle", {defaultValue: "Clients who left recently, why, and an offer to return"}),
    },
    {
      to: "/billing/invoices",
      icon: ReceiptText,
      title: t("billing:invoices", {defaultValue: "Invoices"}),
      subtitle: t("billing:invoicesSubtitle", {defaultValue: "Every invoice issued to every client"}),
    },
    {
      to: "/billing/payments",
      icon: CreditCard,
      title: t("billing:payments", {defaultValue: "Payments"}),
      subtitle: t("billing:paymentsSubtitle", {defaultValue: "Click, Payme and manual payments, failed ones included"}),
    },
    {to: "/billing/plans", icon: Layers, title: t("billing:plans", {defaultValue: "Plans"}), subtitle: t("billing:plansSubtitle", {defaultValue: "Prices, features and who is on each"})},
  ].filter(() => billing);
  if (can(user, "report.read")) {
    entries.push({
      to: "/billing/reports",
      icon: FileChartColumn,
      title: t("reports:reports", {defaultValue: "Reports"}),
      subtitle: t("billing:reportsSubtitle", {defaultValue: "Income gained and lost month by month, and whether new clients stay"}),
    });
  }
  return (
    <div className="flex flex-col gap-10 px-4">
      <h1 className="text-3xl font-semibold tracking-tight">{t("billing:billing", {defaultValue: "Billing"})}</h1>
      {billing ? (
        <Suspense fallback={<Skeleton className="h-28 rounded-xl" />}>
          <Summary />
        </Suspense>
      ) : null}
      <ul>
        {entries.map((entry) => (
          <li key={entry.to}>
            <Link to={entry.to}>
              <NavOption
                startAdornment={
                  <NavOptionAdornmentWithBg>
                    <entry.icon size={20} />
                  </NavOptionAdornmentWithBg>
                }
                title={entry.title}
                subtitle={entry.subtitle}
              />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Summary() {
  let {t} = useTranslation();
  let {data} = useSuspenseQuery(getOverviewMetricsOptions());
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4 [&>li:last-child:nth-child(odd)]:col-span-2 sm:[&>li:last-child:nth-child(odd)]:col-span-1">
      <StatCard label={t("billing:mrr", {defaultValue: "MRR"})} value={data.mrr.display} />
      <StatCard
        label={t("billing:pastDue", {defaultValue: "Past due"})}
        value={data.pastDueAmount.display}
        hint={t("billing:pastDueHint", {defaultValue: "{{count}} clients behind on payment", count: data.pastDueCount})}
      />
      <StatCard
        label={t("billing:renewalsNext7", {defaultValue: "Renewing in 7 days"})}
        value={data.renewalsNext7DaysAmount.display}
        hint={t("billing:renewalCount", {defaultValue: "{{count}} renewals", count: data.renewalsNext7Days})}
      />
      <StatCard
        label={t("billing:collectionRate", {defaultValue: "Collected unassisted"})}
        value={formatPercent(data.collectionRate, 0)}
        hint={t("billing:collectionRateHint", {defaultValue: "Of last month's renewals, without a reminder"})}
      />
    </ul>
  );
}
