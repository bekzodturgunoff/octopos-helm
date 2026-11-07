import {Suspense, useMemo, useState} from "react";
import {useSuspenseQuery} from "@tanstack/react-query";
import {createFileRoute, Link, redirect} from "@tanstack/react-router";
import {Button, Input, Tabs, TabsList, TabsTrigger} from "@yeahuz/kdsx-react";
import {Search, Server} from "lucide-react";
import {useTranslation} from "react-i18next";
import {getOperatorFleetNodesOptions} from "@/api";
import {PageHeader} from "@/components/page-header";
import {FilterSelect} from "@/components/filter-bar";
import {StatusText} from "@/components/status-text";
import {EmptyState} from "@/components/empty-state";
import {ListSkeleton} from "@/components/skeletons";
import {FLEET_HEALTH_ORDER, fleetHealth, fleetHealthColor, fleetNodeLabel, healthWord, type FleetHealth} from "@/lib/fleet";
import {formatRelative} from "@/lib/format";
import {can} from "@/permission";
import {cn} from "@/lib/utils";

type View = "problems" | "all";

export let Route = createFileRoute("/_auth/fleet/")({
  beforeLoad: ({context}) => {
    if (!can(context.user, "fleet.read")) throw redirect({to: "/403"});
    return {backLink: {to: "/"}};
  },
  validateSearch: (search: Record<string, unknown>): {view?: View; health?: FleetHealth; version?: string} => ({
    view: (search.view as View) || undefined,
    health: (search.health as FleetHealth) || undefined,
    version: (search.version as string) || undefined,
  }),
  loader: ({context}) => {
    context.queryClient.prefetchQuery(getOperatorFleetNodesOptions());
  },
  component: Fleet,
});

function Fleet() {
  let {t} = useTranslation();
  let search = Route.useSearch();
  let navigate = Route.useNavigate();
  let view = search.view ?? "problems";
  return (
    <div className="flex flex-col gap-8 px-4">
      <PageHeader
        title={t("fleet:fleet", {defaultValue: "Fleet"})}
        subtitle={t("fleet:fleetHint", {
          defaultValue: "Every installation, judged from both heartbeats. Red is ours to fix; offline is usually the client's power or network.",
        })}
      >
        <Button size="sm" color="brand" variant="outline" asChild>
          <Link to="/fleet/releases">{t("fleet:releases", {defaultValue: "Releases"})}</Link>
        </Button>
      </PageHeader>
      <Tabs value={view} onValueChange={(value) => navigate({search: (prev) => ({...prev, view: value === "problems" ? undefined : (value as View)}), replace: true})}>
        <TabsList>
          <TabsTrigger value="problems">{t("fleet:needsAction", {defaultValue: "Needs action"})}</TabsTrigger>
          <TabsTrigger value="all">{t("fleet:all", {defaultValue: "All installations"})}</TabsTrigger>
        </TabsList>
      </Tabs>
      <Suspense fallback={<ListSkeleton rows={10} />}>
        <NodeList view={view} health={search.health} version={search.version} />
      </Suspense>
    </div>
  );
}

function NodeList({view, health, version}: {view: View; health?: FleetHealth; version?: string}) {
  let {t} = useTranslation();
  let navigate = Route.useNavigate();
  let [q, setQ] = useState("");
  let {data} = useSuspenseQuery({...getOperatorFleetNodesOptions(), refetchInterval: 30_000});

  let judged = useMemo(() => data.nodes.map((node) => ({node, health: fleetHealth(node)})), [data.nodes]);
  let counts = useMemo(() => {
    let map = new Map<FleetHealth, number>();
    for (let {health} of judged) map.set(health, (map.get(health) ?? 0) + 1);
    return map;
  }, [judged]);
  let versions = useMemo(() => [...new Set(data.nodes.map((n) => n.runningVersion).filter(Boolean) as string[])].sort().reverse(), [data.nodes]);

  let rows = judged
    .filter(({health: h}) => (view === "problems" ? h !== "healthy" && h !== "retired" : true))
    .filter(({health: h}) => !health || h === health)
    .filter(({node}) => !version || node.runningVersion === version)
    .filter(({node}) => {
      if (!q.trim()) return true;
      let needle = q.toLowerCase();
      return node.tenantName.toLowerCase().includes(needle) || fleetNodeLabel(node).toLowerCase().includes(needle) || node.nodeID.startsWith(needle);
    })
    .sort((a, b) => FLEET_HEALTH_ORDER.indexOf(a.health) - FLEET_HEALTH_ORDER.indexOf(b.health) || a.node.tenantName.localeCompare(b.node.tenantName));

  return (
    <div className="flex flex-col gap-6">
      <ul className="flex flex-wrap gap-2">
        {FLEET_HEALTH_ORDER.filter((h) => counts.get(h)).map((h) => (
          <li key={h}>
            <button
              type="button"
              onClick={() => navigate({search: (prev) => ({...prev, health: health === h ? undefined : h, view: "all"})})}
              className={cn("bg-surface-300 hover:bg-surface-400 rounded-full px-3 py-1.5 text-sm", {"ring-accent ring-2": health === h})}
            >
              <StatusText color={fleetHealthColor(h)}>
                {healthWord(t, h)} <span className="text-on-surface-secondary tabular-nums">{counts.get(h)}</span>
              </StatusText>
            </button>
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("fleet:search", {defaultValue: "Client, local name or node id"})}
          startAdornment={<Search size={18} className="text-on-surface-secondary" />}
        />
        <FilterSelect
          label={t("fleet:anyVersion", {defaultValue: "Any version"})}
          value={version}
          onChange={(value) => navigate({search: (prev) => ({...prev, version: value})})}
          options={versions.map((v) => ({value: v, label: v}))}
        />
      </div>
      {rows.length ? (
        <ul className="flex flex-col gap-1">
          {rows.map(({node, health: h}) => (
            <li key={node.nodeID}>
              <Link
                to="/fleet/$id"
                params={{id: node.nodeID}}
                className="hover:bg-surface-300 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-xl px-2 py-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_10rem]"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-medium">{node.tenantName}</span>
                  <span className="text-on-surface-secondary truncate text-sm">
                    {fleetNodeLabel(node)} · {node.location?.name ?? "—"}
                  </span>
                </span>
                <span className="text-on-surface-secondary hidden text-sm lg:block">
                  {node.runningVersion ?? "—"}
                  {node.targetVersion && node.targetVersion !== node.runningVersion ? ` → ${node.targetVersion}` : ""}
                </span>
                <span className="text-on-surface-secondary hidden text-sm lg:block">{formatRelative(node.lastExchangeAt ?? node.lastCheckinAt)}</span>
                <StatusText color={fleetHealthColor(h)} className="justify-self-end text-sm">
                  {healthWord(t, h)}
                </StatusText>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={Server}
          title={view === "problems" ? t("fleet:allHealthy", {defaultValue: "Every installation is healthy"}) : t("fleet:noneMatch", {defaultValue: "No installations match"})}
        />
      )}
    </div>
  );
}
