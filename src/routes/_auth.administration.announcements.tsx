import {Suspense} from "react";
import {useQuery, useSuspenseQuery} from "@tanstack/react-query";
import {createFileRoute, redirect} from "@tanstack/react-router";
import {Button, DateTimeInput, Input, Select, Tag, Textarea} from "@yeahuz/kdsx-react";
import {Megaphone} from "lucide-react";
import {useTranslation} from "react-i18next";
import {createAnnouncementMutation, endAnnouncementMutation, listAnnouncementsOptions, listPlansOptions, type AnnouncementAudience, type AnnouncementSeverity} from "@/api";
import {PageHeader} from "@/components/page-header";
import {FormDialog, FormField} from "@/components/form-dialog";
import {EmptyState} from "@/components/empty-state";
import {ListSkeleton} from "@/components/skeletons";
import {StatusText} from "@/components/status-text";
import {announcementColor, announcementStatusColor} from "@/lib/status";
import {formatDateTime} from "@/lib/format";
import {can} from "@/permission";

export let Route = createFileRoute("/_auth/administration/announcements")({
  beforeLoad: ({context}) => {
    if (!can(context.user, "announcement.write")) throw redirect({to: "/403"});
    return {backLink: {to: "/administration"}};
  },
  component: Announcements,
});

function Announcements() {
  let {t} = useTranslation();
  return (
    <div className="flex flex-col gap-8 px-4">
      <PageHeader
        title={t("common:announcements", {defaultValue: "Announcements"})}
        subtitle={t("common:announcementsHint", {defaultValue: "A banner across the top of the clients' dash — maintenance windows, outages, new features. Pick who sees it."})}
      >
        <NewAnnouncementDialog />
      </PageHeader>
      <Suspense fallback={<ListSkeleton rows={4} />}>
        <AnnouncementList />
      </Suspense>
    </div>
  );
}

function audienceLabel(t: ReturnType<typeof useTranslation>["t"], audience: AnnouncementAudience) {
  if (audience.kind === "all") return t("common:audienceAll", {defaultValue: "Every client"});
  if (audience.kind === "plans") return t("common:audiencePlans", {defaultValue: "On {{plans}}", plans: audience.planSlugs.join(", ")});
  return t("common:audienceClients", {defaultValue: "{{count}} clients", count: audience.clientIDs.length});
}

function AnnouncementList() {
  let {t} = useTranslation();
  let {data} = useSuspenseQuery(listAnnouncementsOptions());
  let {mutationFn: end} = endAnnouncementMutation();

  if (!data.announcements.length) return <EmptyState icon={Megaphone} title={t("common:noAnnouncements", {defaultValue: "No announcements yet"})} />;

  return (
    <ul className="flex flex-col gap-3">
      {data.announcements.map((announcement) => (
        <li key={announcement.id} className="bg-surface-300 flex flex-col gap-3 rounded-xl p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Tag color={announcementColor(announcement.severity)} className="capitalize">
                {announcement.severity}
              </Tag>
              <span className="font-medium">{announcement.title}</span>
            </div>
            <StatusText color={announcementStatusColor(announcement.status)} className="text-sm capitalize">
              {t(`common:announcementStatus.${announcement.status}`, {defaultValue: announcement.status})}
            </StatusText>
          </div>
          <p className="text-on-surface-secondary text-sm whitespace-pre-wrap">{announcement.body}</p>
          <div className="text-on-surface-secondary flex flex-wrap items-center justify-between gap-2 text-xs">
            <span>
              {audienceLabel(t, announcement.audience)} · {formatDateTime(announcement.startsAt)}
              {announcement.endsAt ? ` → ${formatDateTime(announcement.endsAt)}` : ""} · {announcement.createdBy.name}
            </span>
            {announcement.status !== "ended" ? (
              <FormDialog
                trigger={
                  <Button size="xs" color="neutral">
                    {t("common:endNow", {defaultValue: "End now"})}
                  </Button>
                }
                title={t("common:endAnnouncement", {defaultValue: "Take this banner down?"})}
                action={t("common:endNow", {defaultValue: "End now"})}
                success={t("common:announcementEnded", {defaultValue: "Announcement ended"})}
                onSubmit={() => end({body: {id: announcement.id}})}
              />
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

function NewAnnouncementDialog() {
  let {t} = useTranslation();
  let {data} = useQuery(listPlansOptions());
  let {mutationFn} = createAnnouncementMutation();
  let now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return (
    <FormDialog
      trigger={
        <Button size="sm" color="brand">
          {t("common:newAnnouncement", {defaultValue: "New announcement"})}
        </Button>
      }
      title={t("common:newAnnouncement", {defaultValue: "New announcement"})}
      action={t("common:publish", {defaultValue: "Publish"})}
      success={t("common:announcementPublished", {defaultValue: "Announcement published"})}
      onSubmit={(form) => {
        let audienceValue = (form.get("audience") as string) || "all";
        let audience: AnnouncementAudience = audienceValue === "all" ? {kind: "all"} : {kind: "plans", planSlugs: [audienceValue]};
        let endsAt = form.get("endsAt") as string;
        return mutationFn({
          body: {
            title: (form.get("title") as string).trim(),
            body: (form.get("body") as string).trim(),
            severity: form.get("severity") as AnnouncementSeverity,
            audience,
            startsAt: new Date(form.get("startsAt") as string).toISOString(),
            endsAt: endsAt ? new Date(endsAt).toISOString() : undefined,
          },
        });
      }}
    >
      <FormField label={t("common:title", {defaultValue: "Title"})} htmlFor="title">
        <Input id="title" name="title" required maxLength={80} />
      </FormField>
      <FormField label={t("common:message", {defaultValue: "Message"})} htmlFor="body">
        <Textarea id="body" name="body" rows={4} required maxLength={400} />
      </FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label={t("common:severity", {defaultValue: "Severity"})} htmlFor="severity">
          <Select id="severity" name="severity" defaultValue="info">
            <option value="info">{t("common:severityInfo", {defaultValue: "Info"})}</option>
            <option value="warning">{t("common:severityWarning", {defaultValue: "Warning"})}</option>
            <option value="critical">{t("common:severityCritical", {defaultValue: "Critical"})}</option>
          </Select>
        </FormField>
        <FormField label={t("common:audience", {defaultValue: "Who sees it"})} htmlFor="audience">
          <Select id="audience" name="audience" defaultValue="all">
            <option value="all">{t("common:audienceAll", {defaultValue: "Every client"})}</option>
            {data?.plans.map((plan) => (
              <option key={plan.id} value={plan.slug}>
                {t("common:audiencePlanOnly", {defaultValue: "{{plan}} only", plan: plan.name})}
              </option>
            ))}
          </Select>
        </FormField>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FormField label={t("common:startsAt", {defaultValue: "Starts"})} htmlFor="startsAt">
          <DateTimeInput id="startsAt" name="startsAt" required defaultValue={now.toISOString().slice(0, 16)} />
        </FormField>
        <FormField label={t("common:endsAt", {defaultValue: "Ends (optional)"})} htmlFor="endsAt">
          <DateTimeInput id="endsAt" name="endsAt" />
        </FormField>
      </div>
    </FormDialog>
  );
}
