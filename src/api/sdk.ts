import {queryOptions} from "@tanstack/react-query";
import {request, type Method} from "./client";
import type * as T from "./types";

// Hand-written in the exact shape @hey-api generates into @yeahuz/kdsx-api: a `xxxOptions({query})`
// for every read and a `xxxMutation()` whose mutationFn takes `{body}`. The function names are the
// operationIds in api-spec/operator.yml. Once the backend lands those operations in kdsx-api, a
// page moves over by changing its import from "@/api" to "@yeahuz/kdsx-api" and nothing else.

type QueryOptions<Q> = {query?: Q};
type BodyOptions<B> = {body: B};

function createQueryKey<Q>(id: string, options: QueryOptions<Q> | undefined, tags: string[]) {
  let params: {_id: string; tags: string[]; query?: Q} = {_id: id, tags};
  if (options?.query) params.query = options.query;
  return [params] as const;
}

function read<R, Q extends object = object>(id: string, path: string, tags: string[]) {
  let fetcher = (options?: QueryOptions<Q> & {signal?: AbortSignal}) => request<R>("GET", path, {query: options?.query, signal: options?.signal});
  let key = (options?: QueryOptions<Q>) => createQueryKey(id, options, tags);
  let opts = (options?: QueryOptions<Q>) =>
    queryOptions({
      queryKey: key(options),
      queryFn: ({signal}) => fetcher({...options, signal}),
    });
  return {fetcher, key, opts};
}

function write<R, B>(path: string, method: Method = "POST") {
  return () => ({
    mutationFn: (options: BodyOptions<B>) => request<R>(method, path, {body: options.body}),
  });
}

// ---- Auth ---------------------------------------------------------------------------------------

export let signInOperatorMutation = write<T.SignInResult, T.SignInData>("/operator.auth.signIn");
export let verifyTwoFactorMutation = write<T.SignInResult, T.VerifyTwoFactorData>("/operator.auth.verifyTwoFactor");
export let setupTwoFactorMutation = write<T.TwoFactorSetup, Record<string, never>>("/operator.auth.twoFactor.setup");
export let enableTwoFactorMutation = write<T.TwoFactorEnabled, {code: string}>("/operator.auth.twoFactor.enable");
export let disableTwoFactorMutation = write<{disabled: true}, {code: string}>("/operator.auth.twoFactor.disable");
export let stepUpMutation = write<T.StepUpResult, T.StepUpData>("/operator.auth.stepUp");

let security = read<T.SecuritySettings>("getSecuritySettings", "/operator.security.get", ["Auth"]);
export let getSecuritySettingsOptions = security.opts;
export let updateSecuritySettingsMutation = write<T.SecuritySettings, T.SecuritySettings>("/operator.security.update");

export let signOutOperatorMutation = write<void, Record<string, never>>("/operator.auth.signOut");

let signedInOperator = read<T.SignedInOperator>("getSignedInOperator", "/operator.auth.me", ["Auth"]);
export let getSignedInOperatorQueryKey = signedInOperator.key;
export let getSignedInOperatorOptions = signedInOperator.opts;

// ---- Overview -----------------------------------------------------------------------------------

let overview = read<T.OverviewMetrics>("getOverviewMetrics", "/operator.metrics.overview", ["Metrics"]);
export let getOverviewMetricsOptions = overview.opts;

let revenueMovement = read<T.RevenueMovement, {months?: number}>("getRevenueMovement", "/operator.metrics.revenueMovement", ["Metrics"]);
export let getRevenueMovementOptions = revenueMovement.opts;

let cohorts = read<{cohorts: T.Cohort[]}, {months?: number}>("listCohorts", "/operator.metrics.cohorts", ["Metrics"]);
export let listCohortsOptions = cohorts.opts;

let healthSettings = read<T.HealthSettings>("getHealthSettings", "/operator.health.settings.get", ["Clients"]);
export let getHealthSettingsOptions = healthSettings.opts;
export let updateHealthSettingsMutation = write<T.HealthSettings, T.HealthSettings>("/operator.health.settings.update");
export let previewHealthSettingsMutation = write<T.HealthPreview, T.HealthSettings>("/operator.health.preview");

let attention = read<{items: T.AttentionItem[]}>("getAttention", "/operator.attention", ["Metrics"]);
export let getAttentionOptions = attention.opts;

// ---- Clients ------------------------------------------------------------------------------------

let clients = read<T.Page<T.Client>, T.ListClientsQuery>("listClients", "/operator.clients.list", ["Clients"]);
export let listClientsQueryKey = clients.key;
export let listClientsOptions = clients.opts;
/** The plain call, as hey-api also generates one beside every query option — for exports. */
export let listClients = clients.fetcher;

let client = read<T.ClientDetail, {id: string}>("getClient", "/operator.clients.get", ["Clients"]);
export let getClientQueryKey = client.key;
export let getClientOptions = client.opts;

export let createClientMutation = write<T.ClientDetail, T.CreateClientData>("/operator.clients.create");
export let updateClientMutation = write<T.ClientDetail, T.UpdateClientData>("/operator.clients.update");
export let suspendClientMutation = write<T.ClientDetail, {id: string; reason: string}>("/operator.clients.suspend");
export let reactivateClientMutation = write<T.ClientDetail, {id: string}>("/operator.clients.reactivate");
export let impersonateClientMutation = write<T.ImpersonationResult, T.ImpersonateData>("/operator.clients.impersonate");

let supportSessions = read<{sessions: T.SupportSession[]}, {clientID?: string; active?: boolean; operatorID?: string}>("listSupportSessions", "/operator.supportSessions.list", ["Clients"]);
export let listSupportSessionsOptions = supportSessions.opts;
export let endSupportSessionMutation = write<T.SupportSession, {id: string}>("/operator.supportSessions.end");

let notes = read<{notes: T.Note[]}, {clientID: string}>("listClientNotes", "/operator.notes.list", ["Notes"]);
export let listClientNotesOptions = notes.opts;
export let createClientNoteMutation = write<T.Note, T.CreateNoteData>("/operator.notes.create");
export let deleteClientNoteMutation = write<{id: string}, {id: string}>("/operator.notes.delete");

export let updateOnboardingStepMutation = write<T.ClientOnboarding, T.UpdateOnboardingData>("/operator.clients.onboarding.update");

// Remote access (AnyDesk). Entries come with the client; these change them and log connections.
export let createRemoteAccessMutation = write<T.RemoteAccess, T.RemoteAccessData>("/operator.remoteAccess.create");
export let updateRemoteAccessMutation = write<T.RemoteAccess, T.UpdateRemoteAccessData>("/operator.remoteAccess.update");
export let deleteRemoteAccessMutation = write<{id: string}, {id: string}>("/operator.remoteAccess.delete");
/** Called as the AnyDesk link opens, so "who was on this till" has an answer. */
export let logRemoteConnectionMutation = write<T.RemoteAccess, {id: string}>("/operator.remoteAccess.logConnection");

// ---- Subscriptions ------------------------------------------------------------------------------

export let changeSubscriptionPlanMutation = write<T.ClientDetail, T.ChangePlanData>("/operator.subscriptions.changePlan");
export let extendSubscriptionMutation = write<T.ClientDetail, T.ExtendSubscriptionData>("/operator.subscriptions.extend");
export let cancelSubscriptionMutation = write<T.ClientDetail, T.CancelSubscriptionData>("/operator.subscriptions.cancel");

// ---- Plans --------------------------------------------------------------------------------------

let plans = read<{plans: T.Plan[]}>("listPlans", "/operator.plans.list", ["Plans"]);
export let listPlansOptions = plans.opts;

// ---- Billing ------------------------------------------------------------------------------------

let renewals = read<{renewals: T.Renewal[]}, T.ListRenewalsQuery>("listRenewals", "/operator.billing.renewals", ["Billing"]);
export let listRenewalsOptions = renewals.opts;

let overdue = read<{accounts: T.OverdueAccount[]}>("listOverdueAccounts", "/operator.billing.overdue", ["Billing"]);
export let listOverdueAccountsOptions = overdue.opts;

let dunning = read<T.DunningSettings>("getDunningSettings", "/operator.billing.dunning.get", ["Billing"]);
export let getDunningSettingsOptions = dunning.opts;
export let updateDunningSettingsMutation = write<T.DunningSettings, T.DunningSettings>("/operator.billing.dunning.update");

export let createPaymentPromiseMutation = write<T.PaymentPromise, T.CreatePromiseData>("/operator.billing.promises.create");
export let cancelPaymentPromiseMutation = write<{id: string}, {id: string}>("/operator.billing.promises.cancel");

export let createPaymentLinkMutation = write<T.PaymentLink, {invoiceID: string; vendor: "click" | "payme"}>("/operator.invoices.paymentLink");

let winBack = read<{candidates: T.WinBackCandidate[]}, {days?: number}>("listWinBack", "/operator.billing.winBack", ["Billing"]);
export let listWinBackOptions = winBack.opts;
export let sendWinBackOfferMutation = write<T.WinBackCandidate, T.SendWinBackOfferData>("/operator.billing.winBack.sendOffer");

export let sendPaymentReminderMutation = write<{sentAt: string}, T.SendReminderData>("/operator.billing.sendReminder");

let invoices = read<T.Page<T.Invoice>, T.ListInvoicesQuery>("listInvoices", "/operator.invoices.list", ["Billing"]);
export let listInvoicesOptions = invoices.opts;
export let listInvoices = invoices.fetcher;

let invoice = read<T.Invoice, {id: string}>("getInvoice", "/operator.invoices.get", ["Billing"]);
export let getInvoiceOptions = invoice.opts;

export let voidInvoiceMutation = write<T.Invoice, T.VoidInvoiceData>("/operator.invoices.void");

let payments = read<T.Page<T.Payment>, T.ListPaymentsQuery>("listPayments", "/operator.payments.list", ["Billing"]);
export let listPaymentsOptions = payments.opts;
export let listPayments = payments.fetcher;

export let recordPaymentMutation = write<T.Payment, T.RecordPaymentData>("/operator.payments.record");

// ---- Fleet --------------------------------------------------------------------------------------

// Already in kdsx-api as getOperatorFleetNodes; the operator flavour adds tenantName to each node.
let fleetNodes = read<{nodes: T.FleetNode[]}, T.ListFleetNodesQuery>("getOperatorFleetNodes", "/operator.fleet.nodes", ["Fleet"]);
export let getOperatorFleetNodesOptions = fleetNodes.opts;

// Already in kdsx-api as retireOperatorFleetNode.
export let retireOperatorFleetNodeMutation = write<{id: string}, T.RetireFleetNodeData>("/operator.fleet.retireNode");
export let setOperatorFleetNodeTargetMutation = write<T.FleetNode, T.SetFleetNodeTargetData>("/operator.fleet.setNodeTarget");

let releases = read<{releases: T.Release[]}>("listReleases", "/operator.fleet.releases", ["Fleet"]);
export let listReleasesOptions = releases.opts;
export let setDefaultReleaseMutation = write<T.Release, T.SetDefaultReleaseData>("/operator.fleet.setDefaultRelease");

// ---- Tasks --------------------------------------------------------------------------------------

let tasks = read<{tasks: T.Task[]}, T.ListTasksQuery>("listTasks", "/operator.tasks.list", ["Tasks"]);
export let listTasksOptions = tasks.opts;

// The numbers on the Tasks tabs and the header badge, counted by the server so they agree with
// the lists whatever is filtered on screen.
let taskCounts = read<T.TaskCounts>("getTaskCounts", "/operator.tasks.counts", ["Tasks"]);
export let getTaskCountsOptions = taskCounts.opts;
export let createTaskMutation = write<T.Task, T.CreateTaskData>("/operator.tasks.create");
export let updateTaskMutation = write<T.Task, T.UpdateTaskData>("/operator.tasks.update");

// ---- Activity -----------------------------------------------------------------------------------

let activity = read<T.Page<T.ActivityEvent>, T.ListActivityQuery>("listActivity", "/operator.activity.list", ["Activity"]);
export let listActivityOptions = activity.opts;
export let listActivity = activity.fetcher;

let integrity = read<T.ActivityIntegrity>("verifyActivity", "/operator.activity.verify", ["Activity"]);
export let verifyActivityOptions = integrity.opts;

// ---- Announcements ------------------------------------------------------------------------------

let announcements = read<{announcements: T.Announcement[]}>("listAnnouncements", "/operator.announcements.list", ["Announcements"]);
export let listAnnouncementsOptions = announcements.opts;
export let createAnnouncementMutation = write<T.Announcement, T.CreateAnnouncementData>("/operator.announcements.create");
export let endAnnouncementMutation = write<T.Announcement, {id: string}>("/operator.announcements.end");

// ---- Access control -----------------------------------------------------------------------------

let accessResources = read<{resources: T.AccessResource[]}>("listAccessResources", "/operator.access.resources", ["Access"]);
export let listAccessResourcesOptions = accessResources.opts;

let roles = read<{roles: T.Role[]}>("listRoles", "/operator.roles.list", ["Access"]);
export let listRolesOptions = roles.opts;

let role = read<T.Role, {id: string}>("getRole", "/operator.roles.get", ["Access"]);
export let getRoleOptions = role.opts;

export let createRoleMutation = write<T.Role, T.CreateRoleData>("/operator.roles.create");
export let updateRoleMutation = write<T.Role, T.UpdateRoleData>("/operator.roles.update");
export let deleteRoleMutation = write<{id: string}, {id: string}>("/operator.roles.delete");

// ---- Saved views and bulk actions ---------------------------------------------------------------

let savedViews = read<{views: T.SavedView[]}>("listSavedViews", "/operator.views.list", ["Views"]);
export let listSavedViewsOptions = savedViews.opts;
export let createSavedViewMutation = write<T.SavedView, T.CreateSavedViewData>("/operator.views.create");
export let updateSavedViewMutation = write<T.SavedView, {id: string; pinned?: boolean; name?: string}>("/operator.views.update");
export let deleteSavedViewMutation = write<{id: string}, {id: string}>("/operator.views.delete");

export let bulkUpdateClientsMutation = write<T.BulkResult, T.BulkUpdateClientsData>("/operator.clients.bulkUpdate");
export let bulkCreateTasksMutation = write<T.BulkResult, T.BulkCreateTasksData>("/operator.tasks.bulkCreate");
export let bulkSendRemindersMutation = write<T.BulkResult, T.BulkRemindData>("/operator.billing.sendReminders");

// ---- Notifications ------------------------------------------------------------------------------

let teamNotifications = read<T.TeamNotificationSettings>("getTeamNotifications", "/operator.notifications.team.get", ["Notifications"]);
export let getTeamNotificationsOptions = teamNotifications.opts;
export let updateTeamNotificationsMutation = write<T.TeamNotificationSettings, T.TeamNotificationSettings>("/operator.notifications.team.update");
export let sendTestNotificationMutation = write<{sentAt: string}, {target: "team" | "me"}>("/operator.notifications.test");

let myNotifications = read<T.MyNotificationSettings>("getMyNotifications", "/operator.notifications.me.get", ["Notifications"]);
export let getMyNotificationsOptions = myNotifications.opts;
export let updateMyNotificationsMutation = write<T.MyNotificationSettings, T.MyNotificationSettings>("/operator.notifications.me.update");

let digestPreview = read<{text: string}>("getDigestPreview", "/operator.notifications.me.preview", ["Notifications"]);
export let getDigestPreviewOptions = digestPreview.opts;

// ---- Team ---------------------------------------------------------------------------------------

let operators = read<{operators: T.Operator[]}>("listOperators", "/operator.team.list", ["Team"]);
export let listOperatorsOptions = operators.opts;
export let inviteOperatorMutation = write<T.Operator, T.InviteOperatorData>("/operator.team.invite");
export let updateOperatorMutation = write<T.Operator, T.UpdateOperatorData>("/operator.team.update");
