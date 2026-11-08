import {FormEvent, Suspense, useState} from "react";
import {useMutation, useQueryClient, useSuspenseQuery} from "@tanstack/react-query";
import {createFileRoute, redirect} from "@tanstack/react-router";
import {Button, ErrorAlert, FixedFooter, Input, Textarea, TimeInput} from "@yeahuz/kdsx-react";
import {Bell, Check, CreditCard, Lock, LockOpen, Moon, Pencil, Plus, TriangleAlert, X} from "lucide-react";
import {useTranslation} from "react-i18next";
import {getDunningSettingsOptions, updateDunningSettingsMutation, type DunningSettings, type ReminderChannel} from "@/api";
import {PageHeader} from "@/components/page-header";
import {Section} from "@/components/field";
import {FormPageSkeleton} from "@/components/skeletons";
import {renderTemplate} from "@/components/dunning";
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

let SAMPLE = {name: "Akmal", business: "Rayhon Milliy Taomlar", amount: "590 000 so'm", due: "Nov 3"};

/** The server's rules, checked as you type so Save only sends what it will accept. Worded for anyone. */
function problems(t: ReturnType<typeof useTranslation>["t"], draft: DunningSettings) {
  let list: string[] = [];
  let whole = (d: number, min: number, max: number) => Number.isInteger(d) && d >= min && d <= max;
  if (!whole(draft.finalNoticeDay, 1, 89) || !whole(draft.graceDays, 2, 90))
    list.push(t("billing:errFinalGraceRange", {defaultValue: "The last warning can be on day 1 to 89, and access can be turned off on day 2 to 90."}));
  else if (draft.finalNoticeDay >= draft.graceDays) list.push(t("billing:errFinalAfterGrace", {defaultValue: "The last warning has to come before access is turned off."}));
  if ([...draft.retryDays, ...draft.reminderDays].some((d) => d >= draft.graceDays))
    list.push(t("billing:errAfterSuspend", {defaultValue: "Card tries and reminders have to come before day {{day}}, when access is turned off.", day: draft.graceDays}));
  if (!draft.channels.length) list.push(t("billing:errChannel", {defaultValue: "Pick at least one way to send messages."}));
  if (!draft.quietHours.from || !draft.quietHours.to) list.push(t("billing:errQuiet", {defaultValue: "Set both times for the night pause."}));
  if (!draft.templates.reminder.trim() || !draft.templates.finalNotice.trim() || !draft.templates.suspended.trim())
    list.push(t("billing:errTemplate", {defaultValue: "None of the three messages can be empty."}));
  return list;
}

/** Leaves out who changed it last, so only the settings themselves count as a change. */
function strip(settings: DunningSettings) {
  let {updatedAt, updatedBy, ...rest} = settings;
  void updatedAt;
  void updatedBy;
  return rest;
}

/** One step of the story: an icon on a line, what happens in plain words, and when. */
function Step({icon, title, hint, last, children}: {icon: React.ReactNode; title: string; hint: string; last?: boolean; children?: React.ReactNode}) {
  return (
    <li className="relative flex gap-4 pb-8 last:pb-0">
      {last ? null : <span aria-hidden className="bg-border-secondary absolute top-10 bottom-0 left-5 w-px" />}
      <span className="bg-surface-300 flex size-10 shrink-0 items-center justify-center rounded-full">{icon}</span>
      <div className="flex min-w-0 flex-1 flex-col gap-3 pt-2">
        <div className="flex flex-col gap-0.5">
          <span className="font-medium">{title}</span>
          <span className="text-on-surface-secondary text-sm">{hint}</span>
        </div>
        {children}
      </div>
    </li>
  );
}

/**
 * Days as chips instead of a comma list nobody remembers the format of. Day 1 is the day after the
 * due date. Adding a day that is already there does nothing; the list is always in order.
 */
function DayChips({id, days, onChange, disabled}: {id: string; days: number[]; onChange: (days: number[]) => void; disabled?: boolean}) {
  let {t} = useTranslation();
  let [adding, setAdding] = useState("");
  let value = Number(adding);
  let valid = adding !== "" && Number.isInteger(value) && value >= 1 && value <= 89;
  let add = () => {
    if (!valid) return;
    onChange([...new Set([...days, value])].sort((a, b) => a - b));
    setAdding("");
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      {days.map((day) => (
        <span key={day} className="bg-surface-300 flex h-9 items-center gap-1 rounded-full pr-1 pl-3 text-sm">
          {t("billing:dayChip", {defaultValue: "Day {{day}}", day})}
          {disabled ? null : (
            <button
              type="button"
              onClick={() => onChange(days.filter((d) => d !== day))}
              aria-label={t("billing:removeDay", {defaultValue: "Remove day {{day}}", day})}
              className="hover:bg-neutral flex size-7 items-center justify-center rounded-full"
            >
              <X size={14} />
            </button>
          )}
        </span>
      ))}
      {days.length === 0 ? <span className="text-on-surface-secondary text-sm">{t("billing:noDays", {defaultValue: "Never"})}</span> : null}
      {disabled ? null : (
        <span className="flex items-center gap-1">
          <Input
            id={id}
            type="number"
            inputMode="numeric"
            min={1}
            max={89}
            value={adding}
            onChange={(e) => setAdding(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            placeholder={t("billing:dayPlaceholder", {defaultValue: "Day"})}
            aria-label={t("billing:addDay", {defaultValue: "Add a day"})}
            className="w-20"
          />
          <Button type="button" color="neutral" variant="fill" icon={true} onClick={add} disabled={!valid} aria-label={t("billing:addDay", {defaultValue: "Add a day"})}>
            <Plus size={16} />
          </Button>
        </span>
      )}
    </div>
  );
}

/** A single day: "On day [14]". */
function DayInput({id, value, onChange, min, max, disabled}: {id: string; value: number; onChange: (value: number) => void; min: number; max: number; disabled?: boolean}) {
  let {t} = useTranslation();
  return (
    <label htmlFor={id} className="flex items-center gap-2 text-sm">
      {t("billing:onDay", {defaultValue: "On day"})}
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={Number.isFinite(value) ? value : ""}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-20"
      />
    </label>
  );
}

/** A message as the client will see it, with its text one tap away. */
function MessageCard({
  id,
  title,
  hint,
  value,
  onChange,
  sample,
  disabled,
}: {
  id: string;
  title: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  sample: Record<string, string>;
  disabled?: boolean;
}) {
  let {t} = useTranslation();
  let [editing, setEditing] = useState(false);
  let words: [string, string][] = [
    ["{{name}}", t("billing:varName", {defaultValue: "client's name"})],
    ["{{business}}", t("billing:varBusiness", {defaultValue: "business name"})],
    ["{{amount}}", t("billing:varAmount", {defaultValue: "amount owed"})],
    ["{{due}}", t("billing:varDue", {defaultValue: "due date"})],
    ["{{days}}", t("billing:varDays", {defaultValue: "days until access is turned off"})],
    ["{{link}}", t("billing:varLink", {defaultValue: "payment link"})],
  ];
  return (
    <div className="bg-surface-300 flex flex-col gap-3 rounded-xl p-4">
      <div className="flex flex-col gap-0.5">
        <span className="font-medium">{title}</span>
        <span className="text-on-surface-secondary text-sm">{hint}</span>
      </div>
      {/* What arrives on the client's phone. */}
      <p className="bg-surface-200 max-w-md self-start rounded-2xl rounded-tl-sm px-4 py-3 text-sm whitespace-pre-wrap">{renderTemplate(value, sample).trim() || "—"}</p>
      {disabled ? null : (
        <Button type="button" size="sm" color="neutral" variant="fill" className="self-start" onClick={() => setEditing(!editing)}>
          {editing ? (
            t("billing:doneEditing", {defaultValue: "Done"})
          ) : (
            <>
              <Pencil size={14} /> {t("billing:editText", {defaultValue: "Edit text"})}
            </>
          )}
        </Button>
      )}
      {editing ? (
        <div className="flex flex-col gap-2">
          <Textarea id={id} rows={4} value={value} onChange={(e) => onChange(e.target.value)} />
          <p className="text-on-surface-secondary text-xs">{t("billing:varsIntro", {defaultValue: "Words in curly brackets are filled in for each client:"})}</p>
          <ul className="text-on-surface-secondary grid grid-cols-1 gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
            {words.map(([word, meaning]) => (
              <li key={word}>
                <code className="text-on-surface">{word}</code> — {meaning}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function PaymentChasing() {
  let {t} = useTranslation();
  let {user} = Route.useRouteContext();
  let toast = useToast();
  let queryClient = useQueryClient();
  let {data} = useSuspenseQuery(getDunningSettingsOptions());
  let [draft, setDraft] = useState<DunningSettings>(data);
  let writes = can(user, "billing.write");
  let save = useMutation({
    ...updateDunningSettingsMutation(),
    onSuccess: (saved) => {
      queryClient.setQueryData(getDunningSettingsOptions().queryKey, saved);
      setDraft(saved);
      queryClient.invalidateQueries({predicate: (q) => (q.queryKey[0] as {_id?: string})?._id === "listOverdueAccounts"});
      toast({tone: "success", title: t("billing:chasingSaved", {defaultValue: "Payment chasing saved"})});
    },
  });

  let set = <K extends keyof DunningSettings>(key: K, value: DunningSettings[K]) => setDraft((prev) => ({...prev, [key]: value}));
  let setTemplate = (key: keyof DunningSettings["templates"], value: string) => setDraft((prev) => ({...prev, templates: {...prev.templates, [key]: value}}));
  let toggleChannel = (channel: ReminderChannel) => set("channels", draft.channels.includes(channel) ? draft.channels.filter((c) => c !== channel) : [...draft.channels, channel]);

  let errors = problems(t, draft);
  let dirty = JSON.stringify(strip(draft)) !== JSON.stringify(strip(data));
  let sample = {
    ...SAMPLE,
    days: String(Math.max(0, draft.graceDays - draft.finalNoticeDay)),
    link: draft.includePayLink ? "https://checkout.paycom.uz/…" : "",
  };
  let off = !draft.enabled;
  let CHANNELS: [ReminderChannel, string][] = [
    ["telegram", "Telegram"],
    ["sms", "SMS"],
    ["email", t("billing:channelEmail", {defaultValue: "Email"})],
  ];

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (errors.length) return;
    save.mutate({body: draft});
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-10 px-4 lg:max-w-3xl">
      <PageHeader
        title={t("billing:paymentChasing", {defaultValue: "Payment chasing"})}
        subtitle={t("billing:paymentChasingHint", {defaultValue: "What Helm does when a client does not pay on time. Day 1 is the first day after the payment was due."})}
      />
      {save.error ? <ErrorAlert title={t("common:error", {defaultValue: "Error"})} message={save.error.message} /> : null}
      {writes && dirty && errors.length ? <ErrorAlert title={t("billing:fixBeforeSaving", {defaultValue: "Fix before saving"})} message={errors.join(" ")} /> : null}

      <label className="bg-surface-300 flex cursor-pointer items-center justify-between gap-4 rounded-xl p-4">
        <span className="flex flex-col gap-0.5">
          <span className="font-medium">{t("billing:chasingEnabled", {defaultValue: "Do these steps automatically"})}</span>
          <span className="text-on-surface-secondary text-sm">
            {off
              ? t("billing:chasingOffNote", {defaultValue: "Off: Helm sends nothing by itself. The Overdue list tells your team what to do on these days instead."})
              : t("billing:chasingEnabledHint", {defaultValue: "On: Helm follows the steps below by itself."})}
          </span>
        </span>
        <input type="checkbox" checked={draft.enabled} disabled={!writes} onChange={(e) => set("enabled", e.target.checked)} className="accent-accent size-6 shrink-0" />
      </label>

      <Section title={t("billing:stepsTitle", {defaultValue: "When a client does not pay"})}>
        <ol className="flex flex-col">
          <Step
            icon={<CreditCard size={18} />}
            title={t("billing:stepCardTitle", {defaultValue: "Try charging the card again"})}
            hint={t("billing:stepCardHint", {defaultValue: "Only for clients who pay by card automatically. Stops if the bank says the card is closed or stolen."})}
          >
            <DayChips id="retry" days={draft.retryDays} onChange={(days) => set("retryDays", days)} disabled={!writes} />
          </Step>
          <Step
            icon={<Bell size={18} />}
            title={t("billing:stepRemindTitle", {defaultValue: "Send a reminder"})}
            hint={
              off
                ? t("billing:stepRemindHintOff", {defaultValue: "Your team is asked to remind the client."})
                : t("billing:stepRemindHint", {defaultValue: "A polite message that the payment is late."})
            }
          >
            <DayChips id="remind" days={draft.reminderDays} onChange={(days) => set("reminderDays", days)} disabled={!writes} />
          </Step>
          <Step
            icon={<TriangleAlert size={18} />}
            title={t("billing:stepFinalTitle", {defaultValue: "Send a last warning"})}
            hint={t("billing:stepFinalHint", {defaultValue: "Tells the client their access will be turned off in {{count}} days.", count: Math.max(0, draft.graceDays - draft.finalNoticeDay)})}
          >
            <DayInput id="final" value={draft.finalNoticeDay} min={1} max={89} disabled={!writes} onChange={(v) => set("finalNoticeDay", v)} />
          </Step>
          <Step
            icon={<Lock size={18} />}
            title={t("billing:stepSuspendTitle", {defaultValue: "Turn off access"})}
            hint={
              draft.autoSuspend && !off
                ? t("billing:stepSuspendHintAuto", {defaultValue: "Helm turns it off by itself. The cash registers keep working offline."})
                : t("billing:stepSuspendHintManual", {defaultValue: "Your team is told to turn it off. Nothing happens by itself."})
            }
          >
            <DayInput id="grace" value={draft.graceDays} min={2} max={90} disabled={!writes} onChange={(v) => set("graceDays", v)} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={draft.autoSuspend} disabled={!writes || off} onChange={(e) => set("autoSuspend", e.target.checked)} className="accent-accent size-4" />
              {t("billing:autoSuspend", {defaultValue: "Turn it off automatically"})}
            </label>
          </Step>
          <Step
            last
            icon={<LockOpen size={18} />}
            title={t("billing:stepPaidTitle", {defaultValue: "When the client pays"})}
            hint={
              draft.autoReactivate && !off
                ? t("billing:stepPaidHintAuto", {defaultValue: "Access comes back on right away."})
                : t("billing:stepPaidHintManual", {defaultValue: "Your team turns access back on."})
            }
          >
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={draft.autoReactivate} disabled={!writes || off} onChange={(e) => set("autoReactivate", e.target.checked)} className="accent-accent size-4" />
              {t("billing:autoReactivate", {defaultValue: "Turn access back on automatically"})}
            </label>
          </Step>
        </ol>
      </Section>

      <Section title={t("billing:delivery", {defaultValue: "How messages are sent"})}>
        <div className="flex flex-col gap-2">
          <span className="text-sm">{t("billing:sendBy", {defaultValue: "Send by"})}</span>
          <div className="flex flex-wrap gap-2">
            {CHANNELS.map(([channel, label]) => {
              let on = draft.channels.includes(channel);
              return (
                <button
                  key={channel}
                  type="button"
                  aria-pressed={on}
                  disabled={!writes}
                  onClick={() => toggleChannel(channel)}
                  className={`flex h-10 items-center gap-2 rounded-full border px-4 text-sm transition-colors ${on ? "border-border-accent bg-surface-300" : "border-border-secondary text-on-surface-secondary"}`}
                >
                  {on ? <Check size={16} /> : null}
                  {label}
                </button>
              );
            })}
          </div>
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={draft.includePayLink} disabled={!writes} onChange={(e) => set("includePayLink", e.target.checked)} className="accent-accent mt-0.5 size-4 shrink-0" />
          {t("billing:includePayLink", {defaultValue: "Add a Click / Payme link so the client can pay in two taps"})}
        </label>
        <div className="flex flex-col gap-2">
          <span className="flex items-center gap-2 text-sm">
            <Moon size={16} /> {t("billing:quietTitle", {defaultValue: "Do not send messages at night"})}
          </span>
          <div className="grid max-w-sm grid-cols-2 gap-3 text-sm">
            <label className="flex flex-col gap-1.5">
              <span className="text-on-surface-secondary text-xs">{t("billing:quietFrom", {defaultValue: "From"})}</span>
              <TimeInput id="quietFrom" value={draft.quietHours.from} disabled={!writes} onChange={(e) => set("quietHours", {...draft.quietHours, from: e.target.value})} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-on-surface-secondary text-xs">{t("billing:quietTo", {defaultValue: "To"})}</span>
              <TimeInput id="quietTo" value={draft.quietHours.to} disabled={!writes} onChange={(e) => set("quietHours", {...draft.quietHours, to: e.target.value})} />
            </label>
          </div>
          <span className="text-on-surface-secondary text-xs">{t("billing:quietHint", {defaultValue: "Messages due at night wait until the morning."})}</span>
        </div>
      </Section>

      <Section title={t("billing:messages", {defaultValue: "What the client receives"})}>
        <p className="text-on-surface-secondary -mt-2 text-sm">
          {t("billing:messagesHint", {defaultValue: "This is how each message looks on the client's phone, with example details filled in."})}
          {draft.includePayLink ? null : ` ${t("billing:linkOffNote", {defaultValue: "The payment link is off, so messages go without it."})}`}
        </p>
        <MessageCard
          id="tpl-reminder"
          title={t("billing:templateReminder", {defaultValue: "Reminder"})}
          hint={t("billing:templateReminderHint", {defaultValue: "Sent on the reminder days."})}
          value={draft.templates.reminder}
          onChange={(v) => setTemplate("reminder", v)}
          sample={sample}
          disabled={!writes}
        />
        <MessageCard
          id="tpl-finalNotice"
          title={t("billing:templateFinal", {defaultValue: "Last warning"})}
          hint={t("billing:templateFinalHint", {defaultValue: "Sent on day {{day}}.", day: draft.finalNoticeDay})}
          value={draft.templates.finalNotice}
          onChange={(v) => setTemplate("finalNotice", v)}
          sample={sample}
          disabled={!writes}
        />
        <MessageCard
          id="tpl-suspended"
          title={t("billing:templateSuspended", {defaultValue: "Access turned off"})}
          hint={t("billing:templateSuspendedHint", {defaultValue: "Sent when access is turned off."})}
          value={draft.templates.suspended}
          onChange={(v) => setTemplate("suspended", v)}
          sample={sample}
          disabled={!writes}
        />
      </Section>

      {data.updatedAt ? (
        <p className="text-on-surface-secondary text-xs">
          {t("common:lastChanged", {defaultValue: "Last changed {{when}} by {{name}}", when: formatDateTime(data.updatedAt), name: data.updatedBy?.name ?? "—"})}
        </p>
      ) : null}

      {writes ? (
        <FixedFooter className={`z-20 px-4 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] sm:static sm:px-0 ${dirty ? "" : "max-sm:hidden"}`}>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button size="lg" className="w-full sm:w-auto" loading={save.isPending} disabled={save.isPending || !dirty || errors.length > 0}>
              {t("common:saveChanges", {defaultValue: "Save changes"})}
            </Button>
            {dirty ? (
              <Button
                type="button"
                size="lg"
                color="neutral"
                variant="ghost"
                className="w-full sm:w-auto"
                onClick={() => {
                  setDraft(data);
                  save.reset();
                }}
              >
                {t("common:discard", {defaultValue: "Discard"})}
              </Button>
            ) : null}
          </div>
        </FixedFooter>
      ) : null}
    </form>
  );
}
