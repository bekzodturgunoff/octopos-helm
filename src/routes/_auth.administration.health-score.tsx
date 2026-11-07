import {Suspense, useEffect, useState} from "react";
import {useMutation, useQueryClient, useSuspenseQuery} from "@tanstack/react-query";
import {createFileRoute, Link, redirect} from "@tanstack/react-router";
import {Button, ErrorAlert, Input, Label} from "@yeahuz/kdsx-react";
import {useTranslation} from "react-i18next";
import {getHealthSettingsOptions, previewHealthSettingsMutation, updateHealthSettingsMutation, type HealthFactor, type HealthPreview, type HealthSettings} from "@/api";
import {PageHeader} from "@/components/page-header";
import {Section} from "@/components/field";
import {FormPageSkeleton} from "@/components/skeletons";
import {StatusText} from "@/components/status-text";
import {useToast} from "@/components/toaster";
import {useDebounced} from "@/hooks";
import {healthColor, healthLabel} from "@/lib/status";
import {formatDateTime} from "@/lib/format";
import {can} from "@/permission";

export let Route = createFileRoute("/_auth/administration/health-score")({
  beforeLoad: ({context}) => {
    if (!can(context.user, "client.read")) throw redirect({to: "/403"});
    return {backLink: {to: "/administration"}};
  },
  component: () => (
    <Suspense fallback={<FormPageSkeleton rows={6} />}>
      <HealthTuning />
    </Suspense>
  ),
});

let FACTORS: {key: HealthFactor; label: string; hint: string}[] = [
  {key: "payment", label: "Payments", hint: "Paid on time, nothing owed, not suspended"},
  {key: "activity", label: "Activity", hint: "Orders this week against two weeks ago"},
  {key: "fleet", label: "Installations", hint: "Share of their tills that are healthy"},
];

/** Moving one weight takes the difference from the other two, so the three always add up to 100. */
function rebalance(weights: Record<HealthFactor, number>, key: HealthFactor, value: number) {
  let next = {...weights, [key]: value};
  let others = FACTORS.map((f) => f.key).filter((k) => k !== key);
  let rest = 100 - value;
  let currentRest = others.reduce((sum, k) => sum + weights[k], 0) || 1;
  let first = Math.round((weights[others[0]] / currentRest) * rest);
  next[others[0]] = first;
  next[others[1]] = rest - first;
  return next;
}

function HealthTuning() {
  let {t} = useTranslation();
  let {user} = Route.useRouteContext();
  let toast = useToast();
  let queryClient = useQueryClient();
  let {data} = useSuspenseQuery(getHealthSettingsOptions());
  let [draft, setDraft] = useState<HealthSettings>(data);
  let settled = useDebounced(draft, 250);
  let [preview, setPreview] = useState<HealthPreview>();
  let previewMutation = useMutation({...previewHealthSettingsMutation(), onSuccess: setPreview});
  let save = useMutation({
    ...updateHealthSettingsMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast({tone: "success", title: t("team:healthSaved", {defaultValue: "Health score updated for every client"})});
    },
  });
  let writes = can(user, "team.write");
  let {mutate: runPreview} = previewMutation;

  useEffect(() => {
    runPreview({body: settled});
  }, [settled, runPreview]);

  let changed = JSON.stringify(draft) !== JSON.stringify({weights: data.weights, thresholds: data.thresholds});

  return (
    <div className="grid grid-cols-1 gap-10 px-4 lg:grid-cols-2">
      <div className="flex flex-col gap-10">
        <PageHeader
          title={t("team:healthScore", {defaultValue: "Health score"})}
          subtitle={t("team:healthHint", {defaultValue: "How the 0–100 score on every client is made. Change it when the clients who leave turn out to look different from what the score said."})}
        />
        {save.error ? <ErrorAlert title={t("common:error", {defaultValue: "Error"})} message={save.error.message} /> : null}
        <Section title={t("team:weights", {defaultValue: "Weights"})}>
          {FACTORS.map((factor) => (
            <div key={factor.key} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between">
                <Label htmlFor={factor.key}>{t(`clients:health.${factor.key}`, {defaultValue: factor.label})}</Label>
                <span className="font-semibold tabular-nums">{draft.weights[factor.key]}%</span>
              </div>
              <input
                id={factor.key}
                type="range"
                min={0}
                max={100}
                step={5}
                disabled={!writes}
                value={draft.weights[factor.key]}
                onChange={(e) => setDraft({...draft, weights: rebalance(draft.weights, factor.key, Number(e.target.value))})}
                className="accent-accent w-full"
              />
              <span className="text-on-surface-secondary text-xs">{t(`team:factorHint.${factor.key}`, {defaultValue: factor.hint})}</span>
            </div>
          ))}
        </Section>
        <Section title={t("team:grades", {defaultValue: "Grades"})}>
          <div className="grid max-w-sm grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="good">{t("team:healthyFrom", {defaultValue: "Healthy from"})}</Label>
              <Input
                id="good"
                type="number"
                min={2}
                max={100}
                disabled={!writes}
                value={draft.thresholds.good}
                onChange={(e) => setDraft({...draft, thresholds: {...draft.thresholds, good: Number(e.target.value)}})}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="watch">{t("team:watchFrom", {defaultValue: "Watch from"})}</Label>
              <Input
                id="watch"
                type="number"
                min={1}
                max={99}
                disabled={!writes}
                value={draft.thresholds.watch}
                onChange={(e) => setDraft({...draft, thresholds: {...draft.thresholds, watch: Number(e.target.value)}})}
              />
            </div>
          </div>
          <span className="text-on-surface-secondary text-xs">{t("team:belowWatch", {defaultValue: "Below Watch is At risk."})}</span>
        </Section>
        {data.updatedAt ? (
          <p className="text-on-surface-secondary text-xs">
            {t("common:lastChanged", {defaultValue: "Last changed {{when}} by {{name}}", when: formatDateTime(data.updatedAt), name: data.updatedBy?.name ?? "—"})}
          </p>
        ) : null}
        {writes ? (
          <div className="flex gap-2">
            <Button size="lg" disabled={!changed || save.isPending} loading={save.isPending} onClick={() => save.mutate({body: draft})}>
              {t("team:applyToAll", {defaultValue: "Apply to every client"})}
            </Button>
            {changed ? (
              <Button size="lg" color="neutral" variant="ghost" onClick={() => setDraft({weights: data.weights, thresholds: data.thresholds})}>
                {t("common:reset", {defaultValue: "Reset"})}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-10">
        <Section title={t("team:whatPredicted", {defaultValue: "What actually predicted leaving"})}>
          <p className="text-on-surface-secondary text-sm">
            {t("team:whatPredictedHint", {
              defaultValue: "Average factor scores of clients who left or were suspended, against those still active. The bigger the gap, the more that factor deserves weight.",
            })}
          </p>
          <ul className="flex flex-col gap-3">
            {preview?.signals
              .slice()
              .sort((a, b) => b.retainedAvg - b.churnedAvg - (a.retainedAvg - a.churnedAvg))
              .map((signal) => (
                <li key={signal.factor} className="flex flex-col gap-1">
                  <div className="flex justify-between text-sm">
                    <span>{t(`clients:health.${signal.factor}`, {defaultValue: FACTORS.find((f) => f.key === signal.factor)?.label})}</span>
                    <span className="text-on-surface-secondary tabular-nums">{t("team:gap", {defaultValue: "gap {{gap}}", gap: signal.retainedAvg - signal.churnedAvg})}</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <Bar value={signal.retainedAvg} className="bg-accent" label={t("team:stayed", {defaultValue: "stayed"})} />
                    <Bar value={signal.churnedAvg} className="bg-error-bright" label={t("team:left", {defaultValue: "left"})} />
                  </div>
                </li>
              ))}
          </ul>
        </Section>
        <Section title={t("team:preview", {defaultValue: "With these settings"})}>
          {preview ? (
            <>
              <ul className="flex gap-4 text-sm">
                {(["good", "watch", "atRisk"] as const).map((g) => (
                  <li key={g}>
                    <StatusText color={healthColor(g)}>
                      {healthLabel(t, g)} <span className="font-semibold tabular-nums">{preview.distribution[g]}</span>
                    </StatusText>
                  </li>
                ))}
              </ul>
              {preview.changes.length ? (
                <ul className="flex flex-col gap-1 text-sm">
                  <li className="text-on-surface-secondary text-xs">{t("team:wouldChange", {defaultValue: "{{count}} clients would change grade:", count: preview.changes.length})}</li>
                  {preview.changes.map((change) => (
                    <li key={change.clientID} className="flex items-center justify-between gap-2">
                      <Link to="/clients/$id" params={{id: change.clientID}} className="truncate hover:underline">
                        {change.clientName}
                      </Link>
                      <span className="flex shrink-0 items-center gap-2 text-xs">
                        <StatusText color={healthColor(change.from)}>{healthLabel(t, change.from)}</StatusText>→<StatusText color={healthColor(change.to)}>{healthLabel(t, change.to)}</StatusText>
                        <span className="text-on-surface-secondary tabular-nums">{change.score}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-on-surface-secondary text-sm">{t("team:noChanges", {defaultValue: "No client would change grade."})}</p>
              )}
            </>
          ) : null}
        </Section>
      </div>
    </div>
  );
}

function Bar({value, className, label}: {value: number; className: string; label: string}) {
  return (
    <div className="flex items-center gap-2">
      <div className="bg-surface-400 h-2 flex-1 overflow-hidden rounded-full">
        <div className={`h-full rounded-full ${className}`} style={{width: `${Math.max(2, value)}%`}} />
      </div>
      <span className="text-on-surface-secondary w-20 text-right text-xs tabular-nums">
        {value} {label}
      </span>
    </div>
  );
}
