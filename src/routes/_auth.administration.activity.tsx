import {Suspense} from "react";
import {useSuspenseQuery} from "@tanstack/react-query";
import {createFileRoute, redirect} from "@tanstack/react-router";
import {History} from "lucide-react";
import {useTranslation} from "react-i18next";
import {listActivity, listActivityOptions, listOperatorsOptions, verifyActivityOptions, type ActivityCategory, type ActivityEvent} from "@/api";
import {useQuery} from "@tanstack/react-query";
import {ShieldCheck} from "lucide-react";
import {ExportButton} from "@/components/export-button";
import {PageHeader} from "@/components/page-header";
import {FilterSelect} from "@/components/filter-bar";
import {ActivityFilter, ActivityList} from "@/components/activity-list";
import {EmptyState} from "@/components/empty-state";
import {ListSkeleton} from "@/components/skeletons";
import {Pagination} from "@/components/pagination";
import {can} from "@/permission";

type Search = {actorID?: string; category?: ActivityCategory; page?: number};

export let Route = createFileRoute("/_auth/administration/activity")({
  beforeLoad: ({context}) => {
    if (!can(context.user, "audit.read")) throw redirect({to: "/403"});
    return {backLink: {to: "/administration"}};
  },
  validateSearch: (search: Record<string, unknown>): Search => ({
    actorID: (search.actorID as string) || undefined,
    category: (search.category as ActivityCategory) || undefined,
    page: Number(search.page) || undefined,
  }),
  component: Activity,
});

function Activity() {
  let {t} = useTranslation();
  let search = Route.useSearch();
  let navigate = Route.useNavigate();
  return (
    <div className="flex flex-col gap-8 px-4">
      <PageHeader
        title={t("team:activity", {defaultValue: "Activity log"})}
        subtitle={t("team:activityHint", {defaultValue: "Append-only. Every suspension, refund, plan change and support session is here with who did it."})}
      >
        <ExportButton
          name="activity"
          load={() => listActivity({query: {actorID: search.actorID, category: search.category, page: 1, pageSize: 1000}}).then((page) => page.items)}
          columns={[
            {header: "When", value: (e: ActivityEvent) => e.createdAt},
            {header: "Who", value: (e: ActivityEvent) => e.actor.name},
            {header: "Kind", value: (e: ActivityEvent) => e.actor.kind},
            {header: "Action", value: (e: ActivityEvent) => e.action},
            {header: "Client", value: (e: ActivityEvent) => e.clientName},
            {header: "Summary", value: (e: ActivityEvent) => e.summary},
          ]}
        />
      </PageHeader>
      <Suspense fallback={null}>
        <ActorFilter value={search.actorID} onChange={(actorID) => navigate({search: (prev) => ({...prev, actorID, page: undefined})})} />
      </Suspense>
      <Integrity />
      <ActivityFilter withTeam value={search.category} onChange={(category) => navigate({search: (prev) => ({...prev, category, page: undefined})})} />
      <Suspense fallback={<ListSkeleton rows={10} />}>
        <Events search={search} />
      </Suspense>
    </div>
  );
}

function ActorFilter({value, onChange}: {value?: string; onChange: (value: string | undefined) => void}) {
  let {t} = useTranslation();
  let {data} = useSuspenseQuery(listOperatorsOptions());
  return (
    <div className="flex">
      <FilterSelect label={t("team:anyone", {defaultValue: "Anyone"})} value={value} onChange={onChange} options={data.operators.map((o) => ({value: o.id, label: `${o.firstName} ${o.lastName}`}))} />
    </div>
  );
}

function Events({search}: {search: Search}) {
  let {t} = useTranslation();
  let {data} = useSuspenseQuery(listActivityOptions({query: {...search, pageSize: 30}}));
  if (!data.items.length) return <EmptyState icon={History} title={t("common:noActivity", {defaultValue: "Nothing has happened yet"})} />;
  return (
    <div className="flex flex-col gap-6">
      <ActivityList events={data.items} />
      {data.pages > 1 ? <Pagination page={data.page} pages={data.pages} hasNext={data.page < data.pages} hasPrevious={data.page > 1} from="/administration/activity" /> : null}
    </div>
  );
}

/** The chain check, run when the page opens: an edited or deleted entry would break it from there on. */
function Integrity() {
  let {t} = useTranslation();
  let {data, isFetching, refetch} = useQuery({...verifyActivityOptions(), staleTime: 0});
  if (!data) return <span className="text-on-surface-secondary text-sm">{t("team:verifying", {defaultValue: "Checking the log…"})}</span>;
  return (
    <div className={`flex flex-wrap items-center gap-3 rounded-xl px-4 py-3 text-sm ${data.verified ? "bg-bright-green/10" : "bg-error-low text-on-error-low"}`}>
      <ShieldCheck size={16} className={data.verified ? "text-on-surface-green" : ""} />
      <span>
        {data.verified
          ? t("team:chainOk", {defaultValue: "Log intact — {{count}} entries, each chained to the one before. Nobody, owners included, can edit or delete an entry.", count: data.events})
          : t("team:chainBroken", {defaultValue: "The chain breaks at {{at}} — an entry was changed or removed.", at: data.brokenAt})}
      </span>
      <code className="text-on-surface-secondary text-xs">{data.headHash.slice(0, 12)}…</code>
      <button type="button" className="text-on-surface-accent ml-auto text-xs hover:underline" onClick={() => refetch()} disabled={isFetching}>
        {isFetching ? t("team:checking", {defaultValue: "Checking…"}) : t("team:checkAgain", {defaultValue: "Check again"})}
      </button>
    </div>
  );
}
