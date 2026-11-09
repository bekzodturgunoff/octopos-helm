// The contract between Helm and the operator API.
//
// Every type here has a twin in api-spec/operator.yml, field for field, and the names follow the
// shapes @yeahuz/kdsx-api already uses (Money, SubscriptionStatus, BillingVendor, FleetNode), so a
// backend that implements the spec can be generated into kdsx-api and these imports swapped over
// without touching a page. Change one, change the other.

// ---- Shared -----------------------------------------------------------------------------------

/** Same shape as kdsx-api's Money: amount is minor units, display is already formatted by the server. */
export type Money = {
  amount: number;
  majorAmount: number;
  currency: string;
  display: string;
};

/** Same shape as kdsx-api's Error response. */
export type ApiErrorBody = {
  message: string;
  status: number;
  code: string;
  traceID: string;
};

export type Page<T> = {
  items: T[];
  page: number;
  pages: number;
  total: number;
};

export type PageQuery = {
  page?: number;
  pageSize?: number;
};

// ---- Operators (the Octopos team) -------------------------------------------------------------

export type OperatorStatus = "active" | "invited" | "disabled";

export type Capability =
  | "client.read"
  | "client.write"
  | "client.impersonate"
  | "billing.read"
  | "billing.write"
  | "fleet.read"
  | "fleet.write"
  | "task.write"
  | "announcement.write"
  | "team.read"
  | "team.write"
  | "role.read"
  | "role.write"
  | "audit.read"
  | "report.read";

/**
 * How far a permission reaches — Helm's version of the dash's tenant/location/own. "assigned" limits
 * it to the clients the operator is account manager for, so a role can be built for someone who
 * looks after their own book and nobody else's.
 */
export type PermissionScope = "all" | "assigned";

export type Permission = {
  capability: Capability | "*";
  /** Absent for a capability that has no scopes. */
  scope?: PermissionScope;
};

export type RoleRef = {id: string; name: string};

export type Role = {
  id: string;
  name: string;
  description: string;
  /** Built in (Owner): cannot be deleted and its permissions cannot be edited, so the team can never lock itself out. */
  internal: boolean;
  permissions: Permission[];
  memberCount: number;
  createdAt: string;
};

export type CreateRoleData = {name: string; description?: string; permissions: Permission[]};
export type UpdateRoleData = {id: string; name?: string; description?: string; permissions?: Permission[]};

/** One entry in the permission catalog: what can be granted, and at which scopes. */
export type AccessCapability = {
  value: Capability;
  name: string;
  description?: string;
  /** Empty when the capability is not about clients and so has nothing to narrow. */
  scopes: PermissionScope[];
};

/** A group of capabilities, as the dash's Resource is. */
export type AccessResource = {
  code: string;
  name: string;
  capabilities: AccessCapability[];
};

export type OperatorRef = {
  id: string;
  name: string;
};

export type Operator = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: RoleRef;
  status: OperatorStatus;
  /** Signs in with an authenticator code as well as the password. */
  twoFactorEnabled: boolean;
  lastSeenAt?: string;
  createdAt: string;
};

/**
 * The signed-in operator. permissions follows kdsx-api's SignedInUser — a capability is granted when
 * its key is present and truthy, "*" grants everything — with the scope as the value, so a check
 * that only asks "may they?" stays a truthiness test.
 */
export type SignedInOperator = Operator & {
  permissions: Partial<Record<Capability | "*", PermissionScope | true>>;
  /** The team requires two-factor and this operator has not set it up; Helm sends them to set-up. */
  mustSetUpTwoFactor?: boolean;
};

export type SignInData = {email: string; password: string};
/** Either signed in, or one step short: the password was right and a code is needed. */
export type SignInResult = {sessionID: string; operator: SignedInOperator; twoFactorRequired?: false} | {twoFactorRequired: true; challengeID: string; setupRequired?: boolean};
export type VerifyTwoFactorData = {challengeID: string; code: string};

export type TwoFactorSetup = {secret: string; otpauthURL: string};
export type TwoFactorEnabled = {recoveryCodes: string[]};

/**
 * A fresh proof, minutes old, that the person at the keyboard is the operator — asked before the
 * actions that are hard to take back. Sent as X-Step-Up on the risky request.
 */
export type StepUpResult = {token: string; expiresAt: string};
export type StepUpData = {code?: string; password?: string};

export type SecuritySettings = {
  /** Everyone must set up two-factor; anyone without it is sent to set-up at their next sign-in. */
  requireTwoFactor: boolean;
  /** Sign everyone out after this many hours idle. */
  idleTimeoutHours: number;
  updatedAt?: string;
  updatedBy?: OperatorRef;
};

/** The activity log's own check: every entry hashes the one before it, so an edit breaks the chain. */
export type ActivityIntegrity = {verified: boolean; events: number; headHash: string; checkedAt: string; brokenAt?: string};

// ---- Plans --------------------------------------------------------------------------------------

export type BillingCycle = "monthly" | "yearly";
export type BillingVendor = "none" | "creem" | "octo" | "payme" | "click" | "dodo";

export type PlanPrice = {
  id: string;
  billingCycle: BillingCycle;
  value: Money;
};

export type PlanFeature = {
  key: string;
  type: "toggle" | "limit";
  limit?: number;
};

export type Plan = {
  id: string;
  slug: string;
  name: string;
  position: number;
  prices: PlanPrice[];
  features: PlanFeature[];
  clientCount: number;
  mrr: Money;
};

export type PlanRef = {id: string; slug: string; name: string};

// ---- Clients (tenants) --------------------------------------------------------------------------

export type SubscriptionStatus = "pending" | "active" | "canceled" | "scheduledCancel" | "pastDue" | "expired" | "trialing";
export type ClientStatus = "onboarding" | "active" | "suspended" | "churned";
export type HealthGrade = "good" | "watch" | "atRisk";
export type BusinessType = "restaurant" | "cafe" | "fastFood" | "bar" | "bakery" | "retail" | "other";

/**
 * Computed by the server, not here: it is the number every list sorts by, and two clients that
 * compute it differently would disagree about who to call first. Each factor is 0–100.
 */
export type ClientHealth = {
  score: number;
  grade: HealthGrade;
  payment: number;
  fleet: number;
  activity: number;
};

export type ClientSubscription = {
  id: string;
  status: SubscriptionStatus;
  plan: PlanRef;
  billingCycle: BillingCycle;
  vendor: BillingVendor;
  /** The provider charges a saved card itself — the renewal needs nobody to remember it. */
  nativeBilling: boolean;
  amount: Money;
  periodStart: string;
  periodEnd: string;
  trialEndsAt?: string;
  canceledAt?: string;
  pendingPlan?: PlanRef;
};

export type ClientInstallations = {
  total: number;
  healthy: number;
  degraded: number;
  failing: number;
  offline: number;
};

export type ClientContact = {
  name: string;
  phone?: string;
  email?: string;
  telegram?: string;
  role?: string;
};

export type Client = {
  id: string;
  name: string;
  /** The dash subdomain, e.g. "sushi-panda" for sushi-panda.dash.octopos.uz. */
  slug: string;
  businessType: BusinessType;
  status: ClientStatus;
  city?: string;
  owner: ClientContact;
  subscription?: ClientSubscription;
  /** What the client owes right now across open invoices. Zero when nothing is due. */
  balanceDue: Money;
  mrr: Money;
  health: ClientHealth;
  installations: ClientInstallations;
  locationsCount: number;
  usersCount: number;
  accountManager?: OperatorRef;
  tags: string[];
  /** Present until every onboarding step is done; the list shows it as a progress bar. */
  onboarding?: OnboardingSummary;
  lastActiveAt?: string;
  createdAt: string;
};

export type OnboardingStepKey = "signed" | "installBooked" | "installed" | "menuLoaded" | "staffAdded" | "trained" | "firstSale" | "firstPayment";

export type OnboardingStep = {
  key: OnboardingStepKey;
  done: boolean;
  doneAt?: string;
  doneBy?: OperatorRef;
  /** Ticked by the server from what the client does (first sale, first payment); not by hand. */
  automatic: boolean;
};

export type OnboardingSummary = {
  done: number;
  total: number;
  /** Days since the client signed. */
  day: number;
  /** Behind the expected pace: not installed by day 7, or no sale 7 days after install. */
  stalled: boolean;
  nextStep?: OnboardingStepKey;
};

export type ClientOnboarding = OnboardingSummary & {
  steps: OnboardingStep[];
  /** Days from signing to the first sale — the onboarding number that predicts who stays. */
  daysToFirstSale?: number;
  completedAt?: string;
};

export type UpdateOnboardingData = {clientID: string; key: OnboardingStepKey; done: boolean};

export type ClientLocation = {
  id: string;
  name: string;
  address?: string;
  /** Where the branch is, as the client set it in their dash for delivery. Absent until they do. */
  latitude?: number;
  longitude?: number;
  /** The branch's own phone, when it has one. */
  phone?: string;
  installations: number;
};

/** One branch on the map: the place, whose it is, and the state of its tills. */
export type ClientPlace = {
  clientID: string;
  clientName: string;
  slug: string;
  clientStatus: ClientStatus;
  grade: HealthGrade;
  balanceDue: Money;
  accountManager?: OperatorRef;
  ownerName: string;
  ownerPhone?: string;
  city?: string;
  location: ClientLocation & {latitude: number; longitude: number};
  /** This branch's installations only, counted the way the client's own are. */
  installations: ClientInstallations;
};

export type ClientPlaces = {
  items: ClientPlace[];
  /** Branches with no point set yet, which the map cannot draw. */
  unplaced: number;
};

/** The app support connects with. "other" is anything Helm has no link for. */
export type RemoteApp = "anydesk" | "rustdesk" | "teamviewer" | "other";

/**
 * A machine at the client that support can reach remotely (AnyDesk, RustDesk, TeamViewer…): a till,
 * the local server, the office PC. Only the ID is kept — the unattended-access password never lives in Helm, so a leaked console
 * is not a leaked key to every till; `passwordNote` says where the team keeps it.
 */
export type RemoteAccess = {
  id: string;
  label: string;
  app: RemoteApp;
  /** The ID the app shows on the machine, without spaces. */
  remoteID: string;
  /** What "other" is, e.g. "Ammyy Admin". */
  appName?: string;
  locationID?: string;
  locationName?: string;
  /** The installation this machine runs, when it is one. */
  nodeID?: string;
  /** Unattended access is set up, so nobody at the client has to accept the connection. */
  unattended: boolean;
  passwordNote?: string;
  note?: string;
  lastConnectedAt?: string;
  lastConnectedBy?: OperatorRef;
  createdAt: string;
};

export type RemoteAccessData = {
  clientID: string;
  label: string;
  app: RemoteApp;
  remoteID: string;
  appName?: string;
  locationID?: string;
  nodeID?: string;
  unattended: boolean;
  passwordNote?: string;
  note?: string;
};

export type UpdateRemoteAccessData = Partial<Omit<RemoteAccessData, "clientID">> & {id: string};

export type ClientDetail = Client & {
  onboardingDetail: ClientOnboarding;
  contacts: ClientContact[];
  remoteAccess: RemoteAccess[];
  locations: ClientLocation[];
  lifetimeValue: Money;
  ordersLast30Days: number;
  /** Orders per day for the last 30 days, oldest first. The sparkline on the client page. */
  dailyOrders: number[];
  suspendedReason?: string;
};

export type ClientSort = "name" | "health" | "mrr" | "renewal" | "createdAt";

export type ListClientsQuery = PageQuery & {
  q?: string;
  status?: ClientStatus;
  subscriptionStatus?: SubscriptionStatus;
  plan?: string;
  health?: HealthGrade;
  accountManagerID?: string;
  /** Only clients with onboarding steps left. */
  onboarding?: boolean;
  sort?: ClientSort;
};

/** Whether a dash address is free, and one that is when it is not. */
export type SlugCheck = {
  slug: string;
  available: boolean;
  reason?: "taken" | "invalid" | "reserved";
  /** A free address close to the one asked for. */
  suggestion?: string;
};

export type CreateClientData = {
  name: string;
  slug: string;
  businessType: BusinessType;
  city?: string;
  owner: ClientContact;
  planID: string;
  billingCycle: BillingCycle;
  trialDays: number;
  accountManagerID?: string;
};

export type UpdateClientData = {
  id: string;
  name?: string;
  city?: string;
  owner?: ClientContact;
  accountManagerID?: string | null;
  tags?: string[];
};

export type SupportMode = "readOnly" | "full";

/**
 * A support session in a client's dash. Time-boxed, with a reason, shown to the client as a banner
 * in their dash for as long as it lasts, and attributed to both the operator and the client.
 * Read-only is the default: most questions are answered by looking.
 */
export type SupportSession = {
  id: string;
  clientID: string;
  clientName: string;
  operator: OperatorRef;
  mode: SupportMode;
  reason: string;
  startedAt: string;
  expiresAt: string;
  endedAt?: string;
};

export type ImpersonateData = {id: string; reason: string; mode: SupportMode; minutes: 15 | 30 | 60};
export type ImpersonationResult = {url: string; expiresAt: string; session: SupportSession};

// ---- Subscriptions ------------------------------------------------------------------------------

export type ChangePlanData = {
  clientID: string;
  planID: string;
  billingCycle: BillingCycle;
  /** periodEnd keeps what they paid for; now prorates. */
  effective: "now" | "periodEnd";
};

export type ExtendSubscriptionData = {clientID: string; days: number; reason: string};
export type CancelSubscriptionData = {clientID: string; atPeriodEnd: boolean; reason: string};

// ---- Billing ------------------------------------------------------------------------------------

export type InvoiceStatus = "draft" | "open" | "paid" | "void" | "uncollectible";
export type InvoiceSource = "subscriptionRenewal" | "subscriptionUpgrade" | "addonChange" | "usage";

export type InvoiceLine = {
  description: string;
  type: "plan" | "addon" | "usage";
  quantity: number;
  unitAmount: Money;
  amount: Money;
};

export type Invoice = {
  id: string;
  number: string;
  clientID: string;
  clientName: string;
  status: InvoiceStatus;
  source: InvoiceSource;
  vendor: BillingVendor;
  total: Money;
  amountDue: Money;
  issuedAt: string;
  dueAt: string;
  paidAt?: string;
  lines: InvoiceLine[];
};

export type ListInvoicesQuery = PageQuery & {status?: InvoiceStatus; clientID?: string; q?: string};

export type PaymentStatus = "succeeded" | "pending" | "failed" | "refunded";
export type PaymentMethod = "card" | "bankTransfer" | "cash" | "manual";

export type Payment = {
  id: string;
  clientID: string;
  clientName: string;
  invoiceID?: string;
  invoiceNumber?: string;
  amount: Money;
  vendor: BillingVendor;
  method: PaymentMethod;
  status: PaymentStatus;
  failureReason?: string;
  recordedBy?: OperatorRef;
  createdAt: string;
};

export type ListPaymentsQuery = PageQuery & {status?: PaymentStatus; vendor?: BillingVendor; clientID?: string};

export type RecordPaymentData = {
  invoiceID: string;
  amount: number;
  method: PaymentMethod;
  paidAt: string;
  note?: string;
};

export type VoidInvoiceData = {id: string; reason: string};

export type Renewal = {
  clientID: string;
  clientName: string;
  plan: PlanRef;
  billingCycle: BillingCycle;
  vendor: BillingVendor;
  nativeBilling: boolean;
  amount: Money;
  dueAt: string;
  subscriptionStatus: SubscriptionStatus;
  /** The last attempt to charge this client failed — the one renewal worth a call before the day. */
  lastPaymentFailed: boolean;
  owner: ClientContact;
};

export type ListRenewalsQuery = {from: string; to: string};

export type ReminderChannel = "sms" | "telegram" | "email";

export type OverdueAccount = {
  clientID: string;
  clientName: string;
  owner: ClientContact;
  plan?: PlanRef;
  invoice: Invoice;
  daysOverdue: number;
  remindersSent: number;
  lastReminderAt?: string;
  /**
   * What happens next on this invoice, from the payment-chasing settings. With automatic chasing on,
   * retries, reminders, the final notice and (if set) suspension happen on their own at nextStepAt;
   * with it off, or for a step the settings leave to people, `manual` is true and someone has to act.
   */
  nextStep: "retry" | "remind" | "finalNotice" | "suspend" | "waitForPromise" | "suspended";
  nextStepAt: string;
  /** The next step waits for someone in the team rather than happening on its own. */
  manual: boolean;
  /** The final notice went out, automatically or by hand. Suspension never comes before it. */
  finalNoticeSentAt?: string;
  /** Every step the automatic chase plans for this invoice, done and to come. Empty when automatic chasing is off. */
  schedule: DunningStep[];
  promise?: PaymentPromise;
  health: ClientHealth;
};

export type DunningStepKind = "retry" | "reminder" | "finalNotice" | "suspend";

export type DunningStep = {
  kind: DunningStepKind;
  /** Days after the invoice was due. */
  day: number;
  at: string;
  status: "done" | "skipped" | "upcoming" | "paused";
};

/**
 * How Helm chases a payment on its own: card retries for autopay clients, reminders for everyone
 * else, a final notice, then suspension. The server runs it; this page only sets it. The defaults
 * follow the common practice of retrying around days 3, 7 and 14 and cutting access only after a
 * grace period, never at the first failure.
 */
export type DunningSettings = {
  enabled: boolean;
  /** Days after a failed card charge to retry it. */
  retryDays: number[];
  /** Days after the due date to remind a client who pays by hand. */
  reminderDays: number[];
  finalNoticeDay: number;
  /** Days after the due date access is suspended, if still unpaid. */
  graceDays: number;
  autoSuspend: boolean;
  /** Restore access the moment the invoice is paid. */
  autoReactivate: boolean;
  channels: ReminderChannel[];
  includePayLink: boolean;
  /** No message goes out between these local times; it waits for the morning. */
  quietHours: {from: string; to: string};
  /** {{name}}, {{business}}, {{amount}}, {{due}}, {{link}} and {{days}} are filled in. */
  templates: {reminder: string; finalNotice: string; suspended: string};
  updatedAt?: string;
  updatedBy?: OperatorRef;
};

export type PaymentPromise = {
  id: string;
  clientID: string;
  invoiceID: string;
  /** The day the client said the money arrives. Reminders pause until then. */
  promisedFor: string;
  amount: Money;
  note?: string;
  status: "pending" | "kept" | "broken";
  createdBy: OperatorRef;
  createdAt: string;
};

export type CreatePromiseData = {invoiceID: string; promisedFor: string; amount?: number; note?: string};

export type PaymentLink = {url: string; vendor: "click" | "payme"; expiresAt: string};

export type SendReminderData = {
  clientID: string;
  invoiceID: string;
  channel: ReminderChannel;
  message?: string;
  /** Append a Click/Payme link that pays this invoice. */
  includePayLink?: boolean;
  /** A final notice counts as one: suspension can follow it once the grace period is over. */
  kind?: "reminder" | "finalNotice";
};

export type WinBackCandidate = {
  clientID: string;
  clientName: string;
  owner: ClientContact;
  lastPlan?: PlanRef;
  lastAmount?: Money;
  churnedAt: string;
  reason?: string;
  monthsActive: number;
  lifetimeValue: Money;
  offerSentAt?: string;
  offer?: {discountPercent: number; months: number};
};

export type SendWinBackOfferData = {clientID: string; discountPercent: number; months: number; channel: ReminderChannel; message: string};

// ---- Fleet --------------------------------------------------------------------------------------

/** kdsx-api's FleetNode, as operator.fleet.nodes returns it, plus whose it is. */
export type FleetNode = {
  nodeID: string;
  tenantID: string;
  tenantName: string;
  runningVersion?: string;
  runningCommit?: string;
  os?: string;
  arch?: string;
  schemaVersion: number;
  startedAt?: string;
  pendingUploads: number;
  behindBy?: number;
  parkedOutstanding?: number;
  oldestParkedAt?: string;
  unresolvedConflicts: number;
  lastExchangeAt?: string;
  agentVersion?: string;
  childState?: "starting" | "running" | "stopped" | "crash_looping";
  restartCount?: number;
  lastExitCode?: number;
  lastStderrTail?: string;
  lastCheckinAt?: string;
  updateState?: "idle" | "downloading" | "staged" | "health_gating" | "rolled_back" | "blocked";
  lastUpdateError?: string;
  targetVersion?: string;
  updatePaused: boolean;
  supervised: boolean;
  lanURLs?: string[];
  lanName?: string;
  location?: {id: string; name: string; explicit: boolean};
  /** Set once the operator retires it; the hub then refuses its exchanges for good. */
  retiredAt?: string;
};

export type ListFleetNodesQuery = {tenantID?: string; version?: string};

/** Same body as kdsx-api's FleetNodeRetireData for the existing operator.fleet.retireNode. */
export type RetireFleetNodeData = {tenantID: string; nodeID: string};

export type SetFleetNodeTargetData = {nodeID: string; targetVersion?: string; updatePaused: boolean};

export type Release = {
  version: string;
  channel: "stable" | "beta";
  releasedAt: string;
  notes: string;
  /** How many installations run it now. */
  running: number;
  /** How many are told to move to it. */
  targeted: number;
  isDefault: boolean;
};

export type SetDefaultReleaseData = {version: string};

// ---- Overview -----------------------------------------------------------------------------------

export type MrrPoint = {
  month: string;
  mrr: number;
  newMrr: number;
  churnedMrr: number;
};

export type OverviewMetrics = {
  currency: string;
  mrr: Money;
  /** Change against the same day last month, as a fraction: 0.04 is +4%. */
  mrrChange: number;
  activeClients: number;
  newClientsThisMonth: number;
  trialing: number;
  pastDueCount: number;
  pastDueAmount: Money;
  /** Logo churn over the last 30 days, as a fraction. */
  churnRate: number;
  renewalsNext7Days: number;
  renewalsNext7DaysAmount: Money;
  /** Share of last month's renewals that collected without anyone stepping in. */
  collectionRate: number;
  /** Median days from signing to first sale, for clients who signed in the last 90 days. */
  medianDaysToFirstSale?: number;
  onboardingClients: number;
  fleet: ClientInstallations;
  mrrHistory: MrrPoint[];
  planMix: {plan: PlanRef; clients: number; mrr: number}[];
};

// ---- Reports ------------------------------------------------------------------------------------

/** One month of recurring revenue, taken apart: where it came from and where it went. */
export type RevenueMovementMonth = {
  month: string;
  startingMrr: number;
  newMrr: number;
  expansionMrr: number;
  reactivationMrr: number;
  /** Negative numbers, so the four movements add up to the change. */
  contractionMrr: number;
  churnedMrr: number;
  endingMrr: number;
  newClients: number;
  churnedClients: number;
};

export type RevenueMovement = {
  currency: string;
  months: RevenueMovementMonth[];
  /** Net revenue retention over the last 12 months: what last year's clients pay now, expansions included. */
  nrr: number;
  /** Gross revenue retention: the same without expansions — what was kept, at most 100%. */
  grr: number;
  /** Average revenue per paying client this month. */
  arpa: number;
};

export type Cohort = {
  /** The month the clients signed. */
  month: string;
  clients: number;
  startingMrr: number;
  /** Share still paying N months after signing, index 0 = the signing month. */
  clientRetention: number[];
  /** Share of the cohort's first-month revenue they pay N months later; above 1 when they grew. */
  revenueRetention: number[];
};

export type AttentionKind = "pastDue" | "paymentFailed" | "trialEnding" | "fleetFailing" | "inactive" | "renewalDue" | "onboardingStalled" | "noFirstSale";

export type AttentionItem = {
  id: string;
  kind: AttentionKind;
  severity: "high" | "medium" | "low";
  clientID: string;
  clientName: string;
  title: string;
  detail: string;
  at: string;
};

// ---- Notes, tasks, activity ---------------------------------------------------------------------

export type Note = {
  id: string;
  clientID: string;
  body: string;
  pinned: boolean;
  author: OperatorRef;
  createdAt: string;
};

export type CreateNoteData = {clientID: string; body: string; pinned?: boolean};

export type TaskStatus = "open" | "done";
export type TaskPriority = "low" | "normal" | "high";
export type TaskKind = "followUp" | "call" | "payment" | "install" | "other";

export type Task = {
  id: string;
  title: string;
  /** Longer notes: what was promised, numbers to call, what to bring to the install. */
  description?: string;
  kind: TaskKind;
  priority: TaskPriority;
  status: TaskStatus;
  clientID?: string;
  clientName?: string;
  assignee?: OperatorRef;
  dueAt?: string;
  completedAt?: string;
  completedBy?: OperatorRef;
  createdBy: OperatorRef;
  createdAt: string;
};

export type ListTasksQuery = {
  status?: TaskStatus;
  assigneeID?: string;
  /** true: only tasks nobody owns yet — the team's triage queue. */
  unassigned?: boolean;
  clientID?: string;
  priority?: TaskPriority;
  kind?: TaskKind;
  /** Title, description or client name. */
  q?: string;
};

export type TaskCounts = {mine: number; everyone: number; unassigned: number; overdue: number; dueToday: number};

export type CreateTaskData = {
  title: string;
  description?: string;
  kind: TaskKind;
  priority: TaskPriority;
  clientID?: string;
  assigneeID?: string;
  dueAt?: string;
};

export type UpdateTaskData = {
  id: string;
  title?: string;
  description?: string;
  kind?: TaskKind;
  status?: TaskStatus;
  assigneeID?: string | null;
  dueAt?: string | null;
  priority?: TaskPriority;
};

export type ActivityCategory = "payment" | "billing" | "support" | "note" | "fleet" | "client" | "team";

export type ActivityEvent = {
  id: string;
  /** SHA-256 of this entry together with the previous entry's hash. */
  hash?: string;
  /** Which filter chip it falls under; derived by the server from the action. */
  category: ActivityCategory;
  actor: {kind: "operator" | "system" | "client"; id?: string; name: string};
  /** Dotted, like the API's own events: "client.suspended", "payment.failed". */
  action: string;
  summary: string;
  clientID?: string;
  clientName?: string;
  createdAt: string;
};

export type ListActivityQuery = PageQuery & {clientID?: string; actorID?: string; category?: ActivityCategory};

// ---- Bulk ----------------------------------------------------------------------------------------

export type BulkUpdateClientsData = {ids: string[]; accountManagerID?: string | null; addTags?: string[]; removeTags?: string[]};
export type BulkCreateTasksData = Omit<CreateTaskData, "clientID"> & {clientIDs: string[]};
export type BulkRemindData = {items: {clientID: string; invoiceID: string}[]; channel: ReminderChannel; includePayLink: boolean};
export type BulkResult = {updated: number; skipped: {id: string; reason: string}[]};

// ---- Notifications ------------------------------------------------------------------------------

export type AlertEvent = "fleetCrashLooping" | "fleetOffline" | "paymentFailed" | "promiseBroken" | "clientSigned" | "trialEnding" | "clientChurned" | "noFirstSale";

/** Where the team hears about trouble without having Helm open: one Telegram group. */
export type TeamNotificationSettings = {
  telegram: {chatID?: string; chatTitle?: string; connected: boolean};
  events: Record<AlertEvent, boolean>;
  /** Wait this long before alerting on a crash loop — a restart that recovers is not news. */
  crashLoopMinutes: number;
  /** An installation offline this long is worth a message. */
  offlineHours: number;
  /** Only alert on offline installations of key accounts; everyone else is in the morning digest. */
  offlineKeyAccountsOnly: boolean;
  updatedAt?: string;
  updatedBy?: OperatorRef;
};

/** One operator's own messages. They go to the Telegram account linked through @octopos_helm_bot. */
export type MyNotificationSettings = {
  digest: {enabled: boolean; time: string; days: "weekdays" | "everyday"};
  includes: {tasks: boolean; renewals: boolean; overdue: boolean; fleet: boolean; myClientsOnly: boolean};
};

/**
 * The operator's Telegram, linked by pressing Start on a one-time link from Helm — nobody types a
 * username, so nobody can point their alerts at someone else's account.
 */
export type TelegramLink = {
  connected: boolean;
  username?: string;
  firstName?: string;
  linkedAt?: string;
};

/** A one-time link: t.me/octopos_helm_bot?start=<code>. Lasts ten minutes and works once. */
export type TelegramLinkCode = {code: string; url: string; expiresAt: string};

/** The bot's side of the link: it hands over the code and the Telegram account that pressed Start. */
export type RedeemTelegramLinkData = {code: string; telegramUserID: number; chatID: number; username?: string; firstName?: string; languageCode?: string};

/**
 * What the bot gets back: a session for that operator, used as their Bearer on every call the bot
 * makes for them — so the bot can only ever do what their role allows. Ended by unlink, by
 * disabling the operator, or by a role change the server treats as a sign-out.
 */
export type RedeemTelegramLinkResult = {sessionID: string; operator: SignedInOperator};

/**
 * What the server sends the bot to deliver (POST <bot>/events). `to` is the team group (its chatID
 * from the team notification settings), or one operator's linked chat. The bot formats it and adds buttons.
 */
export type BotEvent = {
  event: AlertEvent | "taskAssigned" | "digest";
  to: {team: true; chatID: string} | {operatorID: string};
  at: string;
  client?: {id: string; name: string; slug: string};
  node?: {nodeID: string; tenantID: string; restartCount?: number; lastExitCode?: number; offlineSince?: string};
  invoice?: {id: string; number: string; amount: Money; daysOverdue?: number};
  task?: {id: string; title: string; dueAt?: string; createdBy?: OperatorRef};
  /** The digest, already built from the operator's settings; the same text as notifications.me.preview. */
  text?: string;
};

// ---- Announcements ------------------------------------------------------------------------------

export type AnnouncementSeverity = "info" | "warning" | "critical";
export type AnnouncementStatus = "scheduled" | "live" | "ended";

export type AnnouncementAudience = {kind: "all"} | {kind: "plans"; planSlugs: string[]} | {kind: "clients"; clientIDs: string[]};

/** Shown in the clients' dash as a banner, the way SubscriptionExpiryBanner is. */
export type Announcement = {
  id: string;
  title: string;
  body: string;
  severity: AnnouncementSeverity;
  audience: AnnouncementAudience;
  status: AnnouncementStatus;
  startsAt: string;
  endsAt?: string;
  createdBy: OperatorRef;
  createdAt: string;
};

export type CreateAnnouncementData = {
  title: string;
  body: string;
  severity: AnnouncementSeverity;
  audience: AnnouncementAudience;
  startsAt: string;
  endsAt?: string;
};

// ---- Team ---------------------------------------------------------------------------------------

export type InviteOperatorData = {email: string; firstName: string; lastName: string; roleID: string};
export type UpdateOperatorData = {id: string; roleID?: string; status?: OperatorStatus};
