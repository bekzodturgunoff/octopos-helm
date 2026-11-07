import {Suspense} from "react";
import {useSuspenseQuery} from "@tanstack/react-query";
import {createFileRoute, Link, redirect} from "@tanstack/react-router";
import {Button, Input, Select, Tabs, TabsList, TabsTrigger, Textarea} from "@yeahuz/kdsx-react";
import {HeartHandshake} from "lucide-react";
import {useTranslation} from "react-i18next";
import {listWinBackOptions, sendWinBackOfferMutation, type ReminderChannel, type WinBackCandidate} from "@/api";
import {PageHeader} from "@/components/page-header";
import {StatCard} from "@/components/stat-card";
import {EmptyState} from "@/components/empty-state";
import {ListSkeleton} from "@/components/skeletons";
import {FormDialog, FormField} from "@/components/form-dialog";
import {NewTaskDialog} from "@/components/client-actions";
import {formatDate, formatRelative} from "@/lib/format";
import {uzs} from "@/lib/money";
import {can} from "@/permission";

type Days = 30 | 60 | 90;

export let Route = createFileRoute("/_auth/billing/win-back")({
  beforeLoad: ({context}) => {
    if (!can(context.user, "billing.read")) throw redirect({to: "/403"});
    return {backLink: {to: "/billing"}};
  },
  validateSearch: (search: Record<string, unknown>): {days?: Days} => {
    let days = Number(search.days);
    return {days: days === 30 || days === 60 || days === 90 ? days : undefined};
  },
  component: WinBack,
});

function WinBack() {
  let {t} = useTranslation();
  let {days = 90} = Route.useSearch();
  let navigate = Route.useNavigate();
  return (
    <div className="flex flex-col gap-8 px-4">
      <PageHeader
        title={t("billing:winBack", {defaultValue: "Win-back"})}
        subtitle={t("billing:winBackHint", {
          defaultValue: "Clients who left recently, newest first. The first weeks after leaving are when an offer works — before the new system is settled in.",
        })}
      />
      <Tabs value={String(days)} onValueChange={(value) => navigate({search: {days: Number(value) as Days}, replace: true})}>
        <TabsList>
          <TabsTrigger value="30">{t("billing:last30", {defaultValue: "30 days"})}</TabsTrigger>
          <TabsTrigger value="60">{t("billing:last60", {defaultValue: "60 days"})}</TabsTrigger>
          <TabsTrigger value="90">{t("billing:last90", {defaultValue: "90 days"})}</TabsTrigger>
        </TabsList>
      </Tabs>
      <Suspense fallback={<ListSkeleton rows={4} />}>
        <Candidates days={days} />
      </Suspense>
    </div>
  );
}

function Candidates({days}: {days: number}) {
  let {t} = useTranslation();
  let {user} = Route.useRouteContext();
  let {data} = useSuspenseQuery(listWinBackOptions({query: {days}}));
  if (!data.candidates.length) return <EmptyState icon={HeartHandshake} title={t("billing:noChurn", {defaultValue: "Nobody left in this window"})} />;

  let lost = data.candidates.reduce((sum, c) => sum + (c.lastAmount?.majorAmount ?? 0), 0);
  let offered = data.candidates.filter((c) => c.offerSentAt).length;

  return (
    <div className="flex flex-col gap-8">
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label={t("billing:churnedClients", {defaultValue: "Left"})} value={String(data.candidates.length)} />
        <StatCard label={t("billing:revenueLost", {defaultValue: "Monthly revenue lost"})} value={uzs(lost).display} />
        <StatCard label={t("billing:offersSent", {defaultValue: "Offers sent"})} value={`${offered} / ${data.candidates.length}`} />
      </ul>
      <ul className="flex flex-col gap-3">
        {data.candidates.map((candidate) => (
          <li key={candidate.clientID} className="bg-surface-300 flex flex-col gap-3 rounded-xl p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-0.5">
                <Link to="/clients/$id" params={{id: candidate.clientID}} className="truncate text-lg font-medium hover:underline">
                  {candidate.clientName}
                </Link>
                <span className="text-on-surface-secondary text-sm">
                  {candidate.owner.name}
                  {candidate.owner.phone ? ` · ${candidate.owner.phone}` : ""} · {candidate.lastPlan?.name ?? "—"}
                </span>
              </div>
              <div className="flex flex-col items-end text-sm">
                <span>{t("billing:leftWhen", {defaultValue: "Left {{when}}", when: formatRelative(candidate.churnedAt)})}</span>
                <span className="text-on-surface-secondary">
                  {t("billing:tenure", {defaultValue: "{{months}} months · paid {{ltv}}", months: candidate.monthsActive, ltv: candidate.lifetimeValue.display})}
                </span>
              </div>
            </div>
            <p className="text-sm">
              <span className="text-on-surface-secondary">{t("billing:why", {defaultValue: "Why"})}: </span>
              {candidate.reason}
            </p>
            {candidate.offerSentAt ? (
              <p className="text-on-surface-green text-sm">
                {t("billing:offerSent", {
                  defaultValue: "Offer sent {{when}}: {{discount}}% off for {{months}} months",
                  when: formatDate(candidate.offerSentAt),
                  discount: candidate.offer?.discountPercent,
                  months: candidate.offer?.months,
                })}
              </p>
            ) : null}
            {can(user, "billing.write") || can(user, "task.write") ? (
              <div className="flex flex-wrap gap-2">
                {can(user, "billing.write") ? <OfferDialog candidate={candidate} /> : null}
                {can(user, "task.write") ? (
                  <NewTaskDialog
                    clientID={candidate.clientID}
                    defaultTitle={t("billing:winBackCall", {defaultValue: "Call {{name}} — what would bring them back?", name: candidate.owner.name})}
                    trigger={
                      <Button size="sm" color="neutral">
                        {t("billing:planCall", {defaultValue: "Plan a call"})}
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

function OfferDialog({candidate}: {candidate: WinBackCandidate}) {
  let {t} = useTranslation();
  let {mutationFn} = sendWinBackOfferMutation();
  return (
    <FormDialog
      trigger={
        <Button size="sm" color="brand">
          {candidate.offerSentAt ? t("billing:sendAnotherOffer", {defaultValue: "Send another offer"}) : t("billing:sendOffer", {defaultValue: "Send an offer"})}
        </Button>
      }
      title={t("billing:offerTitle", {defaultValue: "Win back {{name}}", name: candidate.clientName})}
      description={t("billing:offerHint", {defaultValue: "The discount applies from the first invoice after they come back, for the months you choose."})}
      action={t("billing:send", {defaultValue: "Send"})}
      success={t("billing:offerSentToast", {defaultValue: "Offer sent"})}
      onSubmit={(form) =>
        mutationFn({
          body: {
            clientID: candidate.clientID,
            discountPercent: Number(form.get("discount")),
            months: Number(form.get("months")),
            channel: form.get("channel") as ReminderChannel,
            message: String(form.get("message")),
          },
        })
      }
    >
      <div className="grid grid-cols-3 gap-3">
        <FormField label={t("billing:discount", {defaultValue: "Discount %"})} htmlFor="discount">
          <Input id="discount" name="discount" type="number" min={0} max={100} defaultValue={30} required />
        </FormField>
        <FormField label={t("billing:forMonths", {defaultValue: "For months"})} htmlFor="months">
          <Input id="months" name="months" type="number" min={1} max={12} defaultValue={3} required />
        </FormField>
        <FormField label={t("billing:channel", {defaultValue: "Send by"})} htmlFor="channel">
          <Select id="channel" name="channel" defaultValue="telegram">
            <option value="telegram">Telegram</option>
            <option value="sms">SMS</option>
            <option value="email">Email</option>
          </Select>
        </FormField>
      </div>
      <FormField label={t("billing:message", {defaultValue: "Message"})} htmlFor="message">
        <Textarea
          id="message"
          name="message"
          rows={4}
          defaultValue={t("billing:offerDefault", {
            defaultValue:
              "Assalomu alaykum, {{name}}! {{business}} uchun Octopos'ga qaytsangiz, 3 oy davomida 30% chegirma beramiz. Yangi imkoniyatlar: fiskal cheklar va valyuta kurslari. Javob yozing — o'zimiz sozlab beramiz.",
            name: candidate.owner.name,
            business: candidate.clientName,
          })}
        />
      </FormField>
    </FormDialog>
  );
}
