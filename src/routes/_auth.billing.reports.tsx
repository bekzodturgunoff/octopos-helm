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

export let Route = createFileRoute("/_auth/billing/reports")({
  beforeLoad: ({context}) => {
    if (!can(context.user, "report.read")) throw redirect({to: "/403"});
    return {backLink: {to: "/billing"}};
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
        subtitle={t("reports:pageHint", {defaultValue: "Where your monthly income comes from, where it goes, and whether new clients stay."})}
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

// The theme has no purple, and "came back" needs a colour no one confuses with "new".
let VIOLET = "#9b7bf0";

type Kind = {key: "newMrr" | "expansionMrr" | "reactivationMrr" | "contractionMrr" | "churnedMrr"; label: string; meaning: string; color: string};

/** The five ways monthly income changes, each with one colour used everywhere on the page. */
function useKinds(): Kind[] {
  let {t} = useTranslation();
  let {theme, colorScheme} = useTheme();
  return useMemo(() => {
    let p = readPalette(theme, colorScheme);
    return [
      {key: "newMrr", label: t("reports:kindNew", {defaultValue: "New clients"}), meaning: t("reports:kindNewHint", {defaultValue: "clients who started paying"}), color: p.brand},
      {key: "expansionMrr", label: t("reports:kindUp", {defaultValue: "Upgrades"}), meaning: t("reports:kindUpHint", {defaultValue: "clients who moved to a bigger plan"}), color: p.accentBlue},
      {key: "reactivationMrr", label: t("reports:kindBack", {defaultValue: "Came back"}), meaning: t("reports:kindBackHint", {defaultValue: "clients who left and returned"}), color: VIOLET},
      {
        key: "contractionMrr",
        label: t("reports:kindDown", {defaultValue: "Downgrades"}),
        meaning: t("reports:kindDownHint", {defaultValue: "clients who moved to a smaller plan"}),
        color: p.accentYellow,
      },
      {key: "churnedMrr", label: t("reports:kindLeft", {defaultValue: "Left"}), meaning: t("reports:kindLeftHint", {defaultValue: "clients who stopped paying"}), color: p.danger},
    ] as Kind[];
  }, [t, theme, colorScheme]);
}

function Dot({color}: {color: string}) {
  return <span aria-hidden className="inline-block size-2.5 shrink-0 rounded-full" style={{backgroundColor: color}} />;
}

function Movement() {
  let {t} = useTranslation();
  let {theme, colorScheme} = useTheme();
  let {data} = useSuspenseQuery(getRevenueMovementOptions({query: {months: 12}}));
  let phone = usePhone();
  let kinds = useKinds();
  let [allMonths, setAllMonths] = useState(false);
  let last = data.months[data.months.length - 1];
  let net = last.newMrr + last.expansionMrr + last.reactivationMrr + last.contractionMrr + last.churnedMrr;

  let option = useMemo<EChartsOption>(() => {
    let p = readPalette(theme, colorScheme);
    let axis = axisDefaults(theme, colorScheme);
    return {
      // The legend is drawn under the chart as a list with what each colour means, not in it.
      grid: {...CHART_GRID.withLegend, top: 8},
      legend: {show: false},
      tooltip: {trigger: "axis", ...chartTooltipStyle(theme, colorScheme), valueFormatter: (value) => `${formatCompact(Number(value))} ${data.currency}`},
      xAxis: {type: "category", data: data.months.map((m) => monthLabel(m.month)), ...axis},
      yAxis: {type: "value", ...axis, axisLabel: {...axis.axisLabel, formatter: (v: number) => formatCompact(v)}, splitLine: {lineStyle: {color: p.border}}},
      series: kinds.map((kind) => ({
        name: kind.label,
        type: "bar",
        stack: "movement",
        data: data.months.map((m) => m[kind.key]),
        itemStyle: {color: kind.color, borderRadius: 2},
        barMaxWidth: phone ? 14 : 28,
      })) as EChartsOption["series"],
    };
  }, [data, theme, colorScheme, phone, kinds]);

  let money = (n: number) => (n === 0 ? "—" : `${n > 0 ? "+" : "−"}${formatNumber(Math.abs(n))}`);

  return (
    <div className="flex flex-col gap-6">
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4 [&>li:last-child:nth-child(odd)]:col-span-2 sm:[&>li:last-child:nth-child(odd)]:col-span-1">
        <StatCard
          label={t("reports:statIncome", {defaultValue: "Monthly income change"})}
          value={`${net >= 0 ? "+" : "−"}${uzs(Math.abs(net)).display}`}
          hint={t("reports:statIncomeHint", {defaultValue: "This month: {{count}} new clients, {{churned}} left", count: last.newClients, churned: last.churnedClients})}
        />
        <StatCard label={t("reports:statAverage", {defaultValue: "Average client pays"})} value={uzs(data.arpa).display} hint={t("reports:statAverageHint", {defaultValue: "Per month"})} />
        <StatCard
          label={t("reports:statKept", {defaultValue: "Kept from last year"})}
          value={formatPercent(data.nrr, 0)}
          hint={t("reports:statKeptHint", {defaultValue: "What last year's clients pay now, compared with then. Over 100% means they pay more."})}
        />
        <StatCard
          label={t("reports:statKeptNoUp", {defaultValue: "Kept, without upgrades"})}
          value={formatPercent(data.grr, 0)}
          hint={t("reports:statKeptNoUpHint", {defaultValue: "The same, counting only losses. The rest left or downgraded."})}
        />
      </ul>
      <ChartCard
        title={t("reports:chartTitle", {defaultValue: "Monthly income: gained and lost"})}
        hint={t("reports:chartHint", {defaultValue: "Bars above zero are money gained that month. Bars below zero are money lost."})}
      >
        <ECharts option={option} height={phone ? 240 : 300} ariaLabel={t("reports:chartTitle", {defaultValue: "Monthly income: gained and lost"})} />
        <ul className="mt-4 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {kinds.map((kind) => (
            <li key={kind.key} className="flex items-baseline gap-2">
              <Dot color={kind.color} />
              <span>
                <span className="font-medium">{kind.label}</span> <span className="text-on-surface-secondary">— {kind.meaning}</span>
              </span>
            </li>
          ))}
        </ul>
      </ChartCard>
      <Section title={t("reports:byMonthTitle", {defaultValue: "Month by month (so'm)"})} action={<ExportButton name="revenue-movement" load={async () => data.months} columns={MOVEMENT_COLUMNS} />}>
        {/* A phone gets one card per month: what it ended at, and what changed it. */}
        <ul className="flex flex-col gap-3 sm:hidden">
          {data.months
            .slice()
            .reverse()
            .slice(0, allMonths ? undefined : 6)
            .map((m) => {
              let change = m.endingMrr - m.startingMrr;
              return (
                <li key={m.month} className="bg-surface-200 rounded-xl p-4 text-sm tabular-nums">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-medium">{monthLabel(m.month)}</span>
                    <span className={change >= 0 ? "text-on-surface-green" : "text-error-bright"}>{money(change)}</span>
                  </div>
                  <span className="text-on-surface-secondary text-xs">{t("reports:endedAt", {defaultValue: "Monthly income: {{amount}}", amount: formatNumber(m.endingMrr)})}</span>
                  <dl className="mt-3 flex flex-col gap-1.5">
                    {kinds.map((kind) => (
                      <div key={kind.key} className="flex items-center justify-between gap-2">
                        <dt className="flex items-center gap-2">
                          <Dot color={kind.color} />
                          {kind.label}
                        </dt>
                        <dd className={m[kind.key] ? "" : "text-on-surface-secondary"}>{money(m[kind.key])}</dd>
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
          <table className="w-full min-w-[760px] text-sm tabular-nums">
            <thead className="text-on-surface-secondary text-xs">
              <tr className="border-b-border-secondary border-b">
                <th className="bg-surface sticky left-0 py-2 pr-3 text-left font-medium">{t("reports:colMonth", {defaultValue: "Month"})}</th>
                <th className="py-2 text-right font-medium">{t("reports:colStart", {defaultValue: "At the start"})}</th>
                {kinds.map((kind) => (
                  <th key={kind.key} className="py-2 text-right font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      <Dot color={kind.color} />
                      {kind.label}
                    </span>
                  </th>
                ))}
                <th className="py-2 text-right font-medium">{t("reports:colEnd", {defaultValue: "At the end"})}</th>
              </tr>
            </thead>
            <tbody>
              {data.months
                .slice()
                .reverse()
                .map((m) => (
                  <tr key={m.month} className="border-b-border-secondary border-b last:border-b-0">
                    <td className="bg-surface sticky left-0 py-2 pr-3 whitespace-nowrap">{monthLabel(m.month)}</td>
                    <td className="text-on-surface-secondary text-right">{formatNumber(m.startingMrr)}</td>
                    {kinds.map((kind) => (
                      <td key={kind.key} className={cn("text-right", m[kind.key] ? "" : "text-on-surface-secondary")}>
                        {money(m[kind.key])}
                      </td>
                    ))}
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

  // Colour by how much is left: a group keeping 90% reads green, one down to half reads red.
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
          {t("reports:byClients", {defaultValue: "By clients"})}
        </TabsTrigger>
        <TabsTrigger value="revenue" className="px-2 text-sm max-sm:whitespace-normal sm:px-4 sm:text-base">
          {t("reports:byMoney", {defaultValue: "By money"})}
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );

  return (
    <Section title={t("reports:stayTitle", {defaultValue: "Do new clients stay?"})} action={<span className="max-sm:hidden">{switcher}</span>}>
      {/* The labels run long in Uzbek and Russian, so on a phone the switch gets its own full-width row. */}
      <div className="sm:hidden">{switcher}</div>
      <p className="text-on-surface-secondary text-sm">
        {mode === "clients"
          ? t("reports:stayHintClients", {defaultValue: "Each row is the clients who joined in one month. Each box shows how many of them still pay after that many months."})
          : t("reports:stayHintMoney", {defaultValue: "Each row is the clients who joined in one month. Each box shows how much of their first payment still comes in after that many months."})}
      </p>
      <div className="overflow-x-auto">
        <table className="text-xs tabular-nums max-sm:w-full">
          <thead className="text-on-surface-secondary">
            <tr>
              <th className="bg-surface sticky left-0 py-1 pr-3 text-left font-medium">{t("reports:joined", {defaultValue: "Joined"})}</th>
              <th className="py-1 pr-3 text-right font-medium">{t("reports:clientsCol", {defaultValue: "Clients"})}</th>
              {columns.map((i) => (
                <th key={i} className="w-12 py-1 text-center font-medium whitespace-nowrap">
                  {i === 0 ? t("reports:monthStart", {defaultValue: "Start"}) : t("reports:afterMonths", {defaultValue: "{{count}} mo", count: i})}
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
      <ul className="text-on-surface-secondary flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <li className="flex items-center gap-1.5">
          <span className="bg-bright-green/45 size-3 rounded" /> {t("reports:keyMost", {defaultValue: "Almost all stayed"})}
        </li>
        <li className="flex items-center gap-1.5">
          <span className="bg-bright-yellow/25 size-3 rounded" /> {t("reports:keySome", {defaultValue: "Some left"})}
        </li>
        <li className="flex items-center gap-1.5">
          <span className="bg-error-bright/25 size-3 rounded" /> {t("reports:keyMany", {defaultValue: "Many left"})}
        </li>
      </ul>
    </Section>
  );
}
