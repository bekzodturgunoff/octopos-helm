import {Suspense} from "react";
import {useQuery, useSuspenseQuery} from "@tanstack/react-query";
import {createFileRoute, Link, redirect} from "@tanstack/react-router";
import {Button, Select, Tag} from "@yeahuz/kdsx-react";
import {useTranslation} from "react-i18next";
import {getClientOptions, getOperatorFleetNodesOptions, listReleasesOptions, retireOperatorFleetNodeMutation, setOperatorFleetNodeTargetMutation, type FleetNode} from "@/api";
import {DetailPageSkeleton} from "@/components/skeletons";
import {Field, Fields, Section} from "@/components/field";
import {FormDialog, FormField} from "@/components/form-dialog";
import {fleetHealth, fleetHealthColor, fleetHealthHint, fleetNodeLabel, healthWord} from "@/lib/fleet";
import {formatAnydesk, formatDateTime} from "@/lib/format";
import {useConnect} from "@/components/remote-access";
import {can} from "@/permission";

export let Route = createFileRoute("/_auth/fleet/$id")({
  beforeLoad: ({context}) => {
    if (!can(context.user, "fleet.read")) throw redirect({to: "/403"});
    return {backLink: {to: "/fleet"}};
  },
  loader: ({context}) => {
    context.queryClient.prefetchQuery(getOperatorFleetNodesOptions());
  },
  component: () => (
    <Suspense fallback={<DetailPageSkeleton sections={3} />}>
      <FleetNodeContent />
    </Suspense>
  ),
});

// The dash's installation page, seen from the hub: the same two heartbeats and the same diagnosis,
// plus whose installation it is and the controls only the operator holds.
function FleetNodeContent() {
  let params = Route.useParams();
  let {t} = useTranslation();
  let {user} = Route.useRouteContext();
  let {data} = useSuspenseQuery({...getOperatorFleetNodesOptions(), refetchInterval: 30_000});
  let node = data.nodes.find((value) => value.nodeID === params.id);

  if (!node) {
    return (
      <div className="flex flex-col gap-4 px-4">
        <h1 className="text-3xl font-semibold tracking-tight">{t("fleet:nodeMissing", {defaultValue: "Installation not found"})}</h1>
        <p className="text-on-surface-secondary text-sm">{t("fleet:nodeMissingHint", {defaultValue: "It may have been replaced by a seed, which gives an installation a new identity."})}</p>
      </div>
    );
  }

  let health = fleetHealth(node);
  let dateTime = (value: string | undefined) => (value ? formatDateTime(value) : t("fleet:never", {defaultValue: "Never"}));
  let writes = can(user, "fleet.write") && !node.retiredAt;

  return (
    <div className="flex flex-col gap-10 px-4">
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{fleetNodeLabel(node)}</h1>
          <Link to="/clients/$id" params={{id: node.tenantID}} search={{tab: "installations"}} className="text-on-surface-secondary mt-1 inline-block text-sm hover:underline">
            {node.tenantName}
          </Link>
          <p className="text-on-surface-secondary text-xs break-all">{node.nodeID}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Tag color={fleetHealthColor(health)}>{healthWord(t, health)}</Tag>
          {node.updatePaused ? <Tag color="yellow">{t("fleet:updatesPaused", {defaultValue: "Updates paused"})}</Tag> : null}
          {!node.supervised ? <Tag color="neutral">{t("fleet:unsupervised", {defaultValue: "No agent"})}</Tag> : null}
        </div>
        <p className="text-on-surface-secondary max-w-prose text-sm">{fleetHealthHint(health)}</p>
        <div className="flex flex-wrap gap-2">
          {can(user, "client.read") ? <ConnectButton tenantID={node.tenantID} nodeID={node.nodeID} /> : null}
          {writes ? (
            <>
              <TargetDialog node={node} />
              <RetireDialog node={node} />
            </>
          ) : null}
        </div>
      </div>

      <Section title={t("fleet:installation", {defaultValue: "Installation"})}>
        <Fields>
          <Field label={t("fleet:runningVersion", {defaultValue: "Running version"})} value={node.runningVersion || "—"} />
          <Field label={t("fleet:targetVersion", {defaultValue: "Target version"})} value={node.targetVersion || t("fleet:noTarget", {defaultValue: "Follows the default"})} />
          <Field label={t("fleet:schemaVersion", {defaultValue: "Schema version"})} value={node.schemaVersion} />
          <Field
            label={t("common:location", {defaultValue: "Location"})}
            value={
              node.location ? (
                <span className="flex flex-col">
                  <span>{node.location.name}</span>
                  {!node.location.explicit ? <span className="text-on-surface-secondary text-xs">{t("fleet:locationDerived", {defaultValue: "Derived from its devices"})}</span> : null}
                </span>
              ) : (
                t("fleet:locationUnknown", {defaultValue: "Not determined"})
              )
            }
          />
          <Field label={t("fleet:platform", {defaultValue: "Platform"})} value={[node.os, node.arch].filter(Boolean).join(" / ") || "—"} />
          <Field label={t("fleet:startedAt", {defaultValue: "Started"})} value={dateTime(node.startedAt)} />
          {node.runningCommit ? <Field label={t("fleet:commit", {defaultValue: "Commit"})} value={node.runningCommit} /> : null}
          {node.retiredAt ? <Field label={t("fleet:retiredAt", {defaultValue: "Retired"})} value={dateTime(node.retiredAt)} /> : null}
        </Fields>
      </Section>

      {/* The two heartbeats, kept apart on purpose, as in the dash: which one went quiet is the diagnosis. */}
      <Section title={t("fleet:sync", {defaultValue: "Synchronization"})}>
        <Fields>
          <Field label={t("fleet:lastExchangeAt", {defaultValue: "Last exchange"})} value={dateTime(node.lastExchangeAt)} />
          <Field label={t("fleet:pendingUploads", {defaultValue: "Pending uploads"})} value={node.pendingUploads} />
          <Field label={t("fleet:unresolvedConflicts", {defaultValue: "Unresolved conflicts"})} value={node.unresolvedConflicts} />
          {node.behindBy !== undefined ? <Field label={t("fleet:behindBy", {defaultValue: "Events never received"})} value={node.behindBy} /> : null}
          {node.parkedOutstanding !== undefined ? <Field label={t("fleet:parked", {defaultValue: "Parked, waiting on a dependency"})} value={node.parkedOutstanding} /> : null}
          {node.oldestParkedAt ? <Field label={t("fleet:oldestParked", {defaultValue: "Oldest parked"})} value={dateTime(node.oldestParkedAt)} /> : null}
        </Fields>
      </Section>

      <Section title={t("fleet:supervisor", {defaultValue: "Supervisor"})}>
        {node.supervised ? (
          <Fields>
            <Field label={t("fleet:agentVersion", {defaultValue: "Agent version"})} value={node.agentVersion || "—"} />
            <Field label={t("fleet:childState", {defaultValue: "Process"})} value={node.childState || "—"} />
            <Field label={t("fleet:lastCheckin", {defaultValue: "Last check-in"})} value={dateTime(node.lastCheckinAt)} />
            <Field label={t("fleet:restartCount", {defaultValue: "Restarts"})} value={node.restartCount ?? 0} />
            {node.lastExitCode !== undefined ? (
              <Field
                label={t("fleet:lastExitCode", {defaultValue: "Last exit code"})}
                value={node.lastExitCode === 78 ? t("fleet:exitConfig", {defaultValue: "78 — configuration"}) : node.lastExitCode}
              />
            ) : null}
            {node.updateState ? <Field label={t("fleet:updateState", {defaultValue: "Update"})} value={node.updateState} /> : null}
            {node.lastUpdateError ? <Field wide label={t("fleet:updateError", {defaultValue: "Update error"})} value={node.lastUpdateError} /> : null}
          </Fields>
        ) : (
          <span className="text-on-surface-secondary text-sm">{t("fleet:noAgent", {defaultValue: "This installation predates the supervisor and cannot be updated remotely."})}</span>
        )}
        {node.lastStderrTail ? <pre className="bg-neutral text-on-surface-secondary max-h-64 overflow-auto rounded-lg p-3 text-xs whitespace-pre-wrap">{node.lastStderrTail}</pre> : null}
      </Section>

      <Section title={t("fleet:network", {defaultValue: "On its own network"})}>
        {node.lanURLs?.length || node.lanName ? (
          <Fields>
            {node.lanName ? <Field wide label={t("fleet:lanName", {defaultValue: "Local name"})} value={node.lanName} /> : null}
            {node.lanURLs?.length ? (
              <Field
                wide
                label={t("fleet:lanURLs", {defaultValue: "Addresses"})}
                value={
                  <span className="flex flex-col">
                    {node.lanURLs.map((url) => (
                      <span key={url}>{url}</span>
                    ))}
                  </span>
                }
              />
            ) : null}
          </Fields>
        ) : (
          <span className="text-on-surface-secondary text-sm">{t("fleet:noLanURLs", {defaultValue: "This installation reported no routable address of its own."})}</span>
        )}
      </Section>
    </div>
  );
}

/** The till's own AnyDesk, when one is saved against this installation — the shortest way to the error. */
function ConnectButton({tenantID, nodeID}: {tenantID: string; nodeID: string}) {
  let {t} = useTranslation();
  let connect = useConnect();
  let {data: client} = useQuery(getClientOptions({query: {id: tenantID}}));
  let entry = client?.remoteAccess.find((r) => r.nodeID === nodeID);
  if (!client) return null;
  if (!entry) {
    return (
      <Button size="sm" color="neutral" variant="outline" asChild>
        <Link to="/clients/$id" params={{id: tenantID}}>
          {t("fleet:noAnydesk", {defaultValue: "No AnyDesk saved · add one"})}
        </Link>
      </Button>
    );
  }
  return (
    <Button size="sm" color="brand" onClick={() => connect(entry)}>
      {t("fleet:connectAnydesk", {defaultValue: "Connect with AnyDesk · {{id}}", id: formatAnydesk(entry.anydeskID)})}
    </Button>
  );
}

function TargetDialog({node}: {node: FleetNode}) {
  let {t} = useTranslation();
  let {data} = useQuery(listReleasesOptions());
  let {mutationFn} = setOperatorFleetNodeTargetMutation();
  return (
    <FormDialog
      trigger={
        <Button size="sm" color="brand" variant="outline">
          {t("fleet:updateSettings", {defaultValue: "Version and updates"})}
        </Button>
      }
      title={t("fleet:updateSettings", {defaultValue: "Version and updates"})}
      description={t("fleet:updateSettingsHint", {
        defaultValue: "Pin this installation to a release, or let it follow the default. Pausing stops it updating at all — for a client mid-service or under investigation.",
      })}
      action={t("common:save", {defaultValue: "Save"})}
      success={t("fleet:targetSaved", {defaultValue: "Update settings saved"})}
      onSubmit={(form) =>
        mutationFn({
          body: {nodeID: node.nodeID, targetVersion: (form.get("targetVersion") as string) || undefined, updatePaused: form.get("updatePaused") === "on"},
        })
      }
    >
      <FormField label={t("fleet:targetVersion", {defaultValue: "Target version"})} htmlFor="targetVersion">
        <Select id="targetVersion" name="targetVersion" defaultValue={node.targetVersion ?? ""}>
          <option value="">{t("fleet:followDefault", {defaultValue: "Follow the default release"})}</option>
          {data?.releases.map((release) => (
            <option key={release.version} value={release.version}>
              {release.version} {release.channel === "beta" ? "(beta)" : ""} {release.isDefault ? `· ${t("fleet:default", {defaultValue: "default"})}` : ""}
            </option>
          ))}
        </Select>
      </FormField>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="updatePaused" defaultChecked={node.updatePaused} className="accent-accent" />
        {t("fleet:pauseUpdates", {defaultValue: "Pause updates on this installation"})}
      </label>
    </FormDialog>
  );
}

function RetireDialog({node}: {node: FleetNode}) {
  let {t} = useTranslation();
  let {mutationFn} = retireOperatorFleetNodeMutation();
  return (
    <FormDialog
      danger
      trigger={
        <Button size="sm" color="danger" variant="ghost">
          {t("fleet:retire", {defaultValue: "Retire"})}
        </Button>
      }
      title={t("fleet:retireTitle", {defaultValue: "Retire {{name}} for good?", name: fleetNodeLabel(node)})}
      description={t("fleet:retireHint", {
        defaultValue:
          "For an installation that will never exchange again: an abandoned training laptop, a replaced till. The hub refuses its exchanges from now on and no reset waits for it. This cannot be undone — the device can only come back by re-enrolling from a seed.",
      })}
      action={t("fleet:retire", {defaultValue: "Retire"})}
      success={t("fleet:retired", {defaultValue: "Installation retired"})}
      onSubmit={() => mutationFn({body: {tenantID: node.tenantID, nodeID: node.nodeID}})}
    />
  );
}
