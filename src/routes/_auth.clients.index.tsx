import {Suspense, useEffect, useState} from "react";
import {useQuery, useSuspenseQuery} from "@tanstack/react-query";
import {createFileRoute, Link, redirect} from "@tanstack/react-router";
import {Button, Input, Select} from "@yeahuz/kdsx-react";
import {Search, Users} from "lucide-react";
import {useTranslation} from "react-i18next";
import {
  bulkCreateTasksMutation,
  bulkUpdateClientsMutation,
  listClients,
  listClientsOptions,
  listOperatorsOptions,
  type BulkResult,
  type TaskKind,
  type TaskPriority,
  type Client,
  type ClientSort,
  type ClientStatus,
  type HealthGrade,
  type ListClientsQuery,
  type SubscriptionStatus,
} from "@/api";
import {PageHeader} from "@/components/page-header";
import {FilterSelect} from "@/components/filter-bar";
import {HealthBadge} from "@/components/health-badge";
import {OnboardingProgress} from "@/components/onboarding";
import {ExportButton} from "@/components/export-button";
import {SaveViewButton} from "@/components/saved-views";
import {FormDialog, FormField} from "@/components/form-dialog";
import {TaskFields} from "@/components/task-list";
import type {Column} from "@/lib/csv";
import {StatusText} from "@/components/status-text";
import {EmptyState} from "@/components/empty-state";
import {ListSkeleton} from "@/components/skeletons";
import {Pagination} from "@/components/pagination";
import {useDebounced} from "@/hooks";
import {can, Can} from "@/permission";
import {clientStatusColor, clientStatusLabel, subscriptionStatusColor, subscriptionStatusLabel} from "@/lib/status";
import {daysUntil, formatDue} from "@/lib/format";
import {cn} from "@/lib/utils";

type Search = Omit<ListClientsQuery, "pageSize">;

export let Route = createFileRoute("/_auth/clients/")({
  beforeLoad: ({context}) => {
    if (!can(context.user, "client.read")) throw redirect({to: "/403"});
  },
  validateSearch: (search: Record<string, unknown>): Search => ({
    q: (search.q as string) || undefined,
    status: (search.status as ClientStatus) || undefined,
    subscriptionStatus: (search.subscriptionStatus as SubscriptionStatus) || undefined,
    plan: (search.plan as string) || undefined,
    health: (search.health as HealthGrade) || undefined,
    sort: (search.sort as ClientSort) || undefined,
    onboarding: search.onboarding === true || search.onboarding === "true" ? true : undefined,
    page: Number(search.page) || undefined,
  }),
  loaderDeps: ({search}) => search,
  loader: ({context, deps}) => {
    context.queryClient.prefetchQuery(listClientsOptions({query: {...deps, pageSize: 25}}));
  },
  component: Clients,
});

function Clients() {
  let {t} = useTranslation();
  let {user} = Route.useRouteContext();
  let search = Route.useSearch();
  let navigate = Route.useNavigate();
  let [q, setQ] = useState(search.q ?? "");
  let settled = useDebounced(q, 300);

  useEffect(() => {
    if ((settled || undefined) === search.q) return;
    navigate({search: (prev) => ({...prev, q: settled || undefined, page: undefined}), replace: true});
  }, [settled, search.q, navigate]);

  let set = (key: keyof Search) => (value: string | undefined) => navigate({search: (prev) => ({...prev, [key]: value, page: undefined})});
  let filtered = Boolean(search.status || search.subscriptionStatus || search.plan || search.health || search.q || search.onboarding);

  return (
    <div className="flex flex-col gap-8 px-4">
      <PageHeader
        title={t("clients:clients", {defaultValue: "Clients"})}
        subtitle={t("clients:clientsHint", {defaultValue: "Every business running on Octopos, with what they pay and how they are doing."})}
      >
        <Can subject={user} capability="client.write">
          <Button className="max-w-fit" size="sm" color="brand" asChild>
            <Link to="/flows/new-client">{t("clients:newClient", {defaultValue: "New client"})}</Link>
          </Button>
        </Can>
        <ExportButton name="clients" load={() => listClients({query: {...search, page: 1, pageSize: 1000}}).then((page) => page.items)} columns={CLIENT_COLUMNS} />
        <SaveViewButton path="/clients" search={search} />
      </PageHeader>
      <div className="flex flex-col gap-3">
        <Input
          size="lg"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("clients:searchPlaceholder", {defaultValue: "Name, owner or phone"})}
          startAdornment={<Search size={18} className="text-on-surface-secondary" />}
        />
        <div className="flex flex-wrap gap-2">
          <FilterSelect
            label={t("clients:anyStatus", {defaultValue: "Any status"})}
            value={search.status}
            onChange={set("status")}
            options={(["active", "onboarding", "suspended", "churned"] as ClientStatus[]).map((value) => ({value, label: clientStatusLabel(t, value)}))}
          />
          <FilterSelect
            label={t("billing:anySubscription", {defaultValue: "Any subscription"})}
            value={search.subscriptionStatus}
            onChange={set("subscriptionStatus")}
            options={(["active", "trialing", "pastDue", "scheduledCancel", "expired"] as SubscriptionStatus[]).map((value) => ({value, label: subscriptionStatusLabel(t, value)}))}
          />
          <FilterSelect
            label={t("billing:anyPlan", {defaultValue: "Any plan"})}
            value={search.plan}
            onChange={set("plan")}
            options={[
              {value: "starter", label: "Starter"},
              {value: "growth", label: "Growth"},
              {value: "scale", label: "Scale"},
            ]}
          />
          <FilterSelect
            label={t("clients:anyHealth", {defaultValue: "Any health"})}
            value={search.health}
            onChange={set("health")}
            options={[
              {value: "good", label: t("clients:health.good", {defaultValue: "Healthy"})},
              {value: "watch", label: t("clients:health.watch", {defaultValue: "Watch"})},
              {value: "atRisk", label: t("clients:health.atRisk", {defaultValue: "At risk"})},
            ]}
          />
          <FilterSelect
            label={t("clients:sortName", {defaultValue: "Sort: name"})}
            value={search.sort}
            onChange={set("sort")}
            options={[
              {value: "health", label: t("clients:sortHealth", {defaultValue: "Sort: lowest health"})},
              {value: "mrr", label: t("clients:sortMrr", {defaultValue: "Sort: highest MRR"})},
              {value: "renewal", label: t("clients:sortRenewal", {defaultValue: "Sort: next renewal"})},
              {value: "createdAt", label: t("clients:sortNewest", {defaultValue: "Sort: newest"})},
            ]}
          />
          <label className="bg-surface-300 flex items-center gap-2 rounded-full px-3 text-sm">
            <input
              type="checkbox"
              checked={Boolean(search.onboarding)}
              onChange={(e) => navigate({search: (prev) => ({...prev, onboarding: e.target.checked || undefined, page: undefined})})}
              className="accent-accent"
            />
            {t("clients:onboardingFilter", {defaultValue: "Still onboarding"})}
          </label>
          {filtered ? (
            <Button
              size="sm"
              color="neutral"
              variant="ghost"
              onClick={() => {
                setQ("");
                navigate({search: {}});
              }}
            >
              {t("common:clearFilters", {defaultValue: "Clear"})}
            </Button>
          ) : null}
        </div>
      </div>
      <Suspense fallback={<ListSkeleton rows={8} />}>
        <ClientList search={search} />
      </Suspense>
    </div>
  );
}

let CLIENT_COLUMNS: Column<Client>[] = [
  {header: "Name", value: (c) => c.name},
  {header: "Status", value: (c) => c.status},
  {header: "City", value: (c) => c.city},
  {header: "Owner", value: (c) => c.owner.name},
  {header: "Phone", value: (c) => c.owner.phone},
  {header: "Plan", value: (c) => c.subscription?.plan.name},
  {header: "Cycle", value: (c) => c.subscription?.billingCycle},
  {header: "Subscription", value: (c) => c.subscription?.status},
  {header: "Renews", value: (c) => c.subscription?.periodEnd.slice(0, 10)},
  {header: "MRR (UZS)", value: (c) => c.mrr.majorAmount},
  {header: "Balance due (UZS)", value: (c) => c.balanceDue.majorAmount},
  {header: "Health", value: (c) => c.health.score},
  {header: "Installations", value: (c) => c.installations.total},
  {header: "Account manager", value: (c) => c.accountManager?.name},
  {header: "Tags", value: (c) => c.tags.join("; ")},
  {header: "Client since", value: (c) => c.createdAt.slice(0, 10)},
];

function ClientList({search}: {search: Search}) {
  let {t} = useTranslation();
  let {user} = Route.useRouteContext();
  let {data} = useSuspenseQuery(listClientsOptions({query: {...search, pageSize: 25}}));
  let [selected, setSelected] = useState<Set<string>>(new Set());
  let selectable = can(user, "client.write") || can(user, "task.write");

  if (!data.items.length) {
    return <EmptyState icon={Users} title={t("clients:noClients", {defaultValue: "No clients match"})} description={t("clients:noClientsHint", {defaultValue: "Try a different filter or search."})} />;
  }

  let allOnPage = data.items.every((c) => selected.has(c.id));
  let toggle = (id: string) =>
    setSelected((prev) => {
      let next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="flex flex-col gap-6">
      <div className="text-on-surface-secondary hidden items-center gap-3 px-2 text-xs font-medium lg:flex">
        {selectable ? (
          <input
            type="checkbox"
            aria-label={t("common:selectAll", {defaultValue: "Select all on this page"})}
            className="accent-accent size-4"
            checked={allOnPage}
            onChange={() => setSelected((prev) => (allOnPage ? new Set([...prev].filter((id) => !data.items.some((c) => c.id === id))) : new Set([...prev, ...data.items.map((c) => c.id)])))}
          />
        ) : null}
        <div className="grid flex-1 grid-cols-[minmax(0,2.2fr)_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_3rem] gap-4">
          <span>{t("clients:client", {defaultValue: "Client"})}</span>
          <span>{t("billing:subscription", {defaultValue: "Subscription"})}</span>
          <span className="text-right">{t("billing:mrr", {defaultValue: "MRR"})}</span>
          <span>{t("billing:renews", {defaultValue: "Renews"})}</span>
          <span>{t("fleet:installations", {defaultValue: "Installations"})}</span>
          <span className="text-right">{t("clients:healthShort", {defaultValue: "Health"})}</span>
        </div>
      </div>
      <ul className="flex flex-col gap-1">
        {data.items.map((client) => (
          <li key={client.id} className="flex items-center gap-3">
            {selectable ? (
              <input
                type="checkbox"
                aria-label={t("common:select", {defaultValue: "Select {{name}}", name: client.name})}
                className="accent-accent ml-2 size-4 shrink-0"
                checked={selected.has(client.id)}
                onChange={() => toggle(client.id)}
              />
            ) : null}
            <ClientRow client={client} />
          </li>
        ))}
      </ul>
      {data.pages > 1 ? <Pagination page={data.page} pages={data.pages} hasNext={data.page < data.pages} hasPrevious={data.page > 1} from="/clients/" /> : null}
      <p className="text-on-surface-secondary text-center text-xs">{t("clients:totalClients", {defaultValue: "{{count}} clients", count: data.total})}</p>
      {selected.size ? <BulkBar ids={[...selected]} onDone={() => setSelected(new Set())} /> : null}
    </div>
  );
}

/**
 * What can be done to many clients at once. Sticky at the bottom while anything is selected, the
 * way a mail client's toolbar appears over a selection.
 */
function BulkBar({ids, onDone}: {ids: string[]; onDone: () => void}) {
  let {t} = useTranslation();
  let {user} = Route.useRouteContext();
  let {data: team} = useQuery(listOperatorsOptions());
  let bulkUpdate = bulkUpdateClientsMutation();
  let bulkTasks = bulkCreateTasksMutation();
  let operators = team?.operators.filter((o) => o.status === "active") ?? [];
  let done = (result: BulkResult) => {
    onDone();
    return result;
  };
  return (
    <div className="bg-surface-200 border-border-secondary sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] z-10 flex flex-wrap items-center gap-2 rounded-2xl border p-3 shadow-lg sm:bottom-4">
      <span className="px-2 text-sm font-medium">{t("common:nSelected", {defaultValue: "{{count}} selected", count: ids.length})}</span>
      {can(user, "client.write") ? (
        <>
          <FormDialog
            trigger={
              <Button size="sm" color="neutral">
                {t("clients:assignManager", {defaultValue: "Assign manager"})}
              </Button>
            }
            title={t("clients:assignManagerTitle", {defaultValue: "Assign {{count}} clients", count: ids.length})}
            action={t("common:assign", {defaultValue: "Assign"})}
            success={t("clients:managersAssigned", {defaultValue: "Account manager updated"})}
            onSubmit={(form) => bulkUpdate.mutationFn({body: {ids, accountManagerID: (form.get("manager") as string) || null}}).then(done)}
          >
            <FormField label={t("clients:accountManager", {defaultValue: "Account manager"})} htmlFor="manager">
              <Select id="manager" name="manager" defaultValue="">
                <option value="">{t("common:nobody", {defaultValue: "Nobody"})}</option>
                {operators.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.firstName} {o.lastName}
                  </option>
                ))}
              </Select>
            </FormField>
          </FormDialog>
          <FormDialog
            trigger={
              <Button size="sm" color="neutral">
                {t("clients:tags", {defaultValue: "Tags"})}
              </Button>
            }
            title={t("clients:tagClients", {defaultValue: "Tag {{count}} clients", count: ids.length})}
            action={t("common:apply", {defaultValue: "Apply"})}
            success={t("clients:tagsUpdated", {defaultValue: "Tags updated"})}
            onSubmit={(form) => {
              let list = (key: string) =>
                String(form.get(key) ?? "")
                  .split(",")
                  .map((tag) => tag.trim())
                  .filter(Boolean);
              return bulkUpdate.mutationFn({body: {ids, addTags: list("add"), removeTags: list("remove")}}).then(done);
            }}
          >
            <FormField label={t("clients:addTags", {defaultValue: "Add tags"})} htmlFor="add" hint={t("clients:commaSeparated", {defaultValue: "Comma separated"})}>
              <Input id="add" name="add" placeholder="key account, referral" />
            </FormField>
            <FormField label={t("clients:removeTags", {defaultValue: "Remove tags"})} htmlFor="remove">
              <Input id="remove" name="remove" />
            </FormField>
          </FormDialog>
        </>
      ) : null}
      {can(user, "task.write") ? (
        <FormDialog
          trigger={
            <Button size="sm" color="neutral">
              {t("clients:taskForEach", {defaultValue: "Task for each"})}
            </Button>
          }
          title={t("clients:taskForEachTitle", {defaultValue: "Create a task for each of {{count}} clients", count: ids.length})}
          description={t("clients:taskForEachHint", {defaultValue: "{{client}} in the title becomes each client's name. Leave the assignee empty to give each task to that client's account manager."})}
          action={t("common:createTasks", {defaultValue: "Create tasks"})}
          success={t("clients:tasksCreated", {defaultValue: "Tasks created"})}
          onSubmit={(form) =>
            bulkTasks
              .mutationFn({
                body: {
                  clientIDs: ids,
                  title: String(form.get("title")),
                  kind: form.get("kind") as TaskKind,
                  priority: form.get("priority") as TaskPriority,
                  assigneeID: (form.get("assigneeID") as string) || undefined,
                  dueAt: form.get("dueAt") ? new Date(`${form.get("dueAt")}T18:00:00`).toISOString() : undefined,
                },
              })
              .then(done)
          }
        >
          <FormField label={t("common:title", {defaultValue: "Title"})} htmlFor="title">
            <Input id="title" name="title" required defaultValue={"Check in with {{client}}"} />
          </FormField>
          <TaskFields operators={operators} />
        </FormDialog>
      ) : null}
      <ExportButton name="clients-selected" load={() => listClients({query: {pageSize: 1000}}).then((page) => page.items.filter((c) => ids.includes(c.id)))} columns={CLIENT_COLUMNS} />
      <Button size="sm" color="neutral" variant="ghost" className="ml-auto" onClick={onDone}>
        {t("common:clearSelection", {defaultValue: "Clear"})}
      </Button>
    </div>
  );
}

function ClientRow({client}: {client: Client}) {
  let {t} = useTranslation();
  let sub = client.subscription;
  let renewSoon = sub ? daysUntil(sub.periodEnd) <= 3 : false;
  let pastDue = sub?.status === "pastDue";
  return (
    <>
      <Link
        to="/clients/$id"
        params={{id: client.id}}
        className="hover:bg-surface-300 grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 rounded-xl px-2 py-3 lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_3rem]"
      >
        <span className="flex min-w-0 flex-col">
          <span className="flex items-center gap-2">
            <span className="truncate font-medium">{client.name}</span>
            {client.status !== "active" ? (
              <StatusText color={clientStatusColor(client.status)} className="text-on-surface-secondary shrink-0 text-xs">
                {clientStatusLabel(t, client.status)}
              </StatusText>
            ) : null}
          </span>
          <span className="text-on-surface-secondary truncate text-sm">
            {client.owner.name} · {client.city ?? client.slug}
          </span>
          {client.onboarding ? <OnboardingProgress onboarding={client.onboarding} className="mt-1" /> : null}
        </span>
        <span className="row-span-2 lg:hidden">
          <HealthBadge health={client.health} />
        </span>
        <span className="flex min-w-0 flex-col text-sm">
          <StatusText color={subscriptionStatusColor(sub?.status)}>
            {sub?.plan.name ?? "—"} · {subscriptionStatusLabel(t, sub?.status)}
          </StatusText>
        </span>
        <span className="hidden text-right tabular-nums lg:block">{client.mrr.majorAmount ? client.mrr.display : "—"}</span>
        <span className={cn("hidden text-sm lg:block", pastDue ? "text-error-bright" : renewSoon ? "text-on-surface-yellow" : "text-on-surface-secondary")}>
          {sub ? (pastDue ? t("billing:overdueSince", {defaultValue: "Overdue {{when}}", when: formatDue(sub.periodEnd)}) : formatDue(sub.periodEnd)) : "—"}
        </span>
        <span className="hidden text-sm lg:block">
          {client.installations.total ? (
            <StatusText color={client.installations.failing ? "red" : client.installations.degraded || client.installations.offline ? "yellow" : "green"}>
              {client.installations.healthy}/{client.installations.total} {t("fleet:healthyShort", {defaultValue: "healthy"})}
            </StatusText>
          ) : (
            <span className="text-on-surface-secondary">{t("fleet:noneYet", {defaultValue: "None yet"})}</span>
          )}
        </span>
        <span className="hidden justify-end lg:flex">
          <HealthBadge health={client.health} />
        </span>
      </Link>
    </>
  );
}
