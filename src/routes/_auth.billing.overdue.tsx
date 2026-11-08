import {Suspense} from "react";
import {useSuspenseQuery} from "@tanstack/react-query";
import {createFileRoute, Link, redirect} from "@tanstack/react-router";
import {Button, Tag} from "@yeahuz/kdsx-react";
import {PartyPopper} from "lucide-react";
import {useTranslation} from "react-i18next";
import {listOverdueAccountsOptions, type OverdueAccount} from "@/api";
import {PageHeader} from "@/components/page-header";
import {StatCard} from "@/components/stat-card";
import {EmptyState} from "@/components/empty-state";
import {HealthBadge} from "@/components/health-badge";
import {ListSkeleton} from "@/components/skeletons";
import {RecordPaymentDialog, SendReminderDialog, SuspendDialog, ExtendDialog, PromiseDialog} from "@/components/client-actions";
import {DunningTimeline} from "@/components/dunning";
import {useMutation, useQueryClient} from "@tanstack/react-query";
import {bulkSendRemindersMutation, cancelPaymentPromiseMutation, getDunningSettingsOptions, type ReminderChannel} from "@/api";
import {useState} from "react";
import {Select} from "@yeahuz/kdsx-react";
import {FormDialog, FormField} from "@/components/form-dialog";
import {useQuery} from "@tanstack/react-query";
import {formatDate, formatRelative} from "@/lib/format";
import {can} from "@/permission";
import {uzs} from "@/lib/money";

export let Route = createFileRoute("/_auth/billing/overdue")({
  beforeLoad: ({context}) => {
    if (!can(context.user, "billing.read")) throw redirect({to: "/403"});
    return {backLink: {to: "/billing"}};
  },
  loader: ({context}) => {
    context.queryClient.prefetchQuery(listOverdueAccountsOptions());
  },
  component: Overdue,
});

function Overdue() {
  let {t} = useTranslation();
  return (
    <div className="flex flex-col gap-8 px-4">
      <PageHeader
        title={t("billing:overdue", {defaultValue: "Overdue"})}
        subtitle={t("billing:overdueHintSettings", {
          defaultValue: "Oldest first. Each account follows the payment chasing schedule; a promise to pay pauses it until the promised day.",
        })}
      >
        <ChasingStatus />
      </PageHeader>
      <Suspense fallback={<ListSkeleton rows={6} />}>
        <Queue />
      </Suspense>
    </div>
  );
}

function ChasingStatus() {
  let {t} = useTranslation();
  let {data} = useQuery(getDunningSettingsOptions());
  if (!data) return null;
  return (
    <>
      <Tag color={data.enabled ? "green" : "neutral"}>
        {data.enabled ? t("billing:chasingOn", {defaultValue: "Automatic chasing on"}) : t("billing:chasingOff", {defaultValue: "Automatic chasing off"})}
      </Tag>
      <Button size="sm" color="neutral" variant="outline" asChild>
        <Link to="/billing/payment-chasing">{t("billing:chasingSettings", {defaultValue: "Chasing settings"})}</Link>
      </Button>
    </>
  );
}

/** Manual steps read as something to do; automatic ones as what Helm will do and when. */
function stepTag(t: ReturnType<typeof useTranslation>["t"], account: OverdueAccount) {
  let when = formatDate(account.nextStepAt).replace(/, \d{4}$/, "");
  let due = Date.parse(account.nextStepAt) <= Date.now();
  switch (account.nextStep) {
    case "suspended":
      return <Tag color="red">{t("billing:stepSuspended", {defaultValue: "Suspended"})}</Tag>;
    case "waitForPromise":
      return <Tag color="blue">{t("billing:stepWait", {defaultValue: "Promised · waiting"})}</Tag>;
    case "retry":
      return <Tag color="neutral">{t("billing:stepAutoRetry", {defaultValue: "Card retry {{when}}", when})}</Tag>;
    case "remind":
      return account.manual ? (
        <Tag color="yellow">{due ? t("billing:stepRemind", {defaultValue: "Send reminder"}) : t("billing:stepRemindOn", {defaultValue: "Remind {{when}}", when})}</Tag>
      ) : (
        <Tag color="neutral">{t("billing:stepAutoRemind", {defaultValue: "Auto reminder {{when}}", when})}</Tag>
      );
    case "finalNotice":
      return account.manual ? (
        <Tag color="red">{t("billing:stepFinal", {defaultValue: "Send final notice"})}</Tag>
      ) : (
        <Tag color="yellow">{t("billing:stepAutoFinal", {defaultValue: "Final notice {{when}}", when})}</Tag>
      );
    default:
      if (!due) return <Tag color="yellow">{t("billing:stepSuspendOn", {defaultValue: "Suspends {{when}}", when})}</Tag>;
      return <Tag color="red">{account.manual ? t("billing:stepSuspend", {defaultValue: "Ready to suspend"}) : t("billing:stepSuspending", {defaultValue: "Suspending today"})}</Tag>;
  }
}

function readyToSuspend(account: OverdueAccount) {
  return account.nextStep === "suspend" && account.manual && Date.parse(account.nextStepAt) <= Date.now();
}

function Queue() {
  let {t} = useTranslation();
  let {user} = Route.useRouteContext();
  let {data} = useSuspenseQuery(listOverdueAccountsOptions());
  let {data: settings} = useQuery(getDunningSettingsOptions());
  let writes = can(user, "billing.write");

  if (!data.accounts.length) {
    return (
      <EmptyState
        icon={PartyPopper}
        title={t("billing:nobodyOverdue", {defaultValue: "Nobody is overdue"})}
        description={t("billing:nobodyOverdueHint", {defaultValue: "Every open invoice is still inside its due date."})}
      />
    );
  }

  let currency = data.accounts[0].invoice.amountDue.currency;
  let total = data.accounts.reduce((sum, a) => sum + a.invoice.amountDue.majorAmount, 0);
  let toSuspend = data.accounts.filter(readyToSuspend).length;
  let suspended = data.accounts.filter((a) => a.nextStep === "suspended").length;
  let remindable = data.accounts.filter((a) => a.nextStep !== "waitForPromise" && a.nextStep !== "suspended");

  return (
    <div className="flex flex-col gap-8">
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 [&>li:last-child:nth-child(odd)]:col-span-2 sm:[&>li:last-child:nth-child(odd)]:col-span-1">
        <StatCard
          label={t("billing:owed", {defaultValue: "Owed"})}
          value={uzs(total, currency).display}
          hint={t("billing:accountsCount", {defaultValue: "{{count}} accounts", count: data.accounts.length})}
        />
        <StatCard label={t("billing:averageDaysLate", {defaultValue: "Average days late"})} value={String(Math.round(data.accounts.reduce((s, a) => s + a.daysOverdue, 0) / data.accounts.length))} />
        {settings?.enabled && settings.autoSuspend ? (
          <StatCard
            label={t("billing:suspendedUnpaid", {defaultValue: "Suspended"})}
            value={String(suspended)}
            hint={t("billing:suspendedUnpaidHint", {defaultValue: "Automatically, {{days}} days past due and after the final notice", days: settings.graceDays})}
          />
        ) : (
          <StatCard
            label={t("billing:readyToSuspend", {defaultValue: "Ready to suspend"})}
            value={String(toSuspend)}
            hint={t("billing:readyToSuspendDays", {defaultValue: "Over {{days}} days past due, final notice sent", days: settings?.graceDays ?? 21})}
          />
        )}
      </ul>
      {writes && remindable.length > 1 ? <RemindAll accounts={remindable} /> : null}
      <ul className="flex flex-col gap-3">
        {data.accounts.map((account) => (
          <li key={account.invoice.id} className="bg-surface-300 flex flex-col gap-4 rounded-xl p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 flex-col gap-1">
                <Link to="/clients/$id" params={{id: account.clientID}} search={{tab: "billing"}} className="truncate text-lg font-medium hover:underline">
                  {account.clientName}
                </Link>
                <span className="text-on-surface-secondary text-sm">
                  {account.owner.name}
                  {account.owner.phone ? (
                    <>
                      {" · "}
                      <a href={`tel:${account.owner.phone.replace(/\s/g, "")}`} className="hover:underline">
                        {account.owner.phone}
                      </a>
                    </>
                  ) : null}
                  {account.plan ? ` · ${account.plan.name}` : null}
                </span>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="text-error-bright text-lg font-semibold tabular-nums">{account.invoice.amountDue.display}</span>
                <span className="text-on-surface-secondary text-sm">{t("billing:daysLate", {defaultValue: "{{count}} days late", count: account.daysOverdue})}</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
              {stepTag(t, account)}
              <span className="text-on-surface-secondary">
                {account.invoice.number} · {t("billing:dueOn", {defaultValue: "due {{date}}", date: formatDate(account.invoice.dueAt)})}
              </span>
              <span className="text-on-surface-secondary">
                {t("billing:reminderCount", {defaultValue: "{{count}} reminders", count: account.remindersSent})}
                {account.lastReminderAt ? ` · ${t("billing:lastOne", {defaultValue: "last {{when}}", when: formatRelative(account.lastReminderAt)})}` : null}
              </span>
              <HealthBadge health={account.health} className="ml-auto" />
            </div>
            {account.promise ? <PromiseLine account={account} writes={writes} /> : null}
            {account.schedule.length ? <DunningTimeline steps={account.schedule} /> : null}
            {writes ? (
              <div className="flex flex-wrap gap-2">
                <RecordPaymentDialog
                  invoice={account.invoice}
                  trigger={
                    <Button size="sm" color="brand">
                      {t("billing:recordPayment", {defaultValue: "Record payment"})}
                    </Button>
                  }
                />
                {!account.promise || account.promise.status !== "pending" ? (
                  <PromiseDialog
                    invoice={account.invoice}
                    trigger={
                      <Button size="sm" color="neutral">
                        {t("billing:promiseToPay", {defaultValue: "Promise to pay"})}
                      </Button>
                    }
                  />
                ) : null}
                {account.nextStep !== "suspended" ? (
                  <SendReminderDialog
                    clientID={account.clientID}
                    invoice={account.invoice}
                    ownerName={account.owner.name}
                    clientName={account.clientName}
                    kind={account.nextStep === "finalNotice" && account.manual ? "finalNotice" : "reminder"}
                    trigger={
                      <Button size="sm" color="neutral">
                        {account.nextStep === "finalNotice" && account.manual ? t("billing:sendFinal", {defaultValue: "Send final notice"}) : t("billing:remind", {defaultValue: "Remind"})}
                      </Button>
                    }
                  />
                ) : null}
                <ExtendDialog
                  clientID={account.clientID}
                  trialing={false}
                  trigger={
                    <Button size="sm" color="neutral" variant="ghost">
                      {t("billing:giveGrace", {defaultValue: "Give grace days"})}
                    </Button>
                  }
                />
                {readyToSuspend(account) && can(user, "client.write") ? (
                  <SuspendDialog
                    clientID={account.clientID}
                    clientName={account.clientName}
                    trigger={
                      <Button size="sm" color="danger" variant="outline">
                        {t("clients:suspend", {defaultValue: "Suspend"})}
                      </Button>
                    }
                  />
                ) : null}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function PromiseLine({account, writes}: {account: OverdueAccount; writes: boolean}) {
  let {t} = useTranslation();
  let queryClient = useQueryClient();
  let cancel = useMutation({...cancelPaymentPromiseMutation(), onSuccess: () => queryClient.invalidateQueries()});
  let promise = account.promise!;
  let tone = promise.status === "broken" ? "bg-error-low text-on-error-low" : "bg-bright-blue/15 text-on-surface-blue";
  return (
    <div className={`flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm ${tone}`}>
      <span>
        {promise.status === "broken"
          ? t("billing:promiseBroken", {defaultValue: "Promise broken: {{amount}} was due by {{date}}. Reminders resumed.", amount: promise.amount.display, date: formatDate(promise.promisedFor)})
          : t("billing:promisePending", {defaultValue: "Promised {{amount}} by {{date}} — reminders paused.", amount: promise.amount.display, date: formatDate(promise.promisedFor)})}
        {promise.note ? <span className="opacity-80"> “{promise.note}”</span> : null}
        <span className="opacity-70"> · {promise.createdBy.name}</span>
      </span>
      {writes && promise.status === "pending" ? (
        <Button size="xs" color="neutral" variant="ghost" loading={cancel.isPending} onClick={() => cancel.mutate({body: {id: promise.id}})}>
          {t("billing:cancelPromise", {defaultValue: "Cancel promise"})}
        </Button>
      ) : null}
    </div>
  );
}

/** Everyone overdue at once — except those who promised, who are left alone until their day. */
function RemindAll({accounts}: {accounts: OverdueAccount[]}) {
  let {t} = useTranslation();
  let {mutationFn} = bulkSendRemindersMutation();
  let {data: settings} = useQuery(getDunningSettingsOptions());
  let [selected, setSelected] = useState<Set<string>>(() => new Set(accounts.map((a) => a.invoice.id)));
  return (
    <FormDialog
      // Opening it again starts from everyone currently on the list, not last time's ticks.
      onOpenChange={(open) => open && setSelected(new Set(accounts.map((a) => a.invoice.id)))}
      trigger={
        <Button size="sm" color="neutral" className="max-w-fit">
          {t("billing:remindAll", {defaultValue: "Remind {{count}} at once", count: accounts.length})}
        </Button>
      }
      title={t("billing:remindAllTitle", {defaultValue: "Send reminders"})}
      description={t("billing:remindAllHint", {defaultValue: "Each gets the reminder template with their own name, amount and pay link. Accounts with a promise to pay are not listed."})}
      action={t("billing:sendN", {defaultValue: "Send {{count}}", count: selected.size})}
      success={t("billing:remindersSent", {defaultValue: "Reminders sent"})}
      disabled={!selected.size}
      onSubmit={(form) =>
        mutationFn({
          body: {
            items: accounts.filter((a) => selected.has(a.invoice.id)).map((a) => ({clientID: a.clientID, invoiceID: a.invoice.id})),
            channel: form.get("channel") as ReminderChannel,
            includePayLink: form.get("includePayLink") === "on",
          },
        })
      }
    >
      <ul className="flex max-h-60 flex-col gap-1 overflow-y-auto">
        {accounts.map((account) => (
          <li key={account.invoice.id}>
            <label className="flex items-center justify-between gap-3 py-1 text-sm">
              <span className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="accent-accent"
                  checked={selected.has(account.invoice.id)}
                  onChange={() =>
                    setSelected((prev) => {
                      let next = new Set(prev);
                      if (next.has(account.invoice.id)) next.delete(account.invoice.id);
                      else next.add(account.invoice.id);
                      return next;
                    })
                  }
                />
                {account.clientName}
              </span>
              <span className="text-on-surface-secondary tabular-nums">{account.invoice.amountDue.display}</span>
            </label>
          </li>
        ))}
      </ul>
      <FormField label={t("billing:channel", {defaultValue: "Send by"})} htmlFor="channel">
        <Select id="channel" name="channel" defaultValue={settings?.channels[0] ?? "telegram"} key={settings ? "s" : "l"}>
          <option value="telegram">Telegram</option>
          <option value="sms">SMS</option>
          <option value="email">Email</option>
        </Select>
      </FormField>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="includePayLink" defaultChecked={settings?.includePayLink ?? true} key={settings ? "s" : "l"} className="accent-accent" />
        {t("billing:includePayLinkShort", {defaultValue: "Include a pay link"})}
      </label>
    </FormDialog>
  );
}
