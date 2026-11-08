import {Suspense, useMemo} from "react";
import {useSuspenseQuery} from "@tanstack/react-query";
import {createFileRoute, Link} from "@tanstack/react-router";
import {Button} from "@yeahuz/kdsx-react";
import {AlertTriangle, CalendarClock, ChevronRight, CreditCard, Server, TrendingDown, Hourglass, Rocket, ShoppingCart} from "lucide-react";
import {useTranslation} from "react-i18next";
import type {EChartsOption} from "echarts";
import {getAttentionOptions, getOverviewMetricsOptions, listRenewalsOptions, type AttentionItem, type AttentionKind} from "@/api";
import {StatCard} from "@/components/stat-card";
import {ChartCard} from "@/components/chart-card";
import {ECharts} from "@/components/echart";
import {DeltaChip} from "@/components/delta-chip";
import {StatusText} from "@/components/status-text";
import {EmptyState} from "@/components/empty-state";
import {Section} from "@/components/field";
import {Skeleton} from "@/components/skeleton";
import {ListSkeleton} from "@/components/skeletons";
import {useTheme} from "@/theme-provider";
import {axisDefaults, chartTooltipStyle, readPalette, CHART_GRID} from "@/lib/echarts-theme";
import {formatCompact, formatDue, formatPercent, monthDate} from "@/lib/format";
import {vendorLabel} from "@/lib/status";
import {can} from "@/permission";
import {cn} from "@/lib/utils";

function renewalWindow() {
  let from = new Date();
  from.setHours(0, 0, 0, 0);
  let to = new Date(from.getTime() + 7 * 24 * 60 * 60 * 1000);
  return {from: from.toISOString(), to: to.toISOString()};
}

export let Route = createFileRoute("/_auth/")({
  loader: ({context}) => {
    context.queryClient.prefetchQuery(getOverviewMetricsOptions());
    context.queryClient.prefetchQuery(getAttentionOptions());
  },
  component: Overview,
});

function greetingKey() {
  let hour = new Date().getHours();
  if (hour < 12) return "common:greetingMorning";
  if (hour < 18) return "common:greetingAfternoon";
  return "common:greetingEvening";
}

function Overview() {
  let {user} = Route.useRouteContext();
  let {t} = useTranslation();
  return (
    <div className="flex flex-col gap-10 px-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">{t(greetingKey(), {defaultValue: "Hello, {{name}}", name: user.firstName})}</h1>
        <p className="text-on-surface-secondary text-sm">{t("common:overviewHint", {defaultValue: "Who pays, who is about to, and what is broken — across every client."})}</p>
      </div>
      <Suspense fallback={<MetricsSkeleton />}>
        <Metrics />
      </Suspense>
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-5">
        <Section className="lg:col-span-3" title={t("common:needsAttention", {defaultValue: "Needs attention"})}>
          <Suspense fallback={<ListSkeleton rows={6} />}>
            <Attention />
          </Suspense>
        </Section>
        {can(user, "billing.read") ? (
          <Section
            className="lg:col-span-2"
            title={t("billing:renewalsThisWeek", {defaultValue: "Renewals this week"})}
            action={
              <Link to="/billing/renewals" className="text-on-surface-accent text-sm">
                {t("common:seeAll", {defaultValue: "See all"})}
              </Link>
            }
          >
            <Suspense fallback={<ListSkeleton rows={5} />}>
              <Renewals />
            </Suspense>
          </Section>
        ) : null}
      </div>
    </div>
  );
}

function MetricsSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {Array.from({length: 4}).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Skeleton className="h-80 rounded-xl lg:col-span-2" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    </div>
  );
}

function Metrics() {
  let {t} = useTranslation();
  let {theme, colorScheme} = useTheme();
  let {data} = useSuspenseQuery(getOverviewMetricsOptions());

  let mrrOption = useMemo<EChartsOption>(() => {
    let p = readPalette(theme, colorScheme);
    let axis = axisDefaults(theme, colorScheme);
    let months = data.mrrHistory.map((point) => monthDate(point.month).toLocaleDateString("en", {month: "short"}));
    return {
      grid: CHART_GRID.withLegend,
      tooltip: {trigger: "axis", ...chartTooltipStyle(theme, colorScheme), valueFormatter: (value) => `${formatCompact(Number(value))} ${data.currency}`},
      legend: {top: 0, left: 0},
      xAxis: {type: "category", data: months, ...axis},
      yAxis: {type: "value", ...axis, axisLabel: {...axis.axisLabel, formatter: (value: number) => formatCompact(value)}, splitLine: {lineStyle: {color: p.border}}},
      series: [
        {
          name: t("billing:mrr", {defaultValue: "MRR"}),
          type: "line",
          smooth: true,
          symbol: "none",
          data: data.mrrHistory.map((point) => point.mrr),
          lineStyle: {width: 2.5, color: p.brand},
          areaStyle: {opacity: 0.12, color: p.brand},
        },
        {name: t("billing:newMrr", {defaultValue: "New"}), type: "bar", barWidth: 8, data: data.mrrHistory.map((point) => point.newMrr), itemStyle: {color: p.accentBlue, borderRadius: 4}},
        {name: t("billing:churnedMrr", {defaultValue: "Churned"}), type: "bar", barWidth: 8, data: data.mrrHistory.map((point) => -point.churnedMrr), itemStyle: {color: p.danger, borderRadius: 4}},
      ],
    };
  }, [data, theme, colorScheme, t]);

  let fleetOption = useMemo<EChartsOption>(() => {
    let p = readPalette(theme, colorScheme);
    let rows = [
      {name: t("fleet:health.healthy", {defaultValue: "Healthy"}), value: data.fleet.healthy, color: p.brand},
      {name: t("fleet:health.degraded", {defaultValue: "Degraded"}), value: data.fleet.degraded, color: p.accentYellow},
      {name: t("fleet:health.failing", {defaultValue: "Not running"}), value: data.fleet.failing, color: p.danger},
      {name: t("fleet:health.offline", {defaultValue: "Offline"}), value: data.fleet.offline, color: p.onSurfaceSecondary},
    ];
    return {
      tooltip: {trigger: "item", ...chartTooltipStyle(theme, colorScheme)},
      // The list under the ring is the legend; the chart's own would repeat it and crowd the ring.
      legend: {show: false},
      series: [
        {
          type: "pie",
          center: ["50%", "50%"],
          radius: ["70%", "90%"],
          padAngle: 2,
          // A failing till is the slice that matters most and the smallest; keep it visible.
          minAngle: 6,
          avoidLabelOverlap: false,
          itemStyle: {borderRadius: 4},
          emphasis: {scale: false},
          label: {
            show: true,
            position: "center",
            formatter: () => `{total|${data.fleet.total}}\n{caption|${t("fleet:installationsLower", {defaultValue: "installations"})}}`,
            rich: {
              total: {fontSize: 26, fontWeight: 600, color: p.onSurface, lineHeight: 32},
              caption: {fontSize: 12, color: p.onSurfaceSecondary, lineHeight: 16},
            },
          },
          labelLine: {show: false},
          data: rows.map((row) => ({name: row.name, value: row.value, itemStyle: {color: row.color}})),
        },
      ],
    };
  }, [data, theme, colorScheme, t]);

  // "Not running" is three states on the fleet page (crash-looping, misconfigured, never started),
  // so it opens the "needs action" view, which shows all three, rather than filtering to one.
  let fleetRows = [
    {health: "healthy" as const, color: "green" as const, label: t("fleet:health.healthy", {defaultValue: "Healthy"}), value: data.fleet.healthy},
    {health: "degraded" as const, color: "yellow" as const, label: t("fleet:health.degraded", {defaultValue: "Degraded"}), value: data.fleet.degraded},
    {health: "crashLooping" as const, color: "red" as const, label: t("fleet:health.failing", {defaultValue: "Not running"}), value: data.fleet.failing},
    {health: "offline" as const, color: "neutral" as const, label: t("fleet:health.offline", {defaultValue: "Offline"}), value: data.fleet.offline},
  ];

  return (
    <div className="flex flex-col gap-4">
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4 [&>li:last-child:nth-child(odd)]:col-span-2 sm:[&>li:last-child:nth-child(odd)]:col-span-1">
        <StatCard
          label={t("billing:mrr", {defaultValue: "Monthly recurring revenue"})}
          value={data.mrr.display}
          delta={<DeltaChip ratio={data.mrrChange} />}
          hint={t("billing:mrrHint", {defaultValue: "Yearly plans counted at a twelfth"})}
        />
        <StatCard
          label={t("clients:activeClients", {defaultValue: "Active clients"})}
          value={String(data.activeClients)}
          hint={t("clients:activeClientsHint", {defaultValue: "{{count}} new this month · {{trialing}} on trial", count: data.newClientsThisMonth, trialing: data.trialing})}
        />
        <StatCard
          label={t("billing:pastDue", {defaultValue: "Past due"})}
          value={data.pastDueAmount.display}
          hint={t("billing:pastDueHint", {defaultValue: "{{count}} clients behind on payment", count: data.pastDueCount})}
        />
        <StatCard
          label={t("billing:renewalsNext7", {defaultValue: "Renewing in 7 days"})}
          value={data.renewalsNext7DaysAmount.display}
          hint={t("billing:renewalsNext7Hint", {
            defaultValue: "{{count}} renewals · {{rate}} collected unassisted last month",
            count: data.renewalsNext7Days,
            rate: formatPercent(data.collectionRate, 0),
          })}
        />
      </ul>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartCard
          className="lg:col-span-2"
          title={t("billing:mrrTrend", {defaultValue: "Recurring revenue, 12 months"})}
          hint={t("billing:mrrTrendHint", {defaultValue: "New and churned revenue under the line"})}
        >
          <ECharts option={mrrOption} height={280} ariaLabel={t("billing:mrrTrend", {defaultValue: "Recurring revenue, 12 months"})} />
        </ChartCard>
        <ChartCard
          title={t("fleet:fleetHealth", {defaultValue: "Installations"})}
          hint={t("fleet:fleetHealthHint", {defaultValue: "Every till and server reporting to the hub"})}
          endAdornment={
            <Button size="xs" color="neutral" variant="ghost" asChild>
              <Link to="/fleet">{t("common:open", {defaultValue: "Open"})}</Link>
            </Button>
          }
        >
          <ECharts option={fleetOption} height={200} ariaLabel={t("fleet:fleetHealth", {defaultValue: "Installations"})} />
          <ul className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            {fleetRows.map((row) => (
              <li key={row.health}>
                <Link
                  to="/fleet"
                  search={row.health === "crashLooping" ? {} : {view: "all", health: row.health}}
                  className="hover:bg-surface-400 flex items-center justify-between gap-3 rounded-lg px-2 py-1.5"
                >
                  <StatusText color={row.color}>{row.label}</StatusText>
                  <span className="tabular-nums">
                    {row.value}
                    <span className="text-on-surface-secondary ml-1.5 text-xs">{data.fleet.total ? Math.round((row.value / data.fleet.total) * 100) : 0}%</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </ChartCard>
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4 [&>li:last-child:nth-child(odd)]:col-span-2 sm:[&>li:last-child:nth-child(odd)]:col-span-1">
        <StatCard
          label={t("clients:onboardingNow", {defaultValue: "Onboarding"})}
          value={t("clients:clientCount", {defaultValue: "{{count}} clients", count: data.onboardingClients})}
          hint={
            data.medianDaysToFirstSale !== undefined
              ? t("clients:medianFirstSale", {defaultValue: "First sale on day {{days}} (median, last 90 days)", days: data.medianDaysToFirstSale})
              : t("clients:noFirstSales", {defaultValue: "No first sales in the last 90 days"})
          }
          action={
            <Link to="/clients" search={{onboarding: true}} className="text-on-surface-accent hover:underline">
              {t("common:seeThem", {defaultValue: "See them"})}
            </Link>
          }
        />
        {data.planMix.map((row) => (
          <StatCard
            key={row.plan.id}
            label={row.plan.name}
            value={t("clients:clientCount", {defaultValue: "{{count}} clients", count: row.clients})}
            hint={`${formatCompact(row.mrr)} ${data.currency} / ${t("billing:month", {defaultValue: "month"})}`}
            ratio={data.mrr.majorAmount ? Math.round((row.mrr / data.mrr.majorAmount) * 100) : 0}
            ratioLabel={t("billing:ofMrr", {defaultValue: "of MRR"})}
          />
        ))}
      </ul>
    </div>
  );
}

let ATTENTION_ICON: Record<AttentionKind, React.ElementType> = {
  pastDue: AlertTriangle,
  paymentFailed: CreditCard,
  trialEnding: Hourglass,
  fleetFailing: Server,
  inactive: TrendingDown,
  renewalDue: CalendarClock,
  onboardingStalled: Rocket,
  noFirstSale: ShoppingCart,
};

function severityClass(item: AttentionItem) {
  return item.severity === "high" ? "bg-error-low text-error-bright" : item.severity === "medium" ? "bg-bright-yellow/15 text-on-surface-yellow" : "bg-surface-300 text-on-surface-secondary";
}

function Attention() {
  let {t} = useTranslation();
  let {data} = useSuspenseQuery(getAttentionOptions());

  if (!data.items.length) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title={t("common:allClear", {defaultValue: "All clear"})}
        description={t("common:allClearHint", {defaultValue: "Nobody is past due and every installation is reporting."})}
      />
    );
  }

  return (
    <ul className="flex flex-col gap-1">
      {data.items.slice(0, 10).map((item) => {
        let Icon = ATTENTION_ICON[item.kind];
        return (
          <li key={item.id}>
            <Link to="/clients/$id" params={{id: item.clientID}} className="hover:bg-surface-300 group flex items-center gap-3 rounded-xl px-2 py-3">
              <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-full", severityClass(item))}>
                <Icon size={18} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="line-clamp-2 sm:truncate">
                  <span className="font-medium">{item.clientName}</span> <span className="text-on-surface-secondary">·</span> {item.title}
                </span>
                <span className="text-on-surface-secondary line-clamp-2 text-sm sm:truncate">{item.detail}</span>
              </span>
              <ChevronRight size={18} className="text-on-surface-accent shrink-0 opacity-0 group-hover:opacity-100" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function Renewals() {
  let {t} = useTranslation();
  let window = useMemo(renewalWindow, []);
  let {data} = useSuspenseQuery(listRenewalsOptions({query: window}));

  if (!data.renewals.length) {
    return <EmptyState icon={CalendarClock} title={t("billing:noRenewals", {defaultValue: "No renewals this week"})} />;
  }

  return (
    <ul className="flex flex-col gap-1">
      {data.renewals.slice(0, 8).map((renewal) => (
        <li key={renewal.clientID}>
          <Link to="/clients/$id" params={{id: renewal.clientID}} className="hover:bg-surface-300 flex items-center justify-between gap-3 rounded-xl px-2 py-3">
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-medium">{renewal.clientName}</span>
              <span className="text-on-surface-secondary truncate text-sm">
                {renewal.plan.name} ·{" "}
                {renewal.nativeBilling ? t("billing:autopay", {defaultValue: "Autopay via {{vendor}}", vendor: vendorLabel(renewal.vendor)}) : t("billing:manualPay", {defaultValue: "Pays manually"})}
              </span>
            </span>
            <span className="flex shrink-0 flex-col items-end">
              <span className="tabular-nums">{renewal.amount.display}</span>
              <span className={cn("text-sm", renewal.lastPaymentFailed ? "text-error-bright" : "text-on-surface-secondary")}>
                {renewal.lastPaymentFailed ? t("billing:lastChargeFailed", {defaultValue: "Last charge failed"}) : formatDue(renewal.dueAt)}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
