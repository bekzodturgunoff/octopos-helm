import {Suspense, useMemo} from "react";
import {useSuspenseQuery} from "@tanstack/react-query";
import {createFileRoute, Link, redirect} from "@tanstack/react-router";
import {Tabs, TabsList, TabsTrigger} from "@yeahuz/kdsx-react";
import {CalendarClock, ChevronRight} from "lucide-react";
import {useTranslation} from "react-i18next";
import {listRenewalsOptions, type Renewal} from "@/api";
import {PageHeader} from "@/components/page-header";
import {StatCard} from "@/components/stat-card";
import {StatusText} from "@/components/status-text";
import {EmptyState} from "@/components/empty-state";
import {SectionHeader} from "@/components/form-section";
import {ListSkeleton} from "@/components/skeletons";
import {formatDue} from "@/lib/format";
import {subscriptionStatusColor, subscriptionStatusLabel, vendorLabel} from "@/lib/status";
import {can} from "@/permission";
import {uzs} from "@/lib/money";

type Days = 7 | 14 | 30;

export let Route = createFileRoute("/_auth/billing/renewals")({
  beforeLoad: ({context}) => {
    if (!can(context.user, "billing.read")) throw redirect({to: "/403"});
    return {backLink: {to: "/billing"}};
  },
  validateSearch: (search: Record<string, unknown>): {days?: Days} => {
    let days = Number(search.days);
    return {days: days === 7 || days === 14 || days === 30 ? days : undefined};
  },
  component: Renewals,
});

function windowFor(days: number) {
  let from = new Date();
  from.setHours(0, 0, 0, 0);
  let to = new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
  return {from: from.toISOString(), to: to.toISOString()};
}

function Renewals() {
  let {t} = useTranslation();
  let {days = 14} = Route.useSearch();
  let navigate = Route.useNavigate();
  return (
    <div className="flex flex-col gap-8 px-4">
      <PageHeader
        title={t("billing:renewals", {defaultValue: "Upcoming renewals"})}
        subtitle={t("billing:renewalsHint", {defaultValue: "Autopay clients need watching only when a card fails. Everyone else needs a reminder before the day."})}
      />
      <Tabs value={String(days)} onValueChange={(value) => navigate({search: {days: Number(value) as Days}, replace: true})}>
        <TabsList>
          <TabsTrigger value="7">{t("billing:next7", {defaultValue: "7 days"})}</TabsTrigger>
          <TabsTrigger value="14">{t("billing:next14", {defaultValue: "14 days"})}</TabsTrigger>
          <TabsTrigger value="30">{t("billing:next30", {defaultValue: "30 days"})}</TabsTrigger>
        </TabsList>
      </Tabs>
      <Suspense fallback={<ListSkeleton rows={8} />}>
        <RenewalList days={days} />
      </Suspense>
    </div>
  );
}

function RenewalList({days}: {days: number}) {
  let {t} = useTranslation();
  let query = useMemo(() => windowFor(days), [days]);
  let {data} = useSuspenseQuery(listRenewalsOptions({query}));

  // Grouped by calendar day, so the week reads like the calendar it is.
  let groups = useMemo(() => {
    let byDay = new Map<string, Renewal[]>();
    for (let renewal of data.renewals) {
      let key = renewal.dueAt.slice(0, 10);
      byDay.set(key, [...(byDay.get(key) ?? []), renewal]);
    }
    return [...byDay.entries()];
  }, [data.renewals]);

  if (!data.renewals.length) return <EmptyState icon={CalendarClock} title={t("billing:noRenewalsWindow", {defaultValue: "Nothing renews in this window"})} />;

  let currency = data.renewals[0].amount.currency;
  let total = data.renewals.reduce((sum, r) => sum + r.amount.majorAmount, 0);
  let manual = data.renewals.filter((r) => !r.nativeBilling);
  let atRisk = data.renewals.filter((r) => r.lastPaymentFailed || r.subscriptionStatus === "trialing");

  return (
    <div className="flex flex-col gap-8">
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 [&>li:last-child:nth-child(odd)]:col-span-2 sm:[&>li:last-child:nth-child(odd)]:col-span-1">
        <StatCard
          label={t("billing:expected", {defaultValue: "Expected"})}
          value={uzs(total, currency).display}
          hint={t("billing:renewalCount", {defaultValue: "{{count}} renewals", count: data.renewals.length})}
        />
        <StatCard
          label={t("billing:manualRenewals", {defaultValue: "Need a reminder"})}
          value={String(manual.length)}
          hint={t("billing:manualRenewalsHint", {
            defaultValue: "{{amount}} paid by hand",
            amount: uzs(
              manual.reduce((s, r) => s + r.amount.majorAmount, 0),
              currency,
            ).display,
          })}
        />
        <StatCard
          label={t("billing:atRiskRenewals", {defaultValue: "At risk"})}
          value={String(atRisk.length)}
          hint={t("billing:atRiskRenewalsHint", {defaultValue: "Trials converting, or a card that failed"})}
        />
      </ul>
      {groups.map(([day, renewals]) => (
        <section key={day} className="flex flex-col gap-2">
          <SectionHeader
            title={`${new Date(day).toLocaleDateString("en", {weekday: "long", day: "numeric", month: "long"})} · ${formatDue(renewals[0].dueAt)}`}
            action={
              <span className="text-on-surface-secondary text-sm tabular-nums">
                {
                  uzs(
                    renewals.reduce((s, r) => s + r.amount.majorAmount, 0),
                    currency,
                  ).display
                }
              </span>
            }
          />
          <ul className="flex flex-col gap-1">
            {renewals.map((renewal) => (
              <li key={renewal.clientID}>
                <Link to="/clients/$id" params={{id: renewal.clientID}} search={{tab: "billing"}} className="hover:bg-surface-300 group flex items-center justify-between gap-4 rounded-xl px-2 py-3">
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">{renewal.clientName}</span>
                    <span className="text-on-surface-secondary line-clamp-2 text-sm sm:truncate">
                      {renewal.plan.name} · {renewal.owner.name} {renewal.owner.phone ? `· ${renewal.owner.phone}` : ""}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-4">
                    <span className="hidden flex-col items-end text-sm sm:flex">
                      {renewal.lastPaymentFailed ? (
                        <StatusText color="red">{t("billing:lastChargeFailed", {defaultValue: "Last charge failed"})}</StatusText>
                      ) : renewal.subscriptionStatus === "trialing" ? (
                        <StatusText color={subscriptionStatusColor(renewal.subscriptionStatus)}>{subscriptionStatusLabel(t, renewal.subscriptionStatus)}</StatusText>
                      ) : (
                        <StatusText color={renewal.nativeBilling ? "green" : "yellow"}>
                          {renewal.nativeBilling
                            ? t("billing:autopay", {defaultValue: "Autopay via {{vendor}}", vendor: vendorLabel(renewal.vendor)})
                            : t("billing:manualPay", {defaultValue: "Pays manually"})}
                        </StatusText>
                      )}
                    </span>
                    <span className="tabular-nums">{renewal.amount.display}</span>
                    <ChevronRight size={18} className="text-on-surface-accent opacity-0 group-hover:opacity-100" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
