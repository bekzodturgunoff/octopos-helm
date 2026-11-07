import {Suspense} from "react";
import {useSuspenseQuery} from "@tanstack/react-query";
import {createFileRoute, Link, redirect} from "@tanstack/react-router";
import {Button, Tag} from "@yeahuz/kdsx-react";
import {useTranslation} from "react-i18next";
import {listReleasesOptions, setDefaultReleaseMutation, getOperatorFleetNodesOptions, type Release} from "@/api";
import {PageHeader} from "@/components/page-header";
import {FormDialog} from "@/components/form-dialog";
import {ListSkeleton} from "@/components/skeletons";
import {formatDate} from "@/lib/format";
import {can} from "@/permission";

export let Route = createFileRoute("/_auth/fleet/releases")({
  beforeLoad: ({context}) => {
    if (!can(context.user, "fleet.read")) throw redirect({to: "/403"});
    return {backLink: {to: "/fleet"}};
  },
  component: Releases,
});

function Releases() {
  let {t} = useTranslation();
  return (
    <div className="flex flex-col gap-8 px-4">
      <PageHeader
        title={t("fleet:releases", {defaultValue: "Releases"})}
        subtitle={t("fleet:releasesHint", {
          defaultValue: "The default is what every installation without a pinned target moves to. Agents update one at a time and roll back on a failed health check.",
        })}
      />
      <Suspense fallback={<ListSkeleton rows={5} />}>
        <ReleaseList />
      </Suspense>
    </div>
  );
}

function ReleaseList() {
  let {t} = useTranslation();
  let {user} = Route.useRouteContext();
  let {data} = useSuspenseQuery(listReleasesOptions());
  let {data: fleet} = useSuspenseQuery(getOperatorFleetNodesOptions());
  let live = fleet.nodes.filter((n) => !n.retiredAt).length || 1;

  return (
    <ul className="flex flex-col gap-3">
      {data.releases.map((release) => (
        <li key={release.version} className="bg-surface-300 flex flex-col gap-3 rounded-xl p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold tabular-nums">{release.version}</span>
              {release.isDefault ? <Tag color="green">{t("fleet:default", {defaultValue: "Default"})}</Tag> : null}
              {release.channel === "beta" ? <Tag color="blue">Beta</Tag> : null}
            </div>
            <span className="text-on-surface-secondary text-sm">{formatDate(release.releasedAt)}</span>
          </div>
          <p className="text-on-surface-secondary text-sm">{release.notes}</p>
          {/* Adoption as a bar: how much of the fleet runs it, and how much more is on its way. */}
          <div className="flex flex-col gap-1.5">
            <div className="bg-surface-500 flex h-2 overflow-hidden rounded-full">
              <div className="bg-accent h-full" style={{width: `${(release.running / live) * 100}%`}} />
              <div className="bg-accent/35 h-full" style={{width: `${(Math.max(0, release.targeted - release.running) / live) * 100}%`}} />
            </div>
            <div className="text-on-surface-secondary flex flex-wrap justify-between gap-2 text-xs">
              <Link to="/fleet" search={{view: "all", version: release.version}} className="hover:underline">
                {t("fleet:runningCount", {defaultValue: "{{count}} running", count: release.running})}
              </Link>
              <span>{t("fleet:targetedCount", {defaultValue: "{{count}} targeted", count: release.targeted})}</span>
            </div>
          </div>
          {!release.isDefault && release.channel === "stable" && can(user, "fleet.write") ? <MakeDefault release={release} /> : null}
        </li>
      ))}
    </ul>
  );
}

function MakeDefault({release}: {release: Release}) {
  let {t} = useTranslation();
  let {mutationFn} = setDefaultReleaseMutation();
  return (
    <FormDialog
      trigger={
        <Button size="sm" color="neutral" className="max-w-fit">
          {t("fleet:makeDefault", {defaultValue: "Make default"})}
        </Button>
      }
      title={t("fleet:makeDefaultTitle", {defaultValue: "Roll out {{version}}?", version: release.version})}
      description={t("fleet:makeDefaultHint", {
        defaultValue: "Every installation following the default starts moving to it at its next check-in. Pinned and paused installations stay where they are.",
      })}
      action={t("fleet:rollOut", {defaultValue: "Roll out"})}
      success={t("fleet:rolledOut", {defaultValue: "{{version}} is now the default", version: release.version})}
      onSubmit={() => mutationFn({body: {version: release.version}})}
    />
  );
}
