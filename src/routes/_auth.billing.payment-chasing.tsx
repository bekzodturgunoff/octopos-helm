import {FormEvent, Suspense, useState} from "react";
import {useMutation, useQueryClient, useSuspenseQuery} from "@tanstack/react-query";
import {createFileRoute, redirect} from "@tanstack/react-router";
import {Button, ErrorAlert, FixedFooter, Input, Label, Textarea, TimeInput} from "@yeahuz/kdsx-react";
import {useTranslation} from "react-i18next";
import {getDunningSettingsOptions, updateDunningSettingsMutation, type DunningSettings, type DunningStep, type ReminderChannel} from "@/api";
import {PageHeader} from "@/components/page-header";
import {Section} from "@/components/field";
import {FormPageSkeleton} from "@/components/skeletons";
import {DunningTimeline, renderTemplate} from "@/components/dunning";
import {useToast} from "@/components/toaster";
import {formatDateTime} from "@/lib/format";
import {can} from "@/permission";

export let Route = createFileRoute("/_auth/billing/payment-chasing")({
  beforeLoad: ({context}) => {
    if (!can(context.user, "billing.read")) throw redirect({to: "/403"});
    return {backLink: {to: "/billing"}};
  },
  loader: ({context}) => {
    context.queryClient.prefetchQuery(getDunningSettingsOptions());
  },
  component: () => (
    <Suspense fallback={<FormPageSkeleton rows={8} />}>
      <PaymentChasing />
    </Suspense>
  ),
});

function parseDays(value: string) {
  return value
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(Number);
}

let SAMPLE = {name: "Akmal", business: "Rayhon Milliy Taomlar", amount: "590 000 so'm", due: "Nov 3", link: "https://checkout.paycom.uz/…", days: "7"};

function PaymentChasing() {
  let {t} = useTranslation();
  let {user} = Route.useRouteContext();
  let toast = useToast();
  let queryClient = useQueryClient();
  let {data} = useSuspenseQuery(getDunningSettingsOptions());
  let [draft, setDraft] = useState<DunningSettings>(data);
  let [retry, setRetry] = useState(data.retryDays.join(", "));
  let [remind, setRemind] = useState(data.reminderDays.join(", "));
  let writes = can(user, "billing.write");
  let save = useMutation({
    ...updateDunningSettingsMutation(),
    onSuccess: (saved) => {
      queryClient.setQueryData(getDunningSettingsOptions().queryKey, saved);
      queryClient.invalidateQueries({predicate: (q) => (q.queryKey[0] as {_id?: string})?._id === "listOverdueAccounts"});
      toast({tone: "success", title: t("billing:chasingSaved", {defaultValue: "Payment chasing saved"})});
    },
  });

  let set = <K extends keyof DunningSettings>(key: K, value: DunningSettings[K]) => setDraft((prev) => ({...prev, [key]: value}));
  let toggleChannel = (channel: ReminderChannel) => set("channels", draft.channels.includes(channel) ? draft.channels.filter((c) => c !== channel) : [...draft.channels, channel]);

  let preview: Pick<DunningStep, "kind" | "day" | "status">[] = [
    ...parseDays(retry).map((day) => ({kind: "retry" as const, day, status: "upcoming" as const})),
    ...parseDays(remind).map((day) => ({kind: "reminder" as const, day, status: "upcoming" as const})),
    {kind: "finalNotice" as const, day: draft.finalNoticeDay, status: "upcoming" as const},
    ...(draft.autoSuspend ? [{kind: "suspend" as const, day: draft.graceDays, status: "upcoming" as const}] : []),
  ]
    .filter((step) => Number.isFinite(step.day))
    .sort((a, b) => a.day - b.day)
    .map((step) => ({...step, status: "done" as const}));

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    save.mutate({body: {...draft, retryDays: parseDays(retry), reminderDays: parseDays(remind)}});
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-10 px-4 lg:max-w-3xl">
      <PageHeader
        title={t("billing:paymentChasing", {defaultValue: "Payment chasing"})}
        subtitle={t("billing:paymentChasingHint", {
          defaultValue:
            "What happens on its own when an invoice goes unpaid. Retry the card a few times, remind people who pay by hand, warn once more, and only then suspend — never on the first failure.",
        })}
      />
      {save.error ? <ErrorAlert title={t("common:error", {defaultValue: "Error"})} message={save.error.message} /> : null}

      <label className="bg-surface-300 flex cursor-pointer items-center justify-between gap-4 rounded-xl p-4">
        <span className="flex flex-col">
          <span className="font-medium">{t("billing:chasingEnabled", {defaultValue: "Chase payments automatically"})}</span>
          <span className="text-on-surface-secondary text-sm">{t("billing:chasingEnabledHint", {defaultValue: "Off: nothing is sent or suspended; the overdue list still shows who owes."})}</span>
        </span>
        <input type="checkbox" checked={draft.enabled} disabled={!writes} onChange={(e) => set("enabled", e.target.checked)} className="accent-accent size-5" />
      </label>

      <Section title={t("billing:schedule", {defaultValue: "Schedule"})}>
        <div className="bg-surface-300 rounded-xl p-4">
          <DunningTimeline steps={preview} compact />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="retry">{t("billing:retryDays", {defaultValue: "Retry the card on days"})}</Label>
            <Input id="retry" value={retry} onChange={(e) => setRetry(e.target.value)} disabled={!writes} placeholder="3, 7, 14" />
            <span className="text-on-surface-secondary text-xs">{t("billing:retryDaysHint", {defaultValue: "Autopay clients only. Hard declines (stolen, closed card) stop the retries."})}</span>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="remind">{t("billing:reminderDays", {defaultValue: "Send reminders on days"})}</Label>
            <Input id="remind" value={remind} onChange={(e) => setRemind(e.target.value)} disabled={!writes} placeholder="1, 7" />
            <span className="text-on-surface-secondary text-xs">{t("billing:reminderDaysHint", {defaultValue: "Counted from the due date."})}</span>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="final">{t("billing:finalNoticeDay", {defaultValue: "Final notice on day"})}</Label>
            <Input id="final" type="number" min={1} max={89} value={draft.finalNoticeDay} disabled={!writes} onChange={(e) => set("finalNoticeDay", Number(e.target.value))} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="grace">{t("billing:graceDays", {defaultValue: "Suspend after (grace days)"})}</Label>
            <Input id="grace" type="number" min={2} max={90} value={draft.graceDays} disabled={!writes} onChange={(e) => set("graceDays", Number(e.target.value))} />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={draft.autoSuspend} disabled={!writes} onChange={(e) => set("autoSuspend", e.target.checked)} className="accent-accent" />
            {t("billing:autoSuspend", {defaultValue: "Suspend automatically at the end of the grace period"})}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={draft.autoReactivate} disabled={!writes} onChange={(e) => set("autoReactivate", e.target.checked)} className="accent-accent" />
            {t("billing:autoReactivate", {defaultValue: "Restore access the moment the invoice is paid"})}
          </label>
        </div>
      </Section>

      <Section title={t("billing:delivery", {defaultValue: "How messages go out"})}>
        <div className="flex flex-wrap gap-4 text-sm">
          {(["telegram", "sms", "email"] as ReminderChannel[]).map((channel) => (
            <label key={channel} className="flex items-center gap-2 capitalize">
              <input type="checkbox" checked={draft.channels.includes(channel)} disabled={!writes} onChange={() => toggleChannel(channel)} className="accent-accent" />
              {channel === "sms" ? "SMS" : channel}
            </label>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={draft.includePayLink} disabled={!writes} onChange={(e) => set("includePayLink", e.target.checked)} className="accent-accent" />
          {t("billing:includePayLink", {defaultValue: "Include a Click / Payme link that pays the invoice in two taps"})}
        </label>
        <div className="grid max-w-sm grid-cols-2 gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="quietFrom">{t("billing:quietFrom", {defaultValue: "Quiet from"})}</Label>
            <TimeInput id="quietFrom" value={draft.quietHours.from} disabled={!writes} onChange={(e) => set("quietHours", {...draft.quietHours, from: e.target.value})} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="quietTo">{t("billing:quietTo", {defaultValue: "until"})}</Label>
            <TimeInput id="quietTo" value={draft.quietHours.to} disabled={!writes} onChange={(e) => set("quietHours", {...draft.quietHours, to: e.target.value})} />
          </div>
        </div>
      </Section>

      <Section title={t("billing:messages", {defaultValue: "Messages"})}>
        <p className="text-on-surface-secondary text-xs">
          {t("billing:templateVars", {defaultValue: "Filled in for each client:"})} <code>{"{{name}} {{business}} {{amount}} {{due}} {{days}} {{link}}"}</code>
        </p>
        {(
          [
            ["reminder", t("billing:templateReminder", {defaultValue: "Reminder"})],
            ["finalNotice", t("billing:templateFinal", {defaultValue: "Final notice"})],
            ["suspended", t("billing:templateSuspended", {defaultValue: "When suspended"})],
          ] as const
        ).map(([key, label]) => (
          <div key={key} className="flex flex-col gap-2">
            <Label htmlFor={`tpl-${key}`}>{label}</Label>
            <Textarea id={`tpl-${key}`} rows={3} value={draft.templates[key]} disabled={!writes} onChange={(e) => set("templates", {...draft.templates, [key]: e.target.value})} />
            <p className="bg-surface-300 text-on-surface-secondary rounded-lg p-3 text-sm whitespace-pre-wrap">{renderTemplate(draft.templates[key], SAMPLE)}</p>
          </div>
        ))}
      </Section>

      {data.updatedAt ? (
        <p className="text-on-surface-secondary text-xs">
          {t("common:lastChanged", {defaultValue: "Last changed {{when}} by {{name}}", when: formatDateTime(data.updatedAt), name: data.updatedBy?.name ?? "—"})}
        </p>
      ) : null}

      {writes ? (
        <FixedFooter className="px-4 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] sm:static sm:px-0">
          <Button size="lg" className="w-full sm:w-auto" loading={save.isPending} disabled={save.isPending}>
            {t("common:saveChanges", {defaultValue: "Save changes"})}
          </Button>
        </FixedFooter>
      ) : null}
    </form>
  );
}
