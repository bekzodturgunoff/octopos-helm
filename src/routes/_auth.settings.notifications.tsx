import {FormEvent, Suspense, useState} from "react";
import {useMutation, useQuery, useQueryClient, useSuspenseQuery} from "@tanstack/react-query";
import {createFileRoute} from "@tanstack/react-router";
import {Button, ErrorAlert, Label, Select, TimeInput} from "@yeahuz/kdsx-react";
import {useTranslation} from "react-i18next";
import {getDigestPreviewOptions, getMyNotificationsOptions, sendTestNotificationMutation, updateMyNotificationsMutation, type MyNotificationSettings} from "@/api";
import {Section} from "@/components/field";
import {FormPageSkeleton} from "@/components/skeletons";
import {useToast} from "@/components/toaster";
import {TelegramConnect} from "@/components/telegram-connect";

export let Route = createFileRoute("/_auth/settings/notifications")({
  beforeLoad: () => ({backLink: {to: "/settings"}}),
  component: () => (
    <Suspense fallback={<FormPageSkeleton rows={6} />}>
      <MyNotifications />
    </Suspense>
  ),
});

function MyNotifications() {
  let {t} = useTranslation();
  let toast = useToast();
  let queryClient = useQueryClient();
  let {data} = useSuspenseQuery(getMyNotificationsOptions());
  let [draft, setDraft] = useState<MyNotificationSettings>(data);
  let preview = useQuery(getDigestPreviewOptions());
  let save = useMutation({
    ...updateMyNotificationsMutation(),
    onSuccess: (saved) => {
      queryClient.setQueryData(getMyNotificationsOptions().queryKey, saved);
      setDraft(saved);
      queryClient.invalidateQueries({predicate: (q) => (q.queryKey[0] as {_id?: string})?._id === "getDigestPreview"});
      toast({tone: "success", title: t("settings:notificationsSaved", {defaultValue: "Saved"})});
    },
  });
  let test = useMutation({
    ...sendTestNotificationMutation(),
    onSuccess: () => toast({tone: "success", title: t("settings:digestSentTelegram", {defaultValue: "Sent to your Telegram"})}),
    onError: (err) => toast({tone: "error", title: err.message}),
  });
  let include = (key: keyof MyNotificationSettings["includes"], label: string) => (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" className="accent-accent" checked={draft.includes[key]} onChange={(e) => setDraft({...draft, includes: {...draft.includes, [key]: e.target.checked}})} />
      {label}
    </label>
  );

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    save.mutate({body: draft});
  }

  return (
    <form onSubmit={onSubmit} className="grid grid-cols-1 gap-10 px-4 lg:grid-cols-2">
      <div className="flex flex-col gap-10">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold tracking-tight">{t("settings:notifications", {defaultValue: "Notifications"})}</h1>
          <p className="text-on-surface-secondary text-sm">{t("settings:digestHint", {defaultValue: "One Telegram message each morning with what is yours today."})}</p>
        </div>
        {save.error ? <ErrorAlert title={t("common:error", {defaultValue: "Error"})} message={save.error.message} /> : null}
        <Section title={t("settings:telegram", {defaultValue: "Your Telegram"})}>
          <TelegramConnect />
        </Section>
        <Section title={t("settings:morningDigest", {defaultValue: "Morning digest"})}>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="accent-accent" checked={draft.digest.enabled} onChange={(e) => setDraft({...draft, digest: {...draft.digest, enabled: e.target.checked}})} />
            {t("settings:digestOn", {defaultValue: "Send me a digest"})}
          </label>
          <div className="grid max-w-sm grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="time">{t("settings:at", {defaultValue: "At"})}</Label>
              <TimeInput id="time" value={draft.digest.time} onChange={(e) => setDraft({...draft, digest: {...draft.digest, time: e.target.value}})} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="days">{t("settings:on", {defaultValue: "On"})}</Label>
              <Select id="days" value={draft.digest.days} onChange={(e) => setDraft({...draft, digest: {...draft.digest, days: e.target.value as "weekdays" | "everyday"}})}>
                <option value="weekdays">{t("settings:weekdays", {defaultValue: "Weekdays"})}</option>
                <option value="everyday">{t("settings:everyday", {defaultValue: "Every day"})}</option>
              </Select>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {include("tasks", t("settings:incTasks", {defaultValue: "My tasks due today and overdue"}))}
            {include("renewals", t("settings:incRenewals", {defaultValue: "Renewals this week"}))}
            {include("overdue", t("settings:incOverdue", {defaultValue: "Overdue accounts"}))}
            {include("fleet", t("settings:incFleet", {defaultValue: "Installations not running"}))}
            {include("myClientsOnly", t("settings:incMine", {defaultValue: "Only clients I manage"}))}
          </div>
        </Section>
        <div className="flex flex-wrap gap-2">
          <Button size="lg" loading={save.isPending}>
            {t("common:saveChanges", {defaultValue: "Save changes"})}
          </Button>
          <Button type="button" size="lg" color="neutral" loading={test.isPending} onClick={() => test.mutate({body: {target: "me"}})}>
            {t("settings:sendNow", {defaultValue: "Send me one now"})}
          </Button>
        </div>
      </div>
      <Section title={t("settings:preview", {defaultValue: "Preview"})}>
        <pre className="bg-surface-300 rounded-xl p-4 font-sans text-sm whitespace-pre-wrap">{preview.data?.text ?? "…"}</pre>
        <span className="text-on-surface-secondary text-xs">{t("settings:previewHint", {defaultValue: "Built from today's data with your saved settings."})}</span>
      </Section>
    </form>
  );
}
