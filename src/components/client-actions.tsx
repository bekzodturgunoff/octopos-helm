import {Button, Input, Select, Textarea, MoneyInput, DateInput, RadioButton} from "@yeahuz/kdsx-react";
import {useState} from "react";
import {useMutation, useQuery} from "@tanstack/react-query";
import {useTranslation} from "react-i18next";
import {
  cancelSubscriptionMutation,
  changeSubscriptionPlanMutation,
  createPaymentLinkMutation,
  createPaymentPromiseMutation,
  getDunningSettingsOptions,
  type PaymentLink,
  createTaskMutation,
  extendSubscriptionMutation,
  impersonateClientMutation,
  listOperatorsOptions,
  listPlansOptions,
  reactivateClientMutation,
  recordPaymentMutation,
  sendPaymentReminderMutation,
  suspendClientMutation,
  voidInvoiceMutation,
  type BillingCycle,
  type Invoice,
  type PaymentMethod,
  type ReminderChannel,
  type TaskKind,
  type TaskPriority,
} from "@/api";
import {FormDialog, FormField} from "@/components/form-dialog";
import {formatDate} from "@/lib/format";
import {TaskFields} from "@/components/task-list";
import {renderTemplate} from "@/components/dunning";
import {CopyButton} from "@/components/remote-access";
import {useToast} from "@/components/toaster";

// Every action an operator can take on a client, each a FormDialog around one mutation. Pages pick
// the ones a role may see; the API refuses the rest regardless.

type Trigger = {trigger: React.ReactNode};
/** For a dialog opened from a menu rather than its own button: the page holds the open state. */
type Controlled = {open?: boolean; onOpenChange?: (open: boolean) => void};

function text(data: FormData, key: string) {
  return ((data.get(key) as string | null) ?? "").trim();
}

export function ImpersonateDialog({trigger, clientID, clientName}: Trigger & {clientID: string; clientName: string}) {
  let {t} = useTranslation();
  let {mutationFn} = impersonateClientMutation();
  return (
    <FormDialog
      trigger={trigger}
      title={t("clients:impersonateTitle", {defaultValue: "Open {{name}}'s dash", name: clientName})}
      description={t("clients:impersonateHintSafe", {
        defaultValue:
          'A time-boxed support session. The client sees a "Support is viewing" banner and the reason for as long as it lasts, and everything you do is logged under your name and theirs. Start read-only; most questions are answered by looking.',
      })}
      action={t("clients:impersonateAction", {defaultValue: "Open their dash"})}
      success={t("clients:impersonateDone", {defaultValue: "Support session opened in a new tab"})}
      onSubmit={async (data) => {
        // Opened before the await so the browser still counts it as the click's own window.
        let tab = window.open("about:blank", "_blank");
        try {
          let result = await mutationFn({
            body: {id: clientID, reason: text(data, "reason"), mode: text(data, "mode") === "full" ? "full" : "readOnly", minutes: Number(text(data, "minutes")) as 15 | 30 | 60},
          });
          if (tab && !tab.closed) tab.location.href = result.url;
          else window.open(result.url, "_blank");
        } catch (err) {
          tab?.close();
          tab = null;
          throw err;
        }
      }}
    >
      <div className="flex flex-col">
        <RadioButton name="mode" value="readOnly" defaultChecked>
          {t("clients:modeReadOnly", {defaultValue: "Read-only — look, change nothing"})}
        </RadioButton>
        <RadioButton name="mode" value="full">
          {t("clients:modeFull", {defaultValue: "Full access — fix settings on their behalf"})}
        </RadioButton>
      </div>
      <FormField label={t("clients:sessionLength", {defaultValue: "Ends after"})} htmlFor="minutes">
        <Select id="minutes" name="minutes" defaultValue="30">
          <option value="15">15 min</option>
          <option value="30">30 min</option>
          <option value="60">60 min</option>
        </Select>
      </FormField>
      <FormField label={t("clients:impersonateReason", {defaultValue: "Why"})} htmlFor="reason" hint={t("clients:reasonShown", {defaultValue: "Shown to the client in their banner."})}>
        <Textarea id="reason" name="reason" rows={2} required autoFocus placeholder={t("clients:impersonateReasonPlaceholder", {defaultValue: "Ticket #, or what you are fixing"})} />
      </FormField>
    </FormDialog>
  );
}

export function ChangePlanDialog({trigger, clientID, currentPlanID, currentCycle}: Trigger & {clientID: string; currentPlanID?: string; currentCycle?: BillingCycle}) {
  let {t} = useTranslation();
  let {data} = useQuery(listPlansOptions());
  let {mutationFn} = changeSubscriptionPlanMutation();
  return (
    <FormDialog
      trigger={trigger}
      title={t("billing:changePlan", {defaultValue: "Change plan"})}
      description={t("billing:changePlanHint", {defaultValue: "At period end keeps what they already paid for. Now prorates the difference onto the next invoice."})}
      action={t("billing:changePlan", {defaultValue: "Change plan"})}
      success={t("billing:planChanged", {defaultValue: "Plan updated"})}
      onSubmit={(form) =>
        mutationFn({
          body: {clientID, planID: text(form, "planID"), billingCycle: text(form, "billingCycle") as BillingCycle, effective: text(form, "effective") as "now" | "periodEnd"},
        })
      }
    >
      <FormField label={t("billing:plan", {defaultValue: "Plan"})} htmlFor="planID">
        <Select id="planID" name="planID" defaultValue={currentPlanID} required>
          {data?.plans.map((plan) => (
            <option key={plan.id} value={plan.id}>
              {plan.name} — {plan.prices.find((p) => p.billingCycle === "monthly")?.value.display} / {t("billing:month", {defaultValue: "month"})}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField label={t("billing:cycle", {defaultValue: "Billing cycle"})} htmlFor="billingCycle">
        <Select id="billingCycle" name="billingCycle" defaultValue={currentCycle ?? "monthly"}>
          <option value="monthly">{t("billing:monthly", {defaultValue: "Monthly"})}</option>
          <option value="yearly">{t("billing:yearly", {defaultValue: "Yearly (2 months free)"})}</option>
        </Select>
      </FormField>
      <div className="flex flex-col">
        <RadioButton name="effective" value="periodEnd" defaultChecked>
          {t("billing:atPeriodEnd", {defaultValue: "At the end of this period"})}
        </RadioButton>
        <RadioButton name="effective" value="now">
          {t("billing:immediately", {defaultValue: "Immediately, prorated"})}
        </RadioButton>
      </div>
    </FormDialog>
  );
}

export function ExtendDialog({trigger, clientID, trialing, periodEnd}: Trigger & {clientID: string; trialing: boolean; periodEnd?: string}) {
  let {t} = useTranslation();
  let {mutationFn} = extendSubscriptionMutation();
  return (
    <FormDialog
      trigger={trigger}
      title={trialing ? t("billing:extendTrial", {defaultValue: "Extend trial"}) : t("billing:extendPeriod", {defaultValue: "Give extra days"})}
      description={t("billing:extendHint", {defaultValue: "Moves the period end without an invoice. A past-due client goes back to active for the days given."})}
      action={t("billing:extend", {defaultValue: "Extend"})}
      success={t("billing:extended", {defaultValue: "Subscription extended"})}
      onSubmit={(form) => mutationFn({body: {clientID, days: Number(form.get("days")), reason: text(form, "reason")}})}
    >
      <ExtraDaysFields periodEnd={periodEnd} />
      <FormField label={t("common:reason", {defaultValue: "Reason"})} htmlFor="reason">
        <Textarea id="reason" name="reason" rows={2} required placeholder={t("billing:extendReasonPlaceholder", {defaultValue: "Install was late, goodwill after outage…"})} />
      </FormField>
    </FormDialog>
  );
}

let DAY_MS = 24 * 60 * 60 * 1000;
let EXTRA_DAY_PRESETS = [3, 7, 14, 30];
let MAX_EXTRA_DAYS = 365;

function toDay(date: Date) {
  let local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

/**
 * Any number of days, typed or picked as an end date — the two stay in step. The preview counts
 * from the later of the current period end and today, the same rule the server applies, so a
 * client already past due gets the days from now rather than days that have already gone.
 */
function ExtraDaysFields({periodEnd}: {periodEnd?: string}) {
  let {t} = useTranslation();
  let base = new Date(Math.max(periodEnd ? Date.parse(periodEnd) : 0, Date.now()));
  let [days, setDays] = useState("7");
  let count = Number(days);
  let valid = Number.isInteger(count) && count >= 1 && count <= MAX_EXTRA_DAYS;
  let newEnd = valid ? new Date(base.getTime() + count * DAY_MS) : undefined;

  function fromDate(value: string) {
    if (!value) return;
    let picked = new Date(`${value}T${base.toTimeString().slice(0, 8)}`);
    let diff = Math.round((picked.getTime() - base.getTime()) / DAY_MS);
    setDays(String(Math.max(1, diff)));
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <FormField label={t("billing:extraDays", {defaultValue: "Extra days"})} htmlFor="days">
          <Input
            id="days"
            name="days"
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_EXTRA_DAYS}
            step={1}
            required
            value={days}
            onChange={(e) => setDays(e.target.value)}
            endAdornment={<span className="text-on-surface-secondary pr-3 text-sm">{t("billing:daysUnit", {defaultValue: "days"})}</span>}
          />
        </FormField>
        <FormField label={t("billing:orUntil", {defaultValue: "Or until"})} htmlFor="until">
          <DateInput
            id="until"
            min={toDay(new Date(base.getTime() + DAY_MS))}
            max={toDay(new Date(base.getTime() + MAX_EXTRA_DAYS * DAY_MS))}
            value={newEnd ? toDay(newEnd) : ""}
            onChange={(e) => fromDate(e.target.value)}
          />
        </FormField>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {EXTRA_DAY_PRESETS.map((preset) => (
          <Button key={preset} type="button" size="xs" color={count === preset ? "brand" : "neutral"} variant={count === preset ? "fill" : "outline"} onClick={() => setDays(String(preset))}>
            +{preset}
          </Button>
        ))}
      </div>
      <p className={valid ? "text-on-surface-secondary text-sm" : "text-error-bright text-sm"}>
        {newEnd
          ? t("billing:extendPreview", {
              defaultValue: "New end date: {{date}} — {{count}} days from {{from}}",
              date: formatDate(newEnd.toISOString()),
              count,
              from:
                periodEnd && Date.parse(periodEnd) > Date.now()
                  ? t("billing:currentEnd", {defaultValue: "the current end ({{date}})", date: formatDate(periodEnd)})
                  : t("billing:fromToday", {defaultValue: "today"}),
            })
          : t("billing:extraDaysInvalid", {defaultValue: "Enter a whole number of days from 1 to {{max}}.", max: MAX_EXTRA_DAYS})}
      </p>
    </div>
  );
}

export function SuspendDialog({trigger, clientID, clientName, open, onOpenChange}: Trigger & Controlled & {clientID: string; clientName: string}) {
  let {t} = useTranslation();
  let {mutationFn} = suspendClientMutation();
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      trigger={trigger}
      danger
      title={t("clients:suspendTitle", {defaultValue: "Suspend {{name}}", name: clientName})}
      description={t("clients:suspendHint", {
        defaultValue: "Their dash shows a payment notice and online ordering stops. Tills keep selling offline so no sale is lost; everything resumes when you reactivate.",
      })}
      action={t("clients:suspend", {defaultValue: "Suspend"})}
      success={t("clients:suspended", {defaultValue: "Client suspended"})}
      onSubmit={(form) => mutationFn({body: {id: clientID, reason: text(form, "reason")}})}
    >
      <FormField label={t("common:reason", {defaultValue: "Reason"})} htmlFor="reason">
        <Textarea id="reason" name="reason" rows={3} required autoFocus />
      </FormField>
    </FormDialog>
  );
}

export function ReactivateDialog({trigger, clientID, open, onOpenChange}: Trigger & Controlled & {clientID: string}) {
  let {t} = useTranslation();
  let {mutationFn} = reactivateClientMutation();
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      trigger={trigger}
      title={t("clients:reactivateTitle", {defaultValue: "Reactivate access?"})}
      description={t("clients:reactivateHint", {defaultValue: "Their dash and online ordering come back immediately. Any open invoice stays open."})}
      action={t("clients:reactivate", {defaultValue: "Reactivate"})}
      success={t("clients:reactivated", {defaultValue: "Client reactivated"})}
      onSubmit={() => mutationFn({body: {id: clientID}})}
    />
  );
}

export function CancelSubscriptionDialog({trigger, clientID, open, onOpenChange}: Trigger & Controlled & {clientID: string}) {
  let {t} = useTranslation();
  let {mutationFn} = cancelSubscriptionMutation();
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      trigger={trigger}
      danger
      title={t("billing:cancelSubscription", {defaultValue: "Cancel subscription"})}
      action={t("billing:cancelSubscription", {defaultValue: "Cancel subscription"})}
      success={t("billing:subscriptionCanceled", {defaultValue: "Subscription canceled"})}
      onSubmit={(form) => mutationFn({body: {clientID, atPeriodEnd: text(form, "when") === "periodEnd", reason: text(form, "reason")}})}
    >
      <div className="flex flex-col">
        <RadioButton name="when" value="periodEnd" defaultChecked>
          {t("billing:cancelAtPeriodEnd", {defaultValue: "At the end of the paid period"})}
        </RadioButton>
        <RadioButton name="when" value="now">
          {t("billing:cancelNow", {defaultValue: "Now — access ends today"})}
        </RadioButton>
      </div>
      <FormField label={t("billing:churnReason", {defaultValue: "Why are they leaving?"})} htmlFor="reason">
        <Textarea id="reason" name="reason" rows={3} required />
      </FormField>
    </FormDialog>
  );
}

export function RecordPaymentDialog({trigger, invoice}: Trigger & {invoice: Invoice}) {
  let {t} = useTranslation();
  let {mutationFn} = recordPaymentMutation();
  let today = new Date().toISOString().slice(0, 10);
  return (
    <FormDialog
      trigger={trigger}
      title={t("billing:recordPayment", {defaultValue: "Record a payment"})}
      description={t("billing:recordPaymentHint", {
        defaultValue: "For money that arrived outside Click and Payme — a bank transfer or cash. {{number}}, {{due}} due.",
        number: invoice.number,
        due: invoice.amountDue.display,
      })}
      action={t("billing:recordPayment", {defaultValue: "Record payment"})}
      success={t("billing:paymentRecorded", {defaultValue: "Payment recorded"})}
      onSubmit={(form) =>
        mutationFn({
          body: {
            invoiceID: invoice.id,
            amount: Number(String(form.get("amount")).replace(/[^\d.]/g, "")),
            method: text(form, "method") as PaymentMethod,
            paidAt: new Date(text(form, "paidAt") || today).toISOString(),
            note: text(form, "note") || undefined,
          },
        })
      }
    >
      <FormField label={t("billing:amount", {defaultValue: "Amount"})} htmlFor="amount">
        <MoneyInput id="amount" name="amount" currency={invoice.amountDue.currency} defaultValue={invoice.amountDue.majorAmount} required />
      </FormField>
      <FormField label={t("billing:method", {defaultValue: "Method"})} htmlFor="method">
        <Select id="method" name="method" defaultValue="bankTransfer">
          <option value="bankTransfer">{t("billing:methodBank", {defaultValue: "Bank transfer"})}</option>
          <option value="cash">{t("billing:methodCash", {defaultValue: "Cash"})}</option>
          <option value="manual">{t("billing:methodOther", {defaultValue: "Other"})}</option>
        </Select>
      </FormField>
      <FormField label={t("billing:paidOn", {defaultValue: "Paid on"})} htmlFor="paidAt">
        <DateInput id="paidAt" name="paidAt" defaultValue={today} max={today} />
      </FormField>
      <FormField label={t("common:note", {defaultValue: "Note"})} htmlFor="note">
        <Input id="note" name="note" placeholder={t("billing:noteBankRef", {defaultValue: "Bank reference, who brought the cash…"})} />
      </FormField>
    </FormDialog>
  );
}

export function VoidInvoiceDialog({trigger, invoice}: Trigger & {invoice: Invoice}) {
  let {t} = useTranslation();
  let {mutationFn} = voidInvoiceMutation();
  return (
    <FormDialog
      trigger={trigger}
      danger
      title={t("billing:voidInvoice", {defaultValue: "Void {{number}}", number: invoice.number})}
      description={t("billing:voidHint", {defaultValue: "The client no longer owes it. A voided invoice stays in the history and cannot be reopened."})}
      action={t("billing:void", {defaultValue: "Void invoice"})}
      success={t("billing:voided", {defaultValue: "Invoice voided"})}
      onSubmit={(form) => mutationFn({body: {id: invoice.id, reason: text(form, "reason")}})}
    >
      <FormField label={t("common:reason", {defaultValue: "Reason"})} htmlFor="reason">
        <Textarea id="reason" name="reason" rows={2} required />
      </FormField>
    </FormDialog>
  );
}

export function SendReminderDialog({
  trigger,
  clientID,
  invoice,
  ownerName,
  clientName,
  kind = "reminder",
}: Trigger & {clientID: string; invoice: Invoice; ownerName: string; clientName?: string; kind?: "reminder" | "finalNotice"}) {
  let {t} = useTranslation();
  let {mutationFn} = sendPaymentReminderMutation();
  let {data: settings} = useQuery(getDunningSettingsOptions());
  let template = settings?.templates[kind];
  // The same words the automatic chase would send, so a manual nudge and the schedule read alike.
  let message = template
    ? renderTemplate(template, {
        name: ownerName,
        business: clientName ?? invoice.clientName,
        amount: invoice.amountDue.display,
        due: formatDate(invoice.dueAt),
        days: String(Math.max(0, (settings?.graceDays ?? 21) - Math.floor((Date.now() - Date.parse(invoice.dueAt)) / 86400000))),
        link: "{{link}}",
      })
    : "";
  return (
    <FormDialog
      trigger={trigger}
      title={kind === "finalNotice" ? t("billing:sendFinal", {defaultValue: "Send final notice"}) : t("billing:sendReminder", {defaultValue: "Send a payment reminder"})}
      action={t("billing:send", {defaultValue: "Send"})}
      success={t("billing:reminderSent", {defaultValue: "Reminder sent"})}
      onSubmit={(form) =>
        mutationFn({body: {clientID, invoiceID: invoice.id, channel: text(form, "channel") as ReminderChannel, message: text(form, "message"), includePayLink: form.get("includePayLink") === "on"}})
      }
    >
      <FormField label={t("billing:channel", {defaultValue: "Send by"})} htmlFor="channel">
        <Select id="channel" name="channel" defaultValue={settings?.channels[0] ?? "telegram"} key={settings ? "s" : "l"}>
          <option value="telegram">Telegram</option>
          <option value="sms">SMS</option>
          <option value="email">Email</option>
        </Select>
      </FormField>
      <FormField label={t("billing:message", {defaultValue: "Message"})} htmlFor="message" hint={t("billing:linkHint", {defaultValue: "{{link}} becomes a Click / Payme link for this invoice."})}>
        <Textarea id="message" name="message" rows={5} defaultValue={message} key={message ? "m" : "e"} />
      </FormField>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="includePayLink" defaultChecked={settings?.includePayLink ?? true} key={settings ? "s" : "l"} className="accent-accent" />
        {t("billing:includePayLinkShort", {defaultValue: "Include a pay link"})}
      </label>
    </FormDialog>
  );
}

export function PromiseDialog({trigger, invoice}: Trigger & {invoice: Invoice}) {
  let {t} = useTranslation();
  let {mutationFn} = createPaymentPromiseMutation();
  let today = new Date();
  let inDays = (n: number) => new Date(today.getTime() + n * 86400000).toISOString().slice(0, 10);
  return (
    <FormDialog
      trigger={trigger}
      title={t("billing:promiseTitle", {defaultValue: "Record a promise to pay"})}
      description={t("billing:promiseHint", {
        defaultValue: "Reminders pause until the promised day. If the money is not in by then, the promise is marked broken, reminders resume and it appears under Needs attention.",
      })}
      action={t("billing:savePromise", {defaultValue: "Save promise"})}
      success={t("billing:promiseSaved", {defaultValue: "Promise saved · reminders paused"})}
      onSubmit={(form) =>
        mutationFn({
          body: {
            invoiceID: invoice.id,
            promisedFor: new Date(`${text(form, "promisedFor")}T18:00:00`).toISOString(),
            amount: Number(String(form.get("amount")).replace(/[^\d.]/g, "")) || undefined,
            note: text(form, "note") || undefined,
          },
        })
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <FormField label={t("billing:promisedFor", {defaultValue: "Pays by"})} htmlFor="promisedFor">
          <DateInput id="promisedFor" name="promisedFor" required min={inDays(0)} max={inDays(30)} defaultValue={inDays(3)} />
        </FormField>
        <FormField label={t("billing:amount", {defaultValue: "Amount"})} htmlFor="amount">
          <MoneyInput id="amount" name="amount" currency={invoice.amountDue.currency} defaultValue={invoice.amountDue.majorAmount} />
        </FormField>
      </div>
      <FormField label={t("common:note", {defaultValue: "Note"})} htmlFor="note">
        <Textarea id="note" name="note" rows={2} placeholder={t("billing:promiseNotePlaceholder", {defaultValue: "Who promised, how they will pay…"})} />
      </FormField>
    </FormDialog>
  );
}

/** A Click or Payme link that pays one invoice — to paste into a chat when a reminder is not enough. */
export function PayLinkButtons({invoice}: {invoice: Invoice}) {
  let {t} = useTranslation();
  let toast = useToast();
  let [link, setLink] = useState<PaymentLink>();
  let create = useMutation({...createPaymentLinkMutation(), onSuccess: setLink, onError: (err) => toast({tone: "error", title: err.message})});
  if (invoice.status !== "open") return null;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {(["payme", "click"] as const).map((vendor) => (
          <Button
            key={vendor}
            size="sm"
            color="neutral"
            variant="outline"
            loading={create.isPending && create.variables?.body.vendor === vendor}
            onClick={() => create.mutate({body: {invoiceID: invoice.id, vendor}})}
          >
            {t("billing:payLink", {defaultValue: "{{vendor}} pay link", vendor: vendor === "click" ? "Click" : "Payme"})}
          </Button>
        ))}
      </div>
      {link ? (
        <div className="bg-surface-300 flex items-center gap-2 rounded-lg p-2">
          <code className="min-w-0 flex-1 truncate text-xs">{link.url}</code>
          <CopyButton value={link.url} label={t("billing:copyLink", {defaultValue: "Copy link"})} />
          <span className="text-on-surface-secondary shrink-0 text-xs">{t("billing:expires", {defaultValue: "expires {{date}}", date: formatDate(link.expiresAt)})}</span>
        </div>
      ) : null}
    </div>
  );
}

export function NewTaskDialog({trigger, clientID, defaultTitle, open, onOpenChange}: Trigger & {clientID?: string; defaultTitle?: string; open?: boolean; onOpenChange?: (open: boolean) => void}) {
  let {t} = useTranslation();
  let {data} = useQuery(listOperatorsOptions());
  let {mutationFn} = createTaskMutation();
  return (
    <FormDialog
      trigger={trigger}
      open={open}
      onOpenChange={onOpenChange}
      title={t("common:newTask", {defaultValue: "New task"})}
      action={t("common:createTask", {defaultValue: "Create task"})}
      success={t("common:taskCreated", {defaultValue: "Task created"})}
      onSubmit={(form) =>
        mutationFn({
          body: {
            title: text(form, "title"),
            description: text(form, "description") || undefined,
            kind: text(form, "kind") as TaskKind,
            priority: text(form, "priority") as TaskPriority,
            clientID,
            assigneeID: text(form, "assigneeID") || undefined,
            dueAt: text(form, "dueAt") ? new Date(`${text(form, "dueAt")}T18:00:00`).toISOString() : undefined,
          },
        })
      }
    >
      <FormField label={t("common:title", {defaultValue: "Title"})} htmlFor="title">
        <Input id="title" name="title" required defaultValue={defaultTitle} autoFocus />
      </FormField>
      <FormField label={t("common:details", {defaultValue: "Details"})} htmlFor="description">
        <Textarea id="description" name="description" rows={3} placeholder={t("common:detailsPlaceholder", {defaultValue: "What was promised, who to call, what to bring…"})} />
      </FormField>
      <TaskFields operators={data?.operators.filter((o) => o.status === "active") ?? []} />
    </FormDialog>
  );
}
