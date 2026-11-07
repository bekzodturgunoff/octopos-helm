import {FormEvent, Suspense, useState} from "react";
import {useMutation, useQueryClient, useSuspenseQuery} from "@tanstack/react-query";
import {createFileRoute, redirect} from "@tanstack/react-router";
import {Button, ErrorAlert, Input, Label, Tag} from "@yeahuz/kdsx-react";
import {useTranslation} from "react-i18next";
import {getTeamNotificationsOptions, sendTestNotificationMutation, updateTeamNotificationsMutation, type AlertEvent, type TeamNotificationSettings} from "@/api";
import {PageHeader} from "@/components/page-header";
import {Section} from "@/components/field";
import {FormPageSkeleton} from "@/components/skeletons";
import {useToast} from "@/components/toaster";
import {formatDateTime} from "@/lib/format";
import {can} from "@/permission";

export let Route = createFileRoute("/_auth/administration/notifications")({
  beforeLoad: ({context}) => {
    if (!can(context.user, "team.read")) throw redirect({to: "/403"});
    return {backLink: {to: "/administration"}};
  },
  component: () => (
    <Suspense fallback={<FormPageSkeleton rows={8} />}>
      <TeamAlerts />
    </Suspense>
  ),
});

let EVENTS: {key: AlertEvent; label: string; hint: string}[] = [
  {key: "fleetCrashLooping", label: "Installation not running", hint: "The supervisor answers, the till does not — ours to fix."},
  {key: "fleetOffline", label: "Installation offline", hint: "Nothing heard from it at all, usually the client's power or network."},
  {key: "paymentFailed", label: "Card charge failed", hint: "With the provider's reason."},
  {key: "promiseBroken", label: "Payment promise broken", hint: "The promised day passed and the invoice is still open."},
  {key: "noFirstSale", label: "Installed, no sale", hint: "A week after install and the tills have not sold anything."},
  {key: "clientSigned", label: "New client signed", hint: "Good news is news too."},
  {key: "trialEnding", label: "Trial ending", hint: "Three days before, with no card on file."},
  {key: "clientChurned", label: "Client left", hint: "With the reason given."},
];

function TeamAlerts() {
  let {t} = useTranslation();
  let {user} = Route.useRouteContext();
  let toast = useToast();
  let queryClient = useQueryClient();
  let {data} = useSuspenseQuery(getTeamNotificationsOptions());
  let [draft, setDraft] = useState<TeamNotificationSettings>(data);
  let writes = can(user, "team.write");
  let save = useMutation({
    ...updateTeamNotificationsMutation(),
    onSuccess: (saved) => {
      queryClient.setQueryData(getTeamNotificationsOptions().queryKey, saved);
      setDraft(saved);
      toast({tone: "success", title: t("team:alertsSaved", {defaultValue: "Team alerts saved"})});
    },
  });
  let test = useMutation({
    ...sendTestNotificationMutation(),
    onSuccess: () => toast({tone: "success", title: t("team:testSent", {defaultValue: "Test message sent to {{chat}}", chat: data.telegram.chatTitle ?? data.telegram.chatID})}),
    onError: (err) => toast({tone: "error", title: err.message}),
  });

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    save.mutate({body: draft});
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-10 px-4 lg:max-w-3xl">
      <PageHeader
        title={t("team:teamAlerts", {defaultValue: "Team alerts"})}
        subtitle={t("team:teamAlertsHint", {defaultValue: "Trouble posted to the team's Telegram group as it happens, with a link straight to the client or installation in Helm."})}
      />
      {save.error ? <ErrorAlert title={t("common:error", {defaultValue: "Error"})} message={save.error.message} /> : null}

      <Section title="Telegram">
        <div className="flex flex-wrap items-center gap-2">
          {data.telegram.connected ? (
            <Tag color="green">{t("team:connectedTo", {defaultValue: "Connected · {{chat}}", chat: data.telegram.chatTitle})}</Tag>
          ) : (
            <Tag color="neutral">{t("team:notConnected", {defaultValue: "Not connected"})}</Tag>
          )}
        </div>
        <div className="flex flex-col gap-2 sm:max-w-md">
          <Label htmlFor="chatID">{t("team:chatID", {defaultValue: "Group chat ID"})}</Label>
          <Input
            id="chatID"
            value={draft.telegram.chatID ?? ""}
            disabled={!writes}
            placeholder="-1001234567890"
            onChange={(e) => setDraft({...draft, telegram: {...draft.telegram, chatID: e.target.value.trim() || undefined}})}
          />
          <span className="text-on-surface-secondary text-xs">{t("team:chatHint", {defaultValue: "Add @octopos_helm_bot to the group, send /id, and paste the number it answers with."})}</span>
        </div>
        <div>
          <Button type="button" size="sm" color="neutral" loading={test.isPending} onClick={() => test.mutate({body: {target: "team"}})}>
            {t("team:sendTest", {defaultValue: "Send a test message"})}
          </Button>
        </div>
      </Section>

      <Section title={t("team:whatToSend", {defaultValue: "What to send"})}>
        <ul className="flex flex-col gap-3">
          {EVENTS.map((event) => (
            <li key={event.key}>
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  className="accent-accent mt-1"
                  checked={draft.events[event.key]}
                  disabled={!writes}
                  onChange={(e) => setDraft({...draft, events: {...draft.events, [event.key]: e.target.checked}})}
                />
                <span className="flex flex-col">
                  <span>{t(`team:alert.${event.key}`, {defaultValue: event.label})}</span>
                  <span className="text-on-surface-secondary text-xs">{t(`team:alertHint.${event.key}`, {defaultValue: event.hint})}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </Section>

      <Section title={t("team:thresholds", {defaultValue: "When it counts"})}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="crash">{t("team:crashMinutes", {defaultValue: "Crash loop for (minutes)"})}</Label>
            <Input id="crash" type="number" min={1} max={120} value={draft.crashLoopMinutes} disabled={!writes} onChange={(e) => setDraft({...draft, crashLoopMinutes: Number(e.target.value)})} />
            <span className="text-on-surface-secondary text-xs">{t("team:crashHint", {defaultValue: "A restart that recovers on its own is not news."})}</span>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="offline">{t("team:offlineHours", {defaultValue: "Offline for (hours)"})}</Label>
            <Input id="offline" type="number" min={1} max={72} value={draft.offlineHours} disabled={!writes} onChange={(e) => setDraft({...draft, offlineHours: Number(e.target.value)})} />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="accent-accent" checked={draft.offlineKeyAccountsOnly} disabled={!writes} onChange={(e) => setDraft({...draft, offlineKeyAccountsOnly: e.target.checked})} />
          {t("team:keyOnly", {defaultValue: "Offline alerts for key accounts only (everyone else is in the morning digest)"})}
        </label>
      </Section>

      {data.updatedAt ? (
        <p className="text-on-surface-secondary text-xs">
          {t("common:lastChanged", {defaultValue: "Last changed {{when}} by {{name}}", when: formatDateTime(data.updatedAt), name: data.updatedBy?.name ?? "—"})}
        </p>
      ) : null}
      {writes ? (
        <div>
          <Button size="lg" loading={save.isPending} disabled={save.isPending}>
            {t("common:saveChanges", {defaultValue: "Save changes"})}
          </Button>
        </div>
      ) : null}
    </form>
  );
}
