import {Suspense, useEffect, useMemo, useState} from "react";
import {useSuspenseQuery} from "@tanstack/react-query";
import {createFileRoute, redirect} from "@tanstack/react-router";
import {Button, Tabs, TabsList, TabsTrigger} from "@yeahuz/kdsx-react";
import {useTranslation} from "react-i18next";
import type {EChartsOption} from "echarts";
import {getRevenueMovementOptions, listCohortsOptions, type RevenueMovementMonth} from "@/api";
import {PageHeader} from "@/components/page-header";
import {StatCard} from "@/components/stat-card";
import {ChartCard} from "@/components/chart-card";
import {ECharts} from "@/components/echart";
import {Section} from "@/components/field";
import {Skeleton} from "@/components/skeleton";
import {ExportButton} from "@/components/export-button";
import {useTheme} from "@/theme-provider";
import {axisDefaults, chartTooltipStyle, readPalette, CHART_GRID} from "@/lib/echarts-theme";
import {formatCompact, formatNumber, formatPercent, monthDate} from "@/lib/format";
import {uzs} from "@/lib/money";
import {can} from "@/permission";
import {cn} from "@/lib/utils";

export let Route = createFileRoute("/_auth/reports")({
  beforeLoad: ({context}) => {
    if (!can(context.user, "billing.read")) throw redirect({to: "/403"});
    return {backLink: {to: "/"}};
  },
  loader: ({context}) => {
    context.queryClient.prefetchQuery(getRevenueMovementOptions({query: {months: 12}}));
    context.queryClient.prefetchQuery(listCohortsOptions({query: {months: 12}}));
  },
  component: Reports,
});

// Below the sm breakpoint, where the bottom tab bar shows. The chart is drawn on a canvas, so it
// cannot use Tailwind's breakpoints and asks the browser instead.
let PHONE = "(max-width: 639px)";
function usePhone() {
  let [phone, setPhone] = useState(() => typeof window !== "undefined" && window.matchMedia(PHONE).matches);
  useEffect(() => {
    let media = window.matchMedia(PHONE);
    let onChange = () => setPhone(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);
  return phone;
}

function monthLabel(month: string) {
  return monthDate(month).toLocaleDateString("en", {month: "short", year: "2-digit"});
}

function Reports() {
  let {t} = useTranslation();
  return (
    <div className="flex flex-col gap-10 px-4">
      <PageHeader
        title={t("reports:reports", {defaultValue: "Reports"})}
        subtitle={t("reports:hint", {defaultValue: "Where recurring revenue comes from, where it goes, and whether the clients who sign stay."})}
      />
      <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
        <Movement />
      </Suspense>
      <Suspense fallback={<Skeleton className="h-80 rounded-xl" />}>
        <Cohorts />
      </Suspense>
    </div>
  );
}

let MOVEMENT_COLUMNS = [
  {header: "Month", value: (m: RevenueMovementMonth) => m.month},
  {header: "Starting MRR", value: (m: RevenueMovementMonth) => m.startingMrr},
  {header: "New", value: (m: RevenueMovementMonth) => m.newMrr},
  {header: "Expansion", value: (m: RevenueMovementMonth) => m.expansionMrr},
  {header: "Reactivation", value: (m: RevenueMovementMonth) => m.reactivationMrr},
  {header: "Contraction", value: (m: RevenueMovementMonth) => m.contractionMrr},
  {header: "Churned", value: (m: RevenueMovementMonth) => m.churnedMrr},
  {header: "Ending MRR", value: (m: RevenueMovementMonth) => m.endingMrr},
  {header: "New clients", value: (m: RevenueMovementMonth) => m.newClients},
  {header: "Churned clients", value: (m: RevenueMovementMonth) => m.churnedClients},
];

function Movement() {
  let {t} = useTranslation();
  let {theme, colorScheme} = useTheme();
  let {data} = useSuspenseQuery(getRevenueMovementOptions({query: {months: 12}}));
  let phone = usePhone();
  let [allMonths, setAllMonths] = useState(false);
  let last = data.months[data.months.length - 1];
  let net = last.newMrr + last.expansionMrr + last.reactivationMrr + last.contractionMrr + last.churnedMrr;

  let option = useMemo<EChartsOption>(() => {
    let p = readPalette(theme, colorScheme);
    let axis = axisDefaults(theme, colorScheme);
    let series = (name: string, key: keyof RevenueMovementMonth, color: string): NonNullable<EChartsOption["series"]> => [
      {name, type: "bar", stack: "movement", data: data.months.map((m) => m[key] as number), itemStyle: {color, borderRadius: 2}, barMaxWidth: phone ? 14 : 28},
    ];
    return {
      // Five series do not fit one line on a phone, so there the legend wraps onto a second line and
      // the bars start below it.
      grid: phone ? {...CHART_GRID.withLegend, top: 60} : CHART_GRID.withLegend,
      legend: {top: 0, left: 0, itemGap: phone ? 12 : 20},
      tooltip: {trigger: "axis", ...chartTooltipStyle(theme, colorScheme), valueFormatter: (value) => `${formatCompact(Number(value))} ${data.currency}`},
      xAxis: {type: "category", data: data.months.map((m) => monthLabel(m.month)), ...axis},
      yAxis: {type: "value", ...axis, axisLabel: {...axis.axisLabel, formatter: (v: number) => formatCompact(v)}, splitLine: {lineStyle: {color: p.border}}},
      series: [
        ...(series(t("reports:new", {defaultValue: "New"}), "newMrr", p.brand) as object[]),
        ...(series(t("reports:expansion", {defaultValue: "Expansion"}), "expansionMrr", p.accentBlue) as object[]),
        ...(series(t("reports:reactivation", {defaultValue: "Reactivation"}), "reactivationMrr", p.brandSoft) as object[]),
        ...(series(t("reports:contraction", {defaultValue: "Contraction"}), "contractionMrr", p.accentYellow) as object[]),
        ...(series(t("reports:churned", {defaultValue: "Churned"}), "churnedMrr", p.danger) as object[]),
      ] as EChartsOption["series"],
    };
  }, [data, theme, colorScheme, t, phone]);

  let money = (n: number) => (n === 0 ? "—" : `${n > 0 ? "+" : "−"}${formatNumber(Math.abs(n))}`);

  return (
    <div className="flex flex-col gap-6">
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4 [&>li:last-child:nth-child(odd)]:col-span-2 sm:[&>li:last-child:nth-child(odd)]:col-span-1">
        <StatCard
          label={t("reports:nrr", {defaultValue: "Net revenue retention"})}
          value={formatPercent(data.nrr, 0)}
          hint={t("reports:nrrHint", {defaultValue: "Last year's clients pay this share of what they did, growth included. Above 100% grows without new sales."})}
        />
        <StatCard
          label={t("reports:grr", {defaultValue: "Gross revenue retention"})}
          value={formatPercent(data.grr, 0)}
          hint={t("reports:grrHint", {defaultValue: "The same without growth — what was kept."})}
        />
        <StatCard
          label={t("reports:netNew", {defaultValue: "Net new MRR this month"})}
          value={`${net >= 0 ? "+" : "−"}${uzs(Math.abs(net)).display}`}
          hint={t("reports:netNewHint", {defaultValue: "{{count}} new clients, {{churned}} lost", count: last.newClients, churned: last.churnedClients})}
        />
        <StatCard label={t("reports:arpa", {defaultValue: "Revenue per paying client"})} value={uzs(data.arpa).display} hint={t("reports:arpaHint", {defaultValue: "MRR divided by paying clients"})} />
      </ul>
      <ChartCard title={t("reports:movementTitle", {defaultValue: "Recurring revenue movement"})} hint={t("reports:movementHint", {defaultValue: "Above the line it came in, below it went out."})}>
        <ECharts option={option} height={300} ariaLabel={t("reports:movementTitle", {defaultValue: "Recurring revenue movement"})} />
      </ChartCard>
      <Section title={t("reports:byMonth", {defaultValue: "By month (UZS)"})} action={<ExportButton name="revenue-movement" load={async () => data.months} columns={MOVEMENT_COLUMNS} />}>
        {/* A phone gets one card per month: where it ended, and what moved it. */}
        <ul className="flex flex-col gap-3 sm:hidden">
          {data.months
            .slice()
            .reverse()
            .slice(0, allMonths ? undefined : 6)
            .map((m) => {
              let change = m.endingMrr - m.startingMrr;
              let moves = [
                {label: t("reports:col.New", {defaultValue: "New"}), value: m.newMrr, className: "text-on-surface-green"},
                {label: t("reports:col.Expansion", {defaultValue: "Expansion"}), value: m.expansionMrr, className: "text-on-surface-blue"},
                {label: t("reports:col.Reactivated", {defaultValue: "Reactivated"}), value: m.reactivationMrr, className: ""},
                {label: t("reports:col.Contraction", {defaultValue: "Contraction"}), value: m.contractionMrr, className: "text-on-surface-yellow"},
                {label: t("reports:col.Churned", {defaultValue: "Churned"}), value: m.churnedMrr, className: "text-error-bright"},
              ];
              return (
                <li key={m.month} className="bg-surface-200 rounded-xl p-4 text-sm tabular-nums">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-medium">{monthLabel(m.month)}</span>
                    <span className="text-right">
                      <span className="font-medium">{formatNumber(m.endingMrr)}</span> <span className={change >= 0 ? "text-on-surface-green" : "text-error-bright"}>{money(change)}</span>
                    </span>
                  </div>
                  <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1.5 min-[360px]:grid-cols-2">
                    {moves.map((move) => (
                      <div key={move.label} className="flex justify-between gap-2">
                        <dt className="text-on-surface-secondary">{move.label}</dt>
                        <dd className={move.value ? move.className : "text-on-surface-secondary"}>{money(move.value)}</dd>
                      </div>
                    ))}
                  </dl>
                </li>
              );
            })}
          {!allMonths && data.months.length > 6 ? (
            <li>
              <Button color="neutral" variant="fill" className="w-full" onClick={() => setAllMonths(true)}>
                {t("reports:showAllMonths", {defaultValue: "Show all {{count}} months", count: data.months.length})}
              </Button>
            </li>
          ) : null}
        </ul>
        <div className="overflow-x-auto max-sm:hidden">
          <table className="w-full min-w-[720px] text-sm tabular-nums">
            <thead className="text-on-surface-secondary text-xs">
              <tr className="border-b-border-secondary border-b">
                {["Month", "Start", "New", "Expansion", "Reactivated", "Contraction", "Churned", "End"].map((h) => (
                  <th key={h} className={cn("py-2 font-medium", h === "Month" ? "bg-surface sticky left-0 pr-3 text-left" : "text-right")}>
                    {t(`reports:col.${h}`, {defaultValue: h})}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.months
                .slice()
                .reverse()
                .map((m) => (
                  <tr key={m.month} className="border-b-border-secondary border-b last:border-b-0">
                    <td className="bg-surface sticky left-0 py-2 pr-3 whitespace-nowrap">{monthLabel(m.month)}</td>
                    <td className="text-right">{formatNumber(m.startingMrr)}</td>
                    <td className="text-on-surface-green text-right">{money(m.newMrr)}</td>
                    <td className="text-on-surface-blue text-right">{money(m.expansionMrr)}</td>
                    <td className="text-right">{money(m.reactivationMrr)}</td>
                    <td className="text-on-surface-yellow text-right">{money(m.contractionMrr)}</td>
                    <td className="text-error-bright text-right">{money(m.churnedMrr)}</td>
                    <td className="text-right font-medium">{formatNumber(m.endingMrr)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}

function Cohorts() {
  let {t} = useTranslation();
  let {data} = useSuspenseQuery(listCohortsOptions({query: {months: 12}}));
  let [mode, setMode] = useState<"clients" | "revenue">("clients");
  let width = Math.max(...data.cohorts.map((c) => c.clientRetention.length));
  let phone = usePhone();
  // Twelve month columns do not fit a phone, and sideways scrolling a heatmap loses the row it is
  // on. There it keeps the months that tell the story: the first, a quarter, half a year, the latest.
  let columns = phone ? [...new Set([1, 3, 6, width - 1])].filter((i) => i > 0 && i < width) : Array.from({length: width}, (_, i) => i);

  // Colour by how much is left: a cohort keeping 90% reads green, one down to half reads red.
  let shade = (value: number) => {
    if (value >= 0.9) return "bg-bright-green/45";
    if (value >= 0.8) return "bg-bright-green/30";
    if (value >= 0.7) return "bg-bright-green/15";
    if (value >= 0.6) return "bg-bright-yellow/25";
    return "bg-error-bright/25";
  };

  let switcher = (
    <Tabs value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
      <TabsList className="max-sm:grid max-sm:w-full max-sm:grid-cols-2">
        <TabsTrigger value="clients" className="px-2 text-sm max-sm:whitespace-normal sm:px-4 sm:text-base">
          {t("reports:clientsKept", {defaultValue: "Clients kept"})}
        </TabsTrigger>
        <TabsTrigger value="revenue" className="px-2 text-sm max-sm:whitespace-normal sm:px-4 sm:text-base">
          {t("reports:revenueKept", {defaultValue: "Revenue kept"})}
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );

  return (
    <Section title={t("reports:cohorts", {defaultValue: "Cohorts"})} action={<span className="max-sm:hidden">{switcher}</span>}>
      {/* The labels run long in Uzbek and Russian, so on a phone the switch gets its own full-width row. */}
      <div className="sm:hidden">{switcher}</div>
      <p className="text-on-surface-secondary text-sm">
        {t("reports:cohortsHint", {defaultValue: "Each row is the clients who signed that month; each column is months since. Most loss in the first three months means onboarding is where to look."})}
      </p>
      <div className="overflow-x-auto">
        <table className="text-xs tabular-nums max-sm:w-full">
          <thead className="text-on-surface-secondary">
            <tr>
              <th className="bg-surface sticky left-0 py-1 pr-3 text-left font-medium">{t("reports:signed", {defaultValue: "Signed"})}</th>
              <th className="py-1 pr-3 text-right font-medium">{t("reports:clientsCol", {defaultValue: "Clients"})}</th>
              {columns.map((i) => (
                <th key={i} className="w-12 py-1 text-center font-medium">
                  {i === 0 ? t("reports:m0", {defaultValue: "M0"}) : `M${i}`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.cohorts.map((cohort) => {
              let row = mode === "clients" ? cohort.clientRetention : cohort.revenueRetention;
              return (
                <tr key={cohort.month}>
                  <td className="bg-surface sticky left-0 py-0.5 pr-3 whitespace-nowrap">{monthLabel(cohort.month)}</td>
                  <td className="text-on-surface-secondary py-0.5 pr-3 text-right">{cohort.clients}</td>
                  {columns.map((i) => (
                    <td key={i} className="p-0.5">
                      {row[i] !== undefined ? <span className={cn("block rounded px-1 py-1.5 text-center", shade(Math.min(1, row[i])))}>{Math.round(row[i] * 100)}%</span> : null}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Section>
  );
}
