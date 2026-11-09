import {Suspense, useMemo, useState, FormEvent} from "react";
import {useMutation, useQuery, useQueryClient, useSuspenseQuery} from "@tanstack/react-query";
import {createFileRoute, Link, redirect} from "@tanstack/react-router";
import {Alert, AlertDescription, AlertTitle, Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, Tabs, TabsList, TabsTrigger, Tag, Textarea} from "@yeahuz/kdsx-react";
import {ExternalLink, MoreHorizontal, Pin, Server, Trash2, ReceiptText, StickyNote, History, MapPin} from "lucide-react";
import {useTranslation} from "react-i18next";
import type {EChartsOption} from "echarts";
import {
  createClientNoteMutation,
  deleteClientNoteMutation,
  getClientOptions,
  getOperatorFleetNodesOptions,
  listActivityOptions,
  listClientNotesOptions,
  listClientPlacesOptions,
  listInvoicesOptions,
  listPaymentsOptions,
  listTasksOptions,
  type ActivityCategory,
  type ClientDetail,
} from "@/api";
import {DetailPageSkeleton, ListSkeleton} from "@/components/skeletons";
import {Field, Fields, Section} from "@/components/field";
import {HealthBadge, HealthBreakdown} from "@/components/health-badge";
import {StatusText} from "@/components/status-text";
import {PlacesMap} from "@/components/places-map";
import {mapLinks, placeKey} from "@/lib/places";
import {EmptyState} from "@/components/empty-state";
import {ChartCard} from "@/components/chart-card";
import {ECharts} from "@/components/echart";
import {ActivityList} from "@/components/activity-list";
import {TaskList} from "@/components/task-list";
import {InvoiceRow, PaymentRow} from "@/components/billing-rows";
import {
  CancelSubscriptionDialog,
  ChangePlanDialog,
  ExtendDialog,
  ImpersonateDialog,
  NewTaskDialog,
  ReactivateDialog,
  RecordPaymentDialog,
  SendReminderDialog,
  SuspendDialog,
  VoidInvoiceDialog,
} from "@/components/client-actions";
import {useTheme} from "@/theme-provider";
import {axisDefaults, chartTooltipStyle, readPalette} from "@/lib/echarts-theme";
import {fleetHealth, fleetHealthColor, fleetNodeLabel, healthWord} from "@/lib/fleet";
import {clientStatusColor, clientStatusLabel, healthLabel, subscriptionStatusColor, subscriptionStatusLabel, tagColor, vendorLabel} from "@/lib/status";
import {formatDate, formatDateTime, formatDue, formatNumber, formatRelative} from "@/lib/format";
import {can, Can} from "@/permission";
import {DashLink} from "@/components/dash-link";
import {dashUrl} from "@/lib/dash";
import {useToast} from "@/components/toaster";
import {RemoteAccessList} from "@/components/remote-access";
import {OnboardingChecklist} from "@/components/onboarding";
import {SupportSessionList} from "@/components/support-session";
import {ActivityFilter} from "@/components/activity-list";

type Tab = "overview" | "billing" | "installations" | "notes" | "activity";
let TABS: Tab[] = ["overview", "billing", "installations", "notes", "activity"];

export let Route = createFileRoute("/_auth/clients/$id")({
  beforeLoad: ({context}) => {
    if (!can(context.user, "client.read")) throw redirect({to: "/403"});
    return {backLink: {to: "/clients"}};
  },
  validateSearch: (search: Record<string, unknown>): {tab?: Tab} => ({tab: TABS.includes(search.tab as Tab) ? (search.tab as Tab) : undefined}),
  loader: ({context, params}) => {
    context.queryClient.prefetchQuery(getClientOptions({query: {id: params.id}}));
  },
  component: ClientPage,
});

function ClientPage() {
  return (
    <Suspense fallback={<DetailPageSkeleton sections={3} />}>
      <ClientContent />
    </Suspense>
  );
}

function ClientContent() {
  let {t} = useTranslation();
  let {id} = Route.useParams();
  let {tab = "overview"} = Route.useSearch();
  let navigate = Route.useNavigate();
  let {user} = Route.useRouteContext();
  let {data: client} = useSuspenseQuery(getClientOptions({query: {id}}));
  let [dialog, setDialog] = useState<"suspend" | "reactivate" | "cancel">();
  let sub = client.subscription;

  return (
    <div className="flex flex-col gap-8 px-4">
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-3xl font-semibold tracking-tight">{client.name}</h1>
            {/* Their own dash, <slug>.dash.octopos.uz, e.g. black-bear-coffee.dash.octopos.uz. */}
            <a href={dashUrl(client.slug)} target="_blank" rel="noreferrer" className="text-on-surface-secondary mt-1 inline-flex max-w-full items-center gap-1 text-sm break-all hover:underline">
              {dashUrl(client.slug).replace("https://", "")} <ExternalLink size={12} className="shrink-0" />
            </a>
          </div>
          <HealthBadge health={client.health} className="shrink-0" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Tag color={tagColor(clientStatusColor(client.status))}>{clientStatusLabel(t, client.status)}</Tag>
          {sub ? (
            <Tag color={tagColor(subscriptionStatusColor(sub.status))}>
              {sub.plan.name} · {subscriptionStatusLabel(t, sub.status)}
            </Tag>
          ) : null}
          <Tag color={client.health.grade === "good" ? "green" : client.health.grade === "watch" ? "yellow" : "red"}>{healthLabel(t, client.health.grade)}</Tag>
          {client.tags.map((tag) => (
            <Tag key={tag} color="neutral">
              {tag}
            </Tag>
          ))}
        </div>
        {client.status === "suspended" ? (
          <Alert variant="destructive">
            <AlertTitle>{t("clients:suspendedTitle", {defaultValue: "Suspended"})}</AlertTitle>
            <AlertDescription>{client.suspendedReason}</AlertDescription>
          </Alert>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Can subject={user} capability="client.impersonate">
            <ImpersonateDialog
              clientID={client.id}
              clientName={client.name}
              trigger={
                <Button size="sm" color="brand">
                  {t("clients:openDash", {defaultValue: "Open their dash"})}
                </Button>
              }
            />
          </Can>
          <Can subject={user} capability="billing.write">
            {sub ? (
              <>
                <ChangePlanDialog
                  clientID={client.id}
                  currentPlanID={sub.plan.id}
                  currentCycle={sub.billingCycle}
                  trigger={
                    <Button size="sm" color="brand" variant="outline">
                      {t("billing:changePlan", {defaultValue: "Change plan"})}
                    </Button>
                  }
                />
                <ExtendDialog
                  clientID={client.id}
                  trialing={sub.status === "trialing"}
                  periodEnd={sub.periodEnd}
                  trigger={
                    <Button size="sm" color="brand" variant="outline">
                      {sub.status === "trialing" ? t("billing:extendTrial", {defaultValue: "Extend trial"}) : t("billing:extendPeriod", {defaultValue: "Give extra days"})}
                    </Button>
                  }
                />
              </>
            ) : null}
          </Can>
          <Can subject={user} capability="task.write">
            <NewTaskDialog
              clientID={client.id}
              defaultTitle={t("clients:followUpWith", {defaultValue: "Follow up with {{name}}", name: client.name})}
              trigger={
                <Button size="sm" color="neutral">
                  {t("common:addTask", {defaultValue: "Add task"})}
                </Button>
              }
            />
          </Can>
          <Can subject={user} capability="client.write">
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button size="sm" color="neutral" icon aria-label={t("common:more", {defaultValue: "More"})}>
                  <MoreHorizontal size={16} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {client.status === "suspended" ? (
                  <DropdownMenuItem onSelect={() => setDialog("reactivate")}>{t("clients:reactivate", {defaultValue: "Reactivate"})}</DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onSelect={() => setDialog("suspend")} className="text-error-bright">
                    {t("clients:suspend", {defaultValue: "Suspend"})}
                  </DropdownMenuItem>
                )}
                {sub && sub.status !== "canceled" && sub.status !== "expired" && can(user, "billing.write") ? (
                  <DropdownMenuItem onSelect={() => setDialog("cancel")} className="text-error-bright">
                    {t("billing:cancelSubscription", {defaultValue: "Cancel subscription"})}
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
            {/* Mounted outside the menu: a dialog inside it would unmount the moment the menu closes. */}
            <SuspendDialog trigger={null} clientID={client.id} clientName={client.name} {...controlled(dialog === "suspend", setDialog)} />
            <ReactivateDialog trigger={null} clientID={client.id} {...controlled(dialog === "reactivate", setDialog)} />
            <CancelSubscriptionDialog trigger={null} clientID={client.id} {...controlled(dialog === "cancel", setDialog)} />
          </Can>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(value) => navigate({search: {tab: value === "overview" ? undefined : (value as Tab)}, replace: true})}>
        <TabsList className="overflow-x-auto">
          <TabsTrigger className="shrink-0 px-2 text-sm sm:px-4 sm:text-base" value="overview">
            {t("clients:tabOverview", {defaultValue: "Overview"})}
          </TabsTrigger>
          {can(user, "billing.read") ? (
            <TabsTrigger className="shrink-0 px-2 text-sm sm:px-4 sm:text-base" value="billing">
              {t("billing:billing", {defaultValue: "Billing"})}
            </TabsTrigger>
          ) : null}
          {can(user, "fleet.read") ? (
            <TabsTrigger className="shrink-0 px-2 text-sm sm:px-4 sm:text-base" value="installations">
              {t("fleet:installations", {defaultValue: "Installations"})}
            </TabsTrigger>
          ) : null}
          <TabsTrigger className="shrink-0 px-2 text-sm sm:px-4 sm:text-base" value="notes">
            {t("clients:notes", {defaultValue: "Notes"})}
          </TabsTrigger>
          {can(user, "audit.read") ? (
            <TabsTrigger className="shrink-0 px-2 text-sm sm:px-4 sm:text-base" value="activity">
              {t("common:timeline", {defaultValue: "Timeline"})}
            </TabsTrigger>
          ) : null}
        </TabsList>
      </Tabs>

      {tab === "overview" ? <OverviewTab client={client} /> : null}
      {tab === "billing" ? (
        <Suspense fallback={<ListSkeleton />}>
          <BillingTab client={client} />
        </Suspense>
      ) : null}
      {tab === "installations" ? (
        <Suspense fallback={<ListSkeleton />}>
          <InstallationsTab clientID={client.id} />
        </Suspense>
      ) : null}
      {tab === "notes" ? (
        <Suspense fallback={<ListSkeleton />}>
          <NotesTab clientID={client.id} />
        </Suspense>
      ) : null}
      {tab === "activity" ? (
        <Suspense fallback={<ListSkeleton />}>
          <ActivityTab clientID={client.id} />
        </Suspense>
      ) : null}
    </div>
  );
}

// A dialog the page opens from a menu: open while its name is the one chosen.
function controlled<T>(open: boolean, set: (value: T | undefined) => void) {
  return {open, onOpenChange: (next: boolean) => (next ? undefined : set(undefined))};
}

function OverviewTab({client}: {client: ClientDetail}) {
  let {t} = useTranslation();
  let {user} = Route.useRouteContext();
  let {data: nodes} = useQuery({...getOperatorFleetNodesOptions({query: {tenantID: client.id}}), enabled: can(user, "fleet.read")});
  let {theme, colorScheme} = useTheme();
  let sub = client.subscription;

  let ordersOption = useMemo<EChartsOption>(() => {
    let p = readPalette(theme, colorScheme);
    let axis = axisDefaults(theme, colorScheme);
    let days = client.dailyOrders.map((_, i) => {
      let d = new Date(Date.now() - (client.dailyOrders.length - 1 - i) * 86400000);
      return d.toLocaleDateString("en", {day: "numeric", month: "short"});
    });
    return {
      grid: {top: 8, right: 8, bottom: 8, left: 8, containLabel: true},
      tooltip: {trigger: "axis", ...chartTooltipStyle(theme, colorScheme)},
      xAxis: {type: "category", data: days, ...axis, axisLabel: {...axis.axisLabel, interval: 6}},
      yAxis: {type: "value", ...axis, splitLine: {lineStyle: {color: p.border}}},
      series: [{name: t("clients:orders", {defaultValue: "Orders"}), type: "bar", data: client.dailyOrders, itemStyle: {color: p.brand, borderRadius: [4, 4, 0, 0]}, barMaxWidth: 14}],
    };
  }, [client.dailyOrders, theme, colorScheme, t]);

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
      <div className="flex flex-col gap-10 lg:col-span-2">
        <Section title={t("billing:subscription", {defaultValue: "Subscription"})}>
          {sub ? (
            <Fields>
              <Field
                label={t("billing:plan", {defaultValue: "Plan"})}
                value={`${sub.plan.name} · ${sub.billingCycle === "yearly" ? t("billing:yearly", {defaultValue: "Yearly"}) : t("billing:monthly", {defaultValue: "Monthly"})}`}
              />
              <Field label={t("billing:price", {defaultValue: "Price"})} value={sub.amount.display} />
              <Field label={t("common:status", {defaultValue: "Status"})} value={<StatusText color={subscriptionStatusColor(sub.status)}>{subscriptionStatusLabel(t, sub.status)}</StatusText>} />
              <Field
                label={
                  sub.status === "trialing"
                    ? t("billing:trialEnds", {defaultValue: "Trial ends"})
                    : sub.status === "pastDue"
                      ? t("billing:wasDue", {defaultValue: "Was due"})
                      : t("billing:renews", {defaultValue: "Renews"})
                }
                value={`${formatDate(sub.periodEnd)} (${formatDue(sub.periodEnd)})`}
              />
              <Field
                label={t("billing:payment", {defaultValue: "Payment"})}
                value={
                  sub.nativeBilling
                    ? t("billing:autopay", {defaultValue: "Autopay via {{vendor}}", vendor: vendorLabel(sub.vendor)})
                    : sub.vendor === "none"
                      ? t("billing:manualPay", {defaultValue: "Pays manually"})
                      : t("billing:manualVia", {defaultValue: "Manual · {{vendor}}", vendor: vendorLabel(sub.vendor)})
                }
              />
              <Field
                label={t("billing:balanceDue", {defaultValue: "Balance due"})}
                value={<span className={client.balanceDue.majorAmount ? "text-error-bright" : undefined}>{client.balanceDue.display}</span>}
              />
              <Field label={t("billing:mrr", {defaultValue: "MRR"})} value={client.mrr.display} />
              <Field label={t("billing:lifetimeValue", {defaultValue: "Paid to date"})} value={client.lifetimeValue.display} />
              {sub.pendingPlan ? (
                <Field
                  wide
                  label={t("billing:pendingPlan", {defaultValue: "Scheduled change"})}
                  value={t("billing:movesTo", {defaultValue: "Moves to {{plan}} on {{date}}", plan: sub.pendingPlan.name, date: formatDate(sub.periodEnd)})}
                />
              ) : null}
              {sub.canceledAt ? <Field label={t("billing:canceledAt", {defaultValue: "Canceled"})} value={formatDate(sub.canceledAt)} /> : null}
            </Fields>
          ) : (
            <span className="text-on-surface-secondary text-sm">{t("billing:noSubscription", {defaultValue: "No subscription"})}</span>
          )}
        </Section>

        <ChartCard
          title={t("clients:ordersLast30", {defaultValue: "Orders, last 30 days"})}
          hint={t("clients:ordersLast30Hint", {defaultValue: "{{count}} orders in total — the activity half of their health", count: client.ordersLast30Days})}
        >
          <ECharts option={ordersOption} height={180} ariaLabel={t("clients:ordersLast30", {defaultValue: "Orders, last 30 days"})} />
        </ChartCard>

        <Section title={t("clients:business", {defaultValue: "Business"})}>
          <Fields>
            <Field wide label={t("clients:dashLink", {defaultValue: "Their dash"})} value={<DashLink slug={client.slug} />} />
            <Field label={t("clients:businessType", {defaultValue: "Type"})} value={<span className="capitalize">{client.businessType}</span>} />
            <Field label={t("clients:city", {defaultValue: "City"})} value={client.city ?? "—"} />
            <Field label={t("clients:locations", {defaultValue: "Locations"})} value={client.locationsCount} />
            <Field label={t("clients:users", {defaultValue: "Staff accounts"})} value={client.usersCount} />
            <Field label={t("clients:accountManager", {defaultValue: "Account manager"})} value={client.accountManager?.name ?? "—"} />
            <Field label={t("clients:customerSince", {defaultValue: "Client since"})} value={formatDate(client.createdAt)} />
            <Field label={t("clients:lastActive", {defaultValue: "Last active"})} value={formatRelative(client.lastActiveAt)} />
          </Fields>
        </Section>

        <Section title={t("clients:remoteAccessTitle", {defaultValue: "Remote access"})}>
          <RemoteAccessList client={client} writes={can(user, "client.write")} nodes={nodes?.nodes} />
        </Section>

        <Section title={t("clients:contacts", {defaultValue: "Contacts"})}>
          <ul className="flex flex-col gap-4">
            {client.contacts.map((contact, i) => (
              <li key={i} className="flex flex-col">
                <span>
                  {contact.name} {contact.role ? <span className="text-on-surface-secondary text-sm">· {contact.role}</span> : null}
                </span>
                <span className="text-on-surface-secondary flex flex-wrap gap-x-3 text-sm">
                  {contact.phone ? <a href={`tel:${contact.phone.replace(/\s/g, "")}`}>{contact.phone}</a> : null}
                  {contact.telegram ? (
                    <a href={`https://t.me/${contact.telegram.replace(/^@/, "")}`} target="_blank" rel="noreferrer">
                      {contact.telegram}
                    </a>
                  ) : null}
                  {contact.email ? <a href={`mailto:${contact.email}`}>{contact.email}</a> : null}
                </span>
              </li>
            ))}
          </ul>
        </Section>

        <Section title={t("clients:locations", {defaultValue: "Locations"})}>
          {client.locations.length ? (
            <ClientLocations client={client} />
          ) : (
            <span className="text-on-surface-secondary text-sm">{t("clients:noLocations", {defaultValue: "No locations set up yet."})}</span>
          )}
        </Section>
      </div>

      <div className="flex flex-col gap-10">
        <div className="bg-surface-300 flex flex-col gap-4 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">{t("clients:healthScore", {defaultValue: "Health score"})}</h3>
            <HealthBadge health={client.health} showLabel />
          </div>
          <HealthBreakdown health={client.health} />
          <p className="text-on-surface-secondary text-xs">
            {t("clients:healthHint", {defaultValue: "Made from payments, activity and installations. Computed by the server nightly and after every payment."})}
          </p>
        </div>
        {can(user, "client.impersonate") ? (
          <Section title={t("clients:supportSessions", {defaultValue: "Support sessions"})}>
            <SupportSessionList clientID={client.id} />
          </Section>
        ) : null}
        <Section title={t("clients:onboarding", {defaultValue: "Onboarding"})}>
          <OnboardingChecklist clientID={client.id} onboarding={client.onboardingDetail} writes={can(user, "client.write")} />
        </Section>
        <Section title={t("common:openTasks", {defaultValue: "Open tasks"})}>
          <Suspense fallback={<ListSkeleton rows={2} />}>
            <ClientTasks clientID={client.id} />
          </Suspense>
        </Section>
        <Section title={t("fleet:installations", {defaultValue: "Installations"})}>
          <Fields>
            <Field label={t("fleet:health.healthy", {defaultValue: "Healthy"})} value={formatNumber(client.installations.healthy)} />
            <Field label={t("fleet:health.degraded", {defaultValue: "Degraded"})} value={formatNumber(client.installations.degraded)} />
            <Field
              label={t("fleet:health.failing", {defaultValue: "Not running"})}
              value={<span className={client.installations.failing ? "text-error-bright" : undefined}>{client.installations.failing}</span>}
            />
            <Field label={t("fleet:health.offline", {defaultValue: "Offline"})} value={formatNumber(client.installations.offline)} />
          </Fields>
        </Section>
      </div>
    </div>
  );
}

function ClientTasks({clientID}: {clientID: string}) {
  let {t} = useTranslation();
  let {data} = useSuspenseQuery(listTasksOptions({query: {clientID, status: "open"}}));
  if (!data.tasks.length) return <span className="text-on-surface-secondary text-sm">{t("common:noOpenTasks", {defaultValue: "Nothing open."})}</span>;
  return <TaskList tasks={data.tasks} compact />;
}

function BillingTab({client}: {client: ClientDetail}) {
  let {t} = useTranslation();
  let {user} = Route.useRouteContext();
  let {data: invoices} = useSuspenseQuery(listInvoicesOptions({query: {clientID: client.id, pageSize: 50}}));
  let {data: payments} = useSuspenseQuery(listPaymentsOptions({query: {clientID: client.id, pageSize: 50}}));
  let writes = can(user, "billing.write");

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
      <Section title={t("billing:invoices", {defaultValue: "Invoices"})}>
        {invoices.items.length ? (
          <ul className="flex flex-col gap-1">
            {invoices.items.map((invoice) => (
              <InvoiceRow
                key={invoice.id}
                invoice={invoice}
                actions={
                  writes && invoice.status === "open" ? (
                    <div className="flex flex-wrap gap-2 pt-2">
                      <RecordPaymentDialog
                        invoice={invoice}
                        trigger={
                          <Button size="xs" color="brand">
                            {t("billing:recordPayment", {defaultValue: "Record payment"})}
                          </Button>
                        }
                      />
                      <SendReminderDialog
                        clientID={client.id}
                        invoice={invoice}
                        ownerName={client.owner.name}
                        trigger={
                          <Button size="xs" color="neutral">
                            {t("billing:remind", {defaultValue: "Remind"})}
                          </Button>
                        }
                      />
                      <VoidInvoiceDialog
                        invoice={invoice}
                        trigger={
                          <Button size="xs" color="neutral" variant="ghost">
                            {t("billing:void", {defaultValue: "Void"})}
                          </Button>
                        }
                      />
                    </div>
                  ) : null
                }
              />
            ))}
          </ul>
        ) : (
          <EmptyState icon={ReceiptText} title={t("billing:noInvoices", {defaultValue: "No invoices yet"})} />
        )}
      </Section>
      <Section title={t("billing:payments", {defaultValue: "Payments"})}>
        {payments.items.length ? (
          <ul className="flex flex-col gap-1">
            {payments.items.map((payment) => (
              <PaymentRow key={payment.id} payment={payment} showClient={false} />
            ))}
          </ul>
        ) : (
          <EmptyState icon={ReceiptText} title={t("billing:noPayments", {defaultValue: "No payments yet"})} />
        )}
      </Section>
    </div>
  );
}

function InstallationsTab({clientID}: {clientID: string}) {
  let {t} = useTranslation();
  let {data} = useSuspenseQuery(getOperatorFleetNodesOptions({query: {tenantID: clientID}}));
  if (!data.nodes.length) {
    return (
      <EmptyState
        icon={Server}
        title={t("fleet:noInstallations", {defaultValue: "No installations yet"})}
        description={t("fleet:noInstallationsHint", {defaultValue: "They appear here after the first check-in."})}
      />
    );
  }
  return (
    <ul className="flex flex-col gap-1">
      {data.nodes.map((node) => {
        let health = fleetHealth(node);
        return (
          <li key={node.nodeID}>
            <Link to="/fleet/$id" params={{id: node.nodeID}} className="hover:bg-surface-300 flex items-center justify-between gap-4 rounded-xl px-2 py-3">
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-medium">{fleetNodeLabel(node)}</span>
                <span className="text-on-surface-secondary line-clamp-2 text-sm sm:truncate">
                  {node.location?.name ?? "—"} · {node.runningVersion ?? t("fleet:notRunning", {defaultValue: "not running"})} · {t("fleet:lastExchange", {defaultValue: "exchanged"})}{" "}
                  {formatRelative(node.lastExchangeAt)}
                </span>
              </span>
              <StatusText color={fleetHealthColor(health)} className="shrink-0 text-sm">
                {healthWord(t, health)}
              </StatusText>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function NotesTab({clientID}: {clientID: string}) {
  let {t} = useTranslation();
  let {user} = Route.useRouteContext();
  let toast = useToast();
  let queryClient = useQueryClient();
  let {data} = useSuspenseQuery(listClientNotesOptions({query: {clientID}}));
  let [pinned, setPinned] = useState(false);
  let create = useMutation({
    ...createClientNoteMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries(listClientNotesOptions({query: {clientID}}));
      setPinned(false);
    },
    onError: (err) => toast({tone: "error", title: err.message}),
  });
  let remove = useMutation({
    ...deleteClientNoteMutation(),
    onSuccess: () => queryClient.invalidateQueries(listClientNotesOptions({query: {clientID}})),
  });

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    let form = e.target as HTMLFormElement;
    let body = (new FormData(form).get("body") as string).trim();
    if (!body) return;
    create.mutate({body: {clientID, body, pinned}}, {onSuccess: () => form.reset()});
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <form onSubmit={onSubmit} className="flex flex-col gap-2">
        <Textarea name="body" rows={3} placeholder={t("clients:notePlaceholder", {defaultValue: "What happened on the call, what they asked for, what was promised…"})} required />
        <div className="flex items-center justify-between">
          <label className="text-on-surface-secondary flex items-center gap-2 text-sm">
            <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} className="accent-accent" />
            {t("clients:pinNote", {defaultValue: "Pin to the top"})}
          </label>
          <Button size="sm" color="brand" loading={create.isPending} disabled={create.isPending}>
            {t("clients:addNote", {defaultValue: "Add note"})}
          </Button>
        </div>
      </form>
      {data.notes.length ? (
        <ul className="flex flex-col gap-3">
          {data.notes.map((note) => (
            <li key={note.id} className="bg-surface-300 flex flex-col gap-2 rounded-xl p-4">
              <p className="whitespace-pre-wrap">{note.body}</p>
              <div className="text-on-surface-secondary flex items-center justify-between gap-2 text-xs">
                <span className="flex items-center gap-1.5">
                  {note.pinned ? <Pin size={12} className="text-on-surface-accent" /> : null}
                  {note.author.name} · {formatDateTime(note.createdAt)}
                </span>
                {note.author.id === user.id ? (
                  <Button size="xs" color="neutral" variant="ghost" icon aria-label={t("common:delete", {defaultValue: "Delete"})} onClick={() => remove.mutate({body: {id: note.id}})}>
                    <Trash2 size={14} />
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={StickyNote} title={t("clients:noNotes", {defaultValue: "No notes yet"})} description={t("clients:noNotesHint", {defaultValue: "Notes are shared with the whole team."})} />
      )}
    </div>
  );
}

function ActivityTab({clientID}: {clientID: string}) {
  let {t} = useTranslation();
  let [category, setCategory] = useState<ActivityCategory>();
  return (
    <div className="flex flex-col gap-6">
      <ActivityFilter value={category} onChange={setCategory} />
      <Suspense fallback={<ListSkeleton />}>
        <ClientTimeline clientID={clientID} category={category} emptyTitle={t("common:noActivity", {defaultValue: "Nothing has happened yet"})} />
      </Suspense>
    </div>
  );
}

function ClientTimeline({clientID, category, emptyTitle}: {clientID: string; category?: ActivityCategory; emptyTitle: string}) {
  let {data} = useSuspenseQuery(listActivityOptions({query: {clientID, category, pageSize: 100}}));
  if (!data.items.length) return <EmptyState icon={History} title={emptyTitle} />;
  return <ActivityList events={data.items} showClient={false} />;
}

/**
 * The client's branches: a small map of them (with each branch's own till state, from the same
 * call as the Map page) and, under each, directions in whichever map app the phone has.
 */
function ClientLocations({client}: {client: ClientDetail}) {
  let {t} = useTranslation();
  let {data} = useQuery(listClientPlacesOptions());
  let places = useMemo(() => data?.items.filter((p) => p.clientID === client.id) ?? [], [data, client.id]);
  return (
    <div className="flex flex-col gap-4">
      {places.length ? <PlacesMap places={places} cooperative className="h-56" /> : null}
      <ul className="flex flex-col gap-3">
        {client.locations.map((location) => {
          let placed = location.latitude != null && location.longitude != null;
          return (
            <li key={location.id} className="flex items-start justify-between gap-4">
              <span className="flex min-w-0 flex-col">
                <span className="truncate">{location.name}</span>
                <span className="text-on-surface-secondary line-clamp-2 text-sm sm:truncate">{location.address}</span>
                {location.phone ? (
                  <a href={`tel:${location.phone.replace(/\s/g, "")}`} className="text-on-surface-secondary text-sm">
                    {location.phone}
                  </a>
                ) : null}
                {placed ? (
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    <span className="text-on-surface-secondary">{t("clients:directionsIn", {defaultValue: "Directions in"})}</span>
                    {mapLinks({latitude: location.latitude!, longitude: location.longitude!}).map((link) => (
                      <Button key={link.name} variant="link" size="none" className="max-w-fit" asChild>
                        <a href={link.href} target="_blank" rel="noreferrer">
                          {link.name}
                        </a>
                      </Button>
                    ))}
                    <Button variant="link" size="none" className="max-w-fit" asChild>
                      <Link to="/clients/map" search={{place: placeKey({clientID: client.id, location})}}>
                        <MapPin size={12} /> {t("clients:onTheMap", {defaultValue: "On the map"})}
                      </Link>
                    </Button>
                  </span>
                ) : (
                  <span className="text-on-surface-secondary text-xs">{t("clients:noPoint", {defaultValue: "No point on the map yet: the client sets it in their dash."})}</span>
                )}
              </span>
              <span className="text-on-surface-secondary shrink-0 text-sm">{t("fleet:installationCount", {defaultValue: "{{count}} installations", count: location.installations})}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
