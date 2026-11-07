import type * as T from "../types";

// A believable book of business, generated from a fixed seed so every reload shows the same clients
// and a screenshot in a ticket still matches what the next person sees. Nothing here is real.

let seed = 20261108;
function random() {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
}
function pick<V>(values: readonly V[]): V {
  return values[Math.floor(random() * values.length)];
}
function between(min: number, max: number) {
  return Math.floor(min + random() * (max - min + 1));
}

let counter = 0;
export function id(prefix = "") {
  counter++;
  let hex = (counter * 2654435761).toString(16).padStart(8, "0").slice(-8);
  return `${prefix}${hex}-${(counter * 40503).toString(16).padStart(4, "0").slice(-4)}-4${hex.slice(0, 3)}-a${hex.slice(3, 6)}-${hex}${hex.slice(0, 4)}`;
}

export let NOW = Date.now();
let DAY = 24 * 60 * 60 * 1000;
export function daysFromNow(days: number) {
  return new Date(NOW + days * DAY).toISOString();
}
export function minutesAgo(minutes: number) {
  return new Date(NOW - minutes * 60 * 1000).toISOString();
}

let uzsFormat = new Intl.NumberFormat("ru-RU", {maximumFractionDigits: 0});
export function uzs(major: number): T.Money {
  return {amount: Math.round(major * 100), majorAmount: major, currency: "UZS", display: `${uzsFormat.format(major)} so'm`};
}

// ---- Access control ----------------------------------------------------------------------------

// The permission catalog, grouped the way the role editor shows it. The server owns this list; a
// capability added to the API appears in every role editor without a frontend change.
export let accessResources: T.AccessResource[] = [
  {
    code: "clients",
    name: "Clients",
    capabilities: [
      {value: "client.read", name: "View clients", description: "Lists, client pages, notes and the overview", scopes: ["all", "assigned"]},
      {value: "client.write", name: "Manage clients", description: "Create, edit, suspend and reactivate", scopes: ["all", "assigned"]},
      {value: "client.impersonate", name: "Open a client's dash", description: "Time-boxed support sessions, logged with a reason", scopes: ["all", "assigned"]},
    ],
  },
  {
    code: "billing",
    name: "Billing",
    capabilities: [
      {value: "billing.read", name: "View billing", description: "Renewals, overdue, invoices, payments and plans", scopes: ["all", "assigned"]},
      {value: "billing.write", name: "Manage billing", description: "Record payments, remind, void, change plans, extend", scopes: ["all", "assigned"]},
    ],
  },
  {
    code: "fleet",
    name: "Fleet",
    capabilities: [
      {value: "fleet.read", name: "View installations", description: "Health, versions and errors of every installation", scopes: []},
      {value: "fleet.write", name: "Manage installations", description: "Pin versions, pause updates, retire, roll out releases", scopes: []},
    ],
  },
  {
    code: "work",
    name: "Tasks and announcements",
    capabilities: [
      {value: "task.write", name: "Create tasks", description: "Assign follow-ups to anyone on the team", scopes: []},
      {value: "announcement.write", name: "Announcements", description: "Publish banners to clients' dashes", scopes: []},
    ],
  },
  {
    code: "team",
    name: "Team and access",
    capabilities: [
      {value: "team.read", name: "View team", scopes: []},
      {value: "team.write", name: "Manage team", description: "Invite, change roles, disable", scopes: []},
      {value: "role.read", name: "View roles", scopes: []},
      {value: "role.write", name: "Manage roles", description: "Create roles and choose their permissions", scopes: []},
      {value: "audit.read", name: "Activity log", description: "Every change made from Helm", scopes: []},
    ],
  },
];

function grant(capability: T.Capability, scope?: T.PermissionScope): T.Permission {
  let entry = accessResources.flatMap((r) => r.capabilities).find((c) => c.value === capability);
  return entry?.scopes.length ? {capability, scope: scope ?? "all"} : {capability};
}

export let roles: T.Role[] = [
  {id: id("rl"), name: "Owner", description: "Everything, including the team and roles. Built in.", internal: true, permissions: [{capability: "*"}], memberCount: 0, createdAt: daysFromNow(-640)},
  {
    id: id("rl"),
    name: "Manager",
    description: "Runs the client base day to day. Cannot change the team or roles.",
    internal: false,
    permissions: (
      [
        "client.read",
        "client.write",
        "client.impersonate",
        "billing.read",
        "billing.write",
        "fleet.read",
        "fleet.write",
        "task.write",
        "announcement.write",
        "team.read",
        "role.read",
        "audit.read",
      ] as T.Capability[]
    ).map((c) => grant(c)),
    memberCount: 0,
    createdAt: daysFromNow(-500),
  },
  {
    id: id("rl"),
    name: "Support",
    description: "Fixes installations and helps clients in their dash. Reads billing.",
    internal: false,
    permissions: (["client.read", "client.write", "client.impersonate", "billing.read", "fleet.read", "fleet.write", "task.write", "audit.read"] as T.Capability[]).map((c) => grant(c)),
    memberCount: 0,
    createdAt: daysFromNow(-500),
  },
  {
    id: id("rl"),
    name: "Finance",
    description: "Collects: payments, invoices, reminders and plan changes.",
    internal: false,
    permissions: (["client.read", "billing.read", "billing.write", "task.write", "audit.read"] as T.Capability[]).map((c) => grant(c)),
    memberCount: 0,
    createdAt: daysFromNow(-500),
  },
  {
    id: id("rl"),
    name: "Account manager",
    description: "Looks after their own clients only.",
    internal: false,
    permissions: [grant("client.read", "assigned"), grant("client.write", "assigned"), grant("billing.read", "assigned"), grant("task.write")],
    memberCount: 0,
    createdAt: daysFromNow(-120),
  },
];

export function roleRef(role: T.Role): T.RoleRef {
  return {id: role.id, name: role.name};
}

let [ownerRole, managerRole, supportRole, financeRole, accountManagerRole] = roles;

export let operators: T.Operator[] = [
  {
    id: id("op"),
    firstName: "Bekzod",
    lastName: "Turgunov",
    email: "bekzod@octopos.uz",
    role: roleRef(ownerRole),
    status: "active",
    twoFactorEnabled: false,
    lastSeenAt: minutesAgo(2),
    createdAt: daysFromNow(-640),
  },
  {
    id: id("op"),
    firstName: "Dilnoza",
    lastName: "Karimova",
    email: "dilnoza@octopos.uz",
    role: roleRef(managerRole),
    status: "active",
    twoFactorEnabled: true,
    lastSeenAt: minutesAgo(35),
    createdAt: daysFromNow(-420),
  },
  {
    id: id("op"),
    firstName: "Jasur",
    lastName: "Aliyev",
    email: "jasur@octopos.uz",
    role: roleRef(supportRole),
    status: "active",
    twoFactorEnabled: false,
    lastSeenAt: minutesAgo(8),
    createdAt: daysFromNow(-300),
  },
  {
    id: id("op"),
    firstName: "Madina",
    lastName: "Rashidova",
    email: "madina@octopos.uz",
    role: roleRef(financeRole),
    status: "active",
    twoFactorEnabled: true,
    lastSeenAt: minutesAgo(190),
    createdAt: daysFromNow(-210),
  },
  {
    id: id("op"),
    firstName: "Aziz",
    lastName: "Hamidov",
    email: "aziz@octopos.uz",
    role: roleRef(accountManagerRole),
    status: "active",
    twoFactorEnabled: false,
    lastSeenAt: minutesAgo(55),
    createdAt: daysFromNow(-110),
  },
  {id: id("op"), firstName: "Sardor", lastName: "Yusupov", email: "sardor@octopos.uz", role: roleRef(supportRole), status: "invited", twoFactorEnabled: false, createdAt: daysFromNow(-2)},
];

export function recountRoles() {
  for (let role of roles) role.memberCount = operators.filter((o) => o.role.id === role.id && o.status !== "disabled").length;
}
recountRoles();

export function operatorRef(operator: T.Operator): T.OperatorRef {
  return {id: operator.id, name: `${operator.firstName} ${operator.lastName}`};
}

// ---- Plans --------------------------------------------------------------------------------------

function plan(slug: string, name: string, position: number, monthly: number, features: T.PlanFeature[]): T.Plan {
  return {
    id: id("pl"),
    slug,
    name,
    position,
    prices: [
      {id: id("pr"), billingCycle: "monthly", value: uzs(monthly)},
      {id: id("pr"), billingCycle: "yearly", value: uzs(monthly * 10)},
    ],
    features,
    clientCount: 0,
    mrr: uzs(0),
  };
}

export let plans: T.Plan[] = [
  plan("starter", "Starter", 1, 290000, [
    {key: "PointOfSale", type: "toggle"},
    {key: "KitchenDisplay", type: "toggle"},
    {key: "QRMenu", type: "toggle"},
    {key: "BasicReports", type: "toggle"},
    {key: "CreateLocation", type: "limit", limit: 1},
    {key: "BasicSupport", type: "toggle"},
  ]),
  plan("growth", "Growth", 2, 590000, [
    {key: "PointOfSale", type: "toggle"},
    {key: "KitchenDisplay", type: "toggle"},
    {key: "Inventory", type: "toggle"},
    {key: "StaffPermissions", type: "toggle"},
    {key: "Finance", type: "toggle"},
    {key: "AdvancedAnalytics", type: "toggle"},
    {key: "CreateLocation", type: "limit", limit: 3},
    {key: "BasicSupport", type: "toggle"},
  ]),
  plan("scale", "Scale", 3, 1190000, [
    {key: "PointOfSale", type: "toggle"},
    {key: "Inventory", type: "toggle"},
    {key: "SharedInventory", type: "toggle"},
    {key: "MultiLocationManagement", type: "toggle"},
    {key: "CentralizedReporting", type: "toggle"},
    {key: "APIAccess", type: "toggle"},
    {key: "Payroll", type: "toggle"},
    {key: "CreateLocation", type: "limit", limit: 25},
    {key: "PrioritySupport", type: "toggle"},
  ]),
];

export function planRef(p: T.Plan): T.PlanRef {
  return {id: p.id, slug: p.slug, name: p.name};
}

export function planPrice(p: T.Plan, cycle: T.BillingCycle) {
  return p.prices.find((price) => price.billingCycle === cycle)!.value;
}

// ---- Clients ------------------------------------------------------------------------------------

let NAMES = [
  "Rayhon Milliy Taomlar",
  "Caravan Restaurant",
  "Bon! Cafe",
  "Oqtepa Lavash",
  "Afsona",
  "Navvat",
  "Besh Qozon",
  "Choyxona No.1",
  "Samarkand Darvoza",
  "Kafe Shams",
  "Lali Coffee",
  "Bodrum Kebab",
  "Plov Center",
  "Tashkent Burger Co.",
  "Sirius Pizza",
  "Grand Bukhara",
  "Gijduvon Kabob",
  "Mevaxona",
  "Chorsu Non",
  "Yasmin Bakery",
  "Black Bear Coffee",
  "Feed Up Express",
  "Sushi Ten",
  "Khiva Garden",
  "Andijon Somsa",
  "Mono Bar",
  "Green Leaf",
  "Uzbegim",
  "Shirin Patisserie",
  "Novza Market",
  "City Grill",
  "Nonvoy Usta",
  "Tandir House",
  "Kofemaniya",
  "Osh Markazi",
  "Labi Hovuz",
  "Ko'k Choy",
  "Pizza Mania",
  "Fergana Tea House",
  "Retro Diner",
];

let CITIES = ["Tashkent", "Tashkent", "Tashkent", "Samarkand", "Bukhara", "Fergana", "Namangan", "Andijan", "Nukus"];
let FIRST = ["Akmal", "Nodira", "Rustam", "Gulnora", "Shoxrux", "Malika", "Ulug'bek", "Zarina", "Otabek", "Kamola", "Farrux", "Laylo"];
let LAST = ["Tursunov", "Ismoilova", "Nazarov", "Saidova", "Xolmatov", "Ergasheva", "Qodirov", "Mirzayeva", "Abdullayev", "Usmonova"];
let TYPES: T.BusinessType[] = ["restaurant", "restaurant", "cafe", "fastFood", "bar", "bakery", "retail"];

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function phone() {
  return `+998 9${between(0, 9)} ${between(100, 999)} ${between(10, 99)} ${between(10, 99)}`;
}

export type MockClient = T.ClientDetail;

export let healthSettings: T.HealthSettings = {weights: {payment: 40, activity: 35, fleet: 25}, thresholds: {good: 70, watch: 45}};

export function grade(score: number, settings: T.HealthSettings = healthSettings): T.HealthGrade {
  if (score >= settings.thresholds.good) return "good";
  if (score >= settings.thresholds.watch) return "watch";
  return "atRisk";
}

export function scoreWith(health: Pick<T.ClientHealth, "payment" | "fleet" | "activity">, settings: T.HealthSettings = healthSettings) {
  let w = settings.weights;
  return Math.round((health.payment * w.payment + health.fleet * w.fleet + health.activity * w.activity) / 100);
}

export let ONBOARDING_ORDER: T.OnboardingStepKey[] = ["signed", "installBooked", "installed", "menuLoaded", "staffAdded", "trained", "firstSale", "firstPayment"];
let AUTOMATIC: T.OnboardingStepKey[] = ["firstSale", "firstPayment"];

export function onboardingSteps(doneCount: number, signedAt: number, by: T.OperatorRef): T.OnboardingStep[] {
  return ONBOARDING_ORDER.map((key, i) => ({
    key,
    done: i < doneCount,
    doneAt: i < doneCount ? new Date(signedAt + i * 1.3 * 86400000).toISOString() : undefined,
    doneBy: i < doneCount && !AUTOMATIC.includes(key) ? by : undefined,
    automatic: AUTOMATIC.includes(key),
  }));
}

/** The whole picture from the steps: progress, pace, and what comes next. */
export function onboardingOf(steps: T.OnboardingStep[], signedAt: string): T.ClientOnboarding {
  let done = steps.filter((s) => s.done).length;
  let day = Math.floor((Date.now() - Date.parse(signedAt)) / 86400000);
  let installed = steps.find((s) => s.key === "installed");
  let firstSale = steps.find((s) => s.key === "firstSale");
  let installedFor = installed?.doneAt ? Math.floor((Date.now() - Date.parse(installed.doneAt)) / 86400000) : 0;
  let stalled = (!installed?.done && day > 7) || (Boolean(installed?.done) && !firstSale?.done && installedFor > 7);
  return {
    steps,
    done,
    total: steps.length,
    day,
    stalled: done < steps.length && stalled,
    nextStep: steps.find((s) => !s.done)?.key,
    daysToFirstSale: firstSale?.doneAt ? Math.max(0, Math.round((Date.parse(firstSale.doneAt) - Date.parse(signedAt)) / 86400000)) : undefined,
    completedAt: done === steps.length ? steps[steps.length - 1].doneAt : undefined,
  };
}

export function computeHealth(c: Pick<MockClient, "subscription" | "balanceDue" | "installations" | "dailyOrders" | "status">): T.ClientHealth {
  let payment = 100;
  let status = c.subscription?.status;
  if (status === "pastDue") payment = 25;
  else if (status === "expired" || status === "canceled") payment = 10;
  else if (c.balanceDue.majorAmount > 0) payment = 60;
  if (c.status === "suspended") payment = 5;

  let fleetTotal = c.installations.total - 0;
  let fleet = fleetTotal === 0 ? 50 : Math.round(((c.installations.healthy + c.installations.degraded * 0.5) / fleetTotal) * 100);

  let recent = c.dailyOrders.slice(-7).reduce((a, b) => a + b, 0) / 7;
  let earlier = c.dailyOrders.slice(0, 7).reduce((a, b) => a + b, 0) / 7 || 1;
  let trend = recent / earlier;
  let activity = Math.max(0, Math.min(100, Math.round(recent === 0 ? 0 : 40 + trend * 45)));

  let score = scoreWith({payment, fleet, activity});
  return {score, grade: grade(score), payment, fleet, activity};
}

export let clients: MockClient[] = [];
export let fleetNodes: T.FleetNode[] = [];
export let invoices: T.Invoice[] = [];
export let payments: T.Payment[] = [];
export let notes: T.Note[] = [];
export let tasks: T.Task[] = [];
export let activity: T.ActivityEvent[] = [];
export let reminders: Record<string, {count: number; lastAt?: string}> = {};

let VERSIONS = ["2026.11.2", "2026.11.2", "2026.11.2", "2026.11.1", "2026.10.4", "2026.10.4", "2026.09.3"];

type NodeShape = "healthy" | "degraded" | "crashLooping" | "misconfigured" | "offline" | "neverStarted";

function makeNode(client: MockClient, shape: NodeShape, index: number, locationName: string): T.FleetNode {
  let fresh = minutesAgo(between(0, 3));
  let stale = minutesAgo(between(60, 60 * 30));
  let version = pick(VERSIONS);
  let node: T.FleetNode = {
    nodeID: id("nd"),
    tenantID: client.id,
    tenantName: client.name,
    runningVersion: version,
    runningCommit: Math.floor(random() * 0xfffffff).toString(16),
    os: pick(["windows", "linux", "linux"]),
    arch: "amd64",
    schemaVersion: 412,
    startedAt: minutesAgo(between(60, 60 * 24 * 9)),
    pendingUploads: 0,
    behindBy: 0,
    parkedOutstanding: 0,
    unresolvedConflicts: 0,
    lastExchangeAt: fresh,
    agentVersion: "1.4.0",
    childState: "running",
    restartCount: between(0, 2),
    lastCheckinAt: fresh,
    updateState: "idle",
    targetVersion: "2026.11.2",
    updatePaused: false,
    supervised: true,
    lanName: `${client.slug}-${index + 1}.local`,
    lanURLs: [`http://192.168.${between(0, 2)}.${between(10, 250)}:8080`],
    location: {id: id("lc"), name: locationName, explicit: random() > 0.3},
  };
  switch (shape) {
    case "degraded":
      node.pendingUploads = between(4, 60);
      node.behindBy = between(1, 9);
      node.unresolvedConflicts = between(0, 3);
      break;
    case "crashLooping":
      node.lastExchangeAt = stale;
      node.childState = "crash_looping";
      node.restartCount = between(12, 140);
      node.lastExitCode = 1;
      node.lastStderrTail = `panic: runtime error: invalid memory address or nil pointer dereference\n[signal SIGSEGV: segmentation violation code=0x1 addr=0x18 pc=0x9a1c2e]\n\ngoroutine 1 [running]:\ngithub.com/jcbbb/kdsx-api/printing.(*Spooler).Start(...)\n\t/src/printing/spooler.go:212\nmain.run()\n\t/src/cmd/spoke/main.go:88 +0x1c4`;
      break;
    case "misconfigured":
      node.lastExchangeAt = stale;
      node.childState = "crash_looping";
      node.restartCount = between(5, 30);
      node.lastExitCode = 78;
      node.lastStderrTail = "config: HUB_URL is not set\nconfig: refusing to start without a hub to sync with";
      break;
    case "neverStarted":
      node.lastExchangeAt = undefined;
      node.childState = "starting";
      node.runningVersion = undefined;
      break;
    case "offline":
      node.lastExchangeAt = stale;
      node.lastCheckinAt = stale;
      break;
  }
  if (version !== "2026.11.2" && shape === "healthy" && random() > 0.6) {
    node.updateState = pick(["downloading", "staged", "health_gating"]);
  }
  return node;
}

function anydeskID() {
  let digits = random() > 0.5 ? 10 : 9;
  let first = String(between(1, 9));
  return first + Array.from({length: digits - 1}, () => between(0, 9)).join("");
}

function seedCategory(action: string): T.ActivityCategory {
  let head = action.split(".")[0];
  if (head === "payment") return "payment";
  if (head === "billing" || head === "invoice" || head === "subscription") return "billing";
  if (head === "support" || head === "remoteAccess" || action === "client.impersonated") return "support";
  if (head === "note") return "note";
  if (head === "fleet" || head === "release") return "fleet";
  return "client";
}

function makeDailyOrders(trend: "up" | "flat" | "down" | "dead", base: number) {
  return Array.from({length: 30}, (_, i) => {
    let factor = trend === "up" ? 0.7 + i / 50 : trend === "down" ? 1.3 - i / 30 : trend === "dead" ? Math.max(0, 1 - i / 12) : 1;
    let weekend = (i + 2) % 7 < 2 ? 1.35 : 1;
    return Math.max(0, Math.round(base * factor * weekend * (0.85 + random() * 0.3)));
  });
}

// Each client is generated from a story, so the overview has something to say: a few past due,
// a few trials ending, a crash-looping till, one going quiet.
type Story = "steady" | "pastDue" | "failedCard" | "trialEnding" | "trial" | "fleetBroken" | "goingQuiet" | "suspended" | "churned" | "onboarding" | "scheduledCancel";

let STORIES: Story[] = [
  "steady",
  "steady",
  "steady",
  "pastDue",
  "steady",
  "trialEnding",
  "steady",
  "fleetBroken",
  "steady",
  "failedCard",
  "steady",
  "goingQuiet",
  "steady",
  "trial",
  "steady",
  "pastDue",
  "steady",
  "steady",
  "suspended",
  "steady",
  "onboarding",
  "steady",
  "fleetBroken",
  "steady",
  "scheduledCancel",
  "steady",
  "steady",
  "pastDue",
  "churned",
  "steady",
  "trialEnding",
  "steady",
  "steady",
  "failedCard",
  "churned",
  "steady",
  "goingQuiet",
  "steady",
  "churned",
  "steady",
];

let invoiceCounter = 1040;

function makeInvoice(client: MockClient, status: T.InvoiceStatus, issuedDaysAgo: number, amount: T.Money): T.Invoice {
  let sub = client.subscription!;
  let issuedAt = daysFromNow(-issuedDaysAgo);
  invoiceCounter++;
  return {
    id: id("in"),
    number: `OCT-${invoiceCounter}`,
    clientID: client.id,
    clientName: client.name,
    status,
    source: "subscriptionRenewal",
    vendor: sub.vendor,
    total: amount,
    amountDue: status === "paid" || status === "void" ? uzs(0) : amount,
    issuedAt,
    dueAt: daysFromNow(-issuedDaysAgo + 3),
    paidAt: status === "paid" ? daysFromNow(-issuedDaysAgo + between(0, 2)) : undefined,
    lines: [
      {
        description: `${sub.plan.name} plan · ${sub.billingCycle === "yearly" ? "12 months" : "1 month"}`,
        type: "plan",
        quantity: 1,
        unitAmount: amount,
        amount,
      },
    ],
  };
}

function generate() {
  NAMES.forEach((name, index) => {
    let story = STORIES[index];
    let p = story === "trial" || story === "trialEnding" || story === "onboarding" ? plans[1] : pick([plans[0], plans[0], plans[1], plans[1], plans[2]]);
    let cycle: T.BillingCycle = random() > 0.8 ? "yearly" : "monthly";
    let vendor: T.BillingVendor = pick(["click", "payme", "payme", "none"]);
    let created = story === "onboarding" ? between(1, 5) : story === "trial" ? between(11, 14) : story === "trialEnding" ? between(12, 16) : between(40, 700);
    let periodStart = between(1, 29);
    let manager = pick([operators[0], operators[1], operators[2], operators[4], operators[4]]);
    let owner: T.ClientContact = {
      name: `${pick(FIRST)} ${pick(LAST)}`,
      phone: phone(),
      email: `${slugify(name).split("-")[0]}@mail.uz`,
      telegram: `@${slugify(name).replace(/-/g, "_")}`,
      role: "Owner",
    };

    let status: T.ClientStatus = story === "suspended" ? "suspended" : story === "churned" ? "churned" : story === "onboarding" ? "onboarding" : "active";
    let subStatus: T.SubscriptionStatus =
      story === "pastDue" || story === "suspended"
        ? "pastDue"
        : story === "trial" || story === "trialEnding" || story === "onboarding"
          ? "trialing"
          : story === "churned"
            ? "expired"
            : story === "scheduledCancel"
              ? "scheduledCancel"
              : "active";

    let amount = planPrice(p, cycle);
    let periodEndDays = story === "trialEnding" ? between(1, 3) : story === "pastDue" || story === "suspended" ? -between(4, 26) : story === "churned" ? -between(20, 50) : 30 - periodStart;
    if (story === "steady" && random() > 0.65) periodEndDays = between(1, 7);

    let locationsCount = p.slug === "scale" ? between(3, 8) : p.slug === "growth" ? between(1, 3) : 1;
    let locations: T.ClientLocation[] = Array.from({length: locationsCount}, (_, i) => ({
      id: id("lc"),
      name: i === 0 ? pick(["Main branch", "Chilonzor", "Yunusobod", "Center"]) : pick(["Sergeli", "Mirzo Ulug'bek", "Olmazor", "Yakkasaroy", "Shayxontohur", "Mall branch"]),
      address: `${pick(CITIES)}, ${pick(["Amir Temur", "Navoi", "Bobur", "Mustaqillik", "Shota Rustaveli"])} ${between(1, 120)}`,
      installations: 0,
    }));

    let trend: "up" | "flat" | "down" | "dead" = story === "goingQuiet" ? "down" : story === "churned" || story === "suspended" ? "dead" : random() > 0.7 ? "up" : "flat";
    // Nobody sells before signing; the installed-but-silent trial is the early-churn case on purpose.
    let dailyOrders = story === "onboarding" || story === "trial" ? Array(30).fill(0) : makeDailyOrders(trend, between(40, 260) * locationsCount).map((orders, i) => (i < 30 - created ? 0 : orders));

    let client: MockClient = {
      id: id("tn"),
      name,
      slug: slugify(name),
      businessType: pick(TYPES),
      status,
      city: pick(CITIES),
      owner,
      subscription: {
        id: id("sb"),
        status: subStatus,
        plan: planRef(p),
        billingCycle: cycle,
        vendor,
        nativeBilling: vendor !== "none" && random() > 0.4,
        amount,
        periodStart: daysFromNow(periodEndDays - (cycle === "yearly" ? 365 : 30)),
        periodEnd: daysFromNow(periodEndDays),
        trialEndsAt: subStatus === "trialing" ? daysFromNow(periodEndDays) : undefined,
        canceledAt: story === "scheduledCancel" || story === "churned" ? daysFromNow(-between(2, 30)) : undefined,
      },
      balanceDue: uzs(0),
      mrr: subStatus === "trialing" || subStatus === "expired" ? uzs(0) : uzs(cycle === "yearly" ? amount.majorAmount / 12 : amount.majorAmount),
      health: {score: 0, grade: "good", payment: 0, fleet: 0, activity: 0},
      installations: {total: 0, healthy: 0, degraded: 0, failing: 0, offline: 0},
      locationsCount,
      usersCount: between(2, 6) * locationsCount,
      accountManager: operatorRef(manager),
      tags: [...(p.slug === "scale" ? ["key account"] : []), ...(story === "goingQuiet" ? ["churn risk"] : []), ...(random() > 0.85 ? ["referral"] : []), ...(random() > 0.9 ? ["fiscal"] : [])],
      lastActiveAt: story === "churned" ? daysFromNow(-between(20, 50)) : story === "goingQuiet" ? daysFromNow(-between(3, 6)) : minutesAgo(between(1, 600)),
      createdAt: daysFromNow(-created),
      onboardingDetail: undefined as unknown as T.ClientOnboarding,
      contacts: [owner, ...(random() > 0.5 ? [{name: `${pick(FIRST)} ${pick(LAST)}`, phone: phone(), role: "Manager"}] : [])],
      remoteAccess: [],
      locations,
      lifetimeValue: uzs(Math.round((created / 30) * amount.majorAmount * (cycle === "yearly" ? 1 / 10 : 1))),
      ordersLast30Days: dailyOrders.reduce((a, b) => a + b, 0),
      dailyOrders,
      suspendedReason: story === "suspended" ? "Unpaid for more than 21 days after three reminders." : undefined,
    };

    // Installations, one or two per location.
    if (story !== "churned") {
      locations.forEach((location, li) => {
        let count = p.slug === "scale" ? between(1, 2) : 1;
        for (let n = 0; n < count; n++) {
          let shape: NodeShape = "healthy";
          if (story === "fleetBroken" && li === 0 && n === 0) shape = pick(["crashLooping", "misconfigured"]);
          else if (story === "suspended") shape = "offline";
          else if (story === "onboarding") shape = "neverStarted";
          else if (random() > 0.93) shape = "offline";
          else if (random() > 0.92) shape = "degraded";
          let node = makeNode(client, shape, fleetNodes.length, location.name);
          location.installations++;
          fleetNodes.push(node);
          // Most tills get AnyDesk at install; a few were set up before that was the rule.
          if (story !== "onboarding" && random() > 0.15) {
            client.remoteAccess.push({
              id: id("ra"),
              label: `${location.name} · ${n === 0 ? `Till ${client.remoteAccess.filter((r) => r.locationID === location.id).length + 1}` : "Server"}`,
              anydeskID: anydeskID(),
              locationID: location.id,
              locationName: location.name,
              nodeID: node.nodeID,
              unattended: random() > 0.3,
              passwordNote: random() > 0.4 ? "Bitwarden → Clients → " + client.name : undefined,
              lastConnectedAt: random() > 0.5 ? daysFromNow(-between(1, 40)) : undefined,
              lastConnectedBy: random() > 0.5 ? operatorRef(operators[2]) : undefined,
              createdAt: daysFromNow(-between(10, 300)),
            });
          }
        }
      });
    }

    // Billing history: paid months behind them, then whatever their story says about now.
    if (story !== "onboarding" && story !== "trial" && story !== "trialEnding") {
      let months = Math.min(6, Math.floor(created / 30));
      for (let m = months; m >= 1; m--) {
        let inv = makeInvoice(client, "paid", m * 30 + between(0, 3), amount);
        invoices.push(inv);
        payments.push({
          id: id("pm"),
          clientID: client.id,
          clientName: client.name,
          invoiceID: inv.id,
          invoiceNumber: inv.number,
          amount,
          vendor,
          method: vendor === "none" ? pick(["bankTransfer", "cash"]) : "card",
          status: "succeeded",
          createdAt: inv.paidAt!,
        });
      }
      if (story === "pastDue" || story === "suspended") {
        let daysAgo = -periodEndDays;
        let inv = makeInvoice(client, "open", daysAgo, amount);
        inv.dueAt = daysFromNow(-daysAgo);
        invoices.push(inv);
        client.balanceDue = amount;
        let sent = story === "suspended" ? 3 : Math.min(2, Math.floor(daysAgo / 7));
        reminders[client.id] = {count: sent, lastAt: sent ? daysFromNow(-between(1, 5)) : undefined};
        if (vendor !== "none") {
          payments.push({
            id: id("pm"),
            clientID: client.id,
            clientName: client.name,
            invoiceID: inv.id,
            invoiceNumber: inv.number,
            amount,
            vendor,
            method: "card",
            status: "failed",
            failureReason: pick(["Insufficient funds", "Card expired", "Declined by issuer"]),
            createdAt: inv.issuedAt,
          });
        }
      }
      if (story === "failedCard") {
        payments.push({
          id: id("pm"),
          clientID: client.id,
          clientName: client.name,
          amount,
          vendor: vendor === "none" ? "payme" : vendor,
          method: "card",
          status: "failed",
          failureReason: pick(["Insufficient funds", "Card expired"]),
          createdAt: daysFromNow(-between(0, 2)),
        });
        client.subscription!.nativeBilling = true;
        client.subscription!.periodEnd = daysFromNow(between(1, 4));
      }
    }

    client.installations = fleetNodes
      .filter((n) => n.tenantID === client.id)
      .reduce(
        (acc, n) => {
          acc.total++;
          let s = n.lastCheckinAt && Date.parse(n.lastCheckinAt) > NOW - 5 * 60000;
          let e = n.lastExchangeAt && Date.parse(n.lastExchangeAt) > NOW - 5 * 60000;
          if (s && e) {
            if (n.pendingUploads || n.behindBy || n.unresolvedConflicts) acc.degraded++;
            else acc.healthy++;
          } else if (s) acc.failing++;
          else acc.offline++;
          return acc;
        },
        {total: 0, healthy: 0, degraded: 0, failing: 0, offline: 0},
      );
    client.health = computeHealth(client);
    // Onboarding by story: settled clients finished it long ago; trials are mid-way, one of them
    // installed with no sale yet — the early-churn shape worth a call.
    let signedAt = Date.parse(client.createdAt);
    let doneCount = story === "onboarding" ? 2 : story === "trial" ? 3 : story === "trialEnding" ? 7 : 8;
    let steps = onboardingSteps(doneCount, signedAt, client.accountManager ?? operatorRef(operators[1]));
    if (story === "trial") {
      let installed = steps.find((s) => s.key === "installed")!;
      installed.doneAt = daysFromNow(-9);
    }
    client.onboardingDetail = onboardingOf(steps, client.createdAt);
    clients.push(client);
  });

  for (let p of plans) {
    let on = clients.filter((c) => c.subscription?.plan.id === p.id && c.status !== "churned");
    p.clientCount = on.length;
    p.mrr = uzs(on.reduce((sum, c) => sum + c.mrr.majorAmount, 0));
  }

  // Notes and tasks on the clients that need them.
  let [owner, manager, support, finance] = operators;
  for (let c of clients) {
    if (c.subscription?.status === "pastDue") {
      notes.push({
        id: id("nt"),
        clientID: c.id,
        body: `Called ${c.owner.name}. Says the transfer goes out Friday — accountant is on leave.`,
        pinned: true,
        author: operatorRef(finance),
        createdAt: daysFromNow(-2),
      });
      tasks.push({
        id: id("tk"),
        title: `Collect ${c.balanceDue.display} from ${c.name}`,
        description: `Owner: ${c.owner.name}${c.owner.phone ? `, ${c.owner.phone}` : ""}. Agree a date, then record the payment on the invoice.`,
        kind: "payment",
        priority: "high",
        status: "open",
        clientID: c.id,
        clientName: c.name,
        assignee: operatorRef(finance),
        dueAt: daysFromNow(between(-1, 2)),
        createdBy: operatorRef(manager),
        createdAt: daysFromNow(-4),
      });
    }
    if (c.subscription?.status === "trialing" && c.status !== "onboarding") {
      tasks.push({
        id: id("tk"),
        title: `Trial ends soon — walk ${c.name} through the plans`,
        kind: "call",
        priority: "normal",
        status: "open",
        clientID: c.id,
        clientName: c.name,
        assignee: operatorRef(manager),
        dueAt: daysFromNow(1),
        createdBy: operatorRef(owner),
        createdAt: daysFromNow(-3),
      });
    }
    if (c.status === "onboarding") {
      notes.push({
        id: id("nt"),
        clientID: c.id,
        body: "Signed at the HoReCa expo. Two tills and a kitchen screen; install booked for this week.",
        pinned: false,
        author: operatorRef(manager),
        createdAt: daysFromNow(-1),
      });
      tasks.push({
        id: id("tk"),
        title: `Install tills at ${c.name}`,
        description: "Bring two tills, the kitchen printer and a spare router. Seed the installation from the hub before leaving the office.",
        kind: "install",
        priority: "high",
        status: "open",
        clientID: c.id,
        clientName: c.name,
        assignee: operatorRef(support),
        dueAt: daysFromNow(2),
        createdBy: operatorRef(manager),
        createdAt: daysFromNow(-1),
      });
    }
    if (c.tags.includes("churn risk")) {
      tasks.push({
        id: id("tk"),
        title: `Orders down at ${c.name} — check in`,
        kind: "followUp",
        priority: "normal",
        status: "open",
        clientID: c.id,
        clientName: c.name,
        assignee: c.accountManager,
        dueAt: daysFromNow(3),
        createdBy: operatorRef(owner),
        createdAt: daysFromNow(-1),
      });
    }
  }
  tasks.push({
    id: id("tk"),
    title: "Review November price change with finance",
    kind: "other",
    priority: "low",
    status: "open",
    createdBy: operatorRef(owner),
    createdAt: daysFromNow(-6),
    dueAt: daysFromNow(7),
    assignee: operatorRef(owner),
  });
  tasks.push({
    id: id("tk"),
    title: "Send release notes for 2026.11.2",
    kind: "other",
    priority: "normal",
    status: "done",
    createdBy: operatorRef(owner),
    createdAt: daysFromNow(-5),
    completedAt: daysFromNow(-3),
    completedBy: operatorRef(support),
    assignee: operatorRef(support),
  });
  tasks.push(
    {
      id: id("tk"),
      title: `Call ${clients[4].name} about a second location`,
      kind: "call",
      priority: "normal",
      status: "done",
      clientID: clients[4].id,
      clientName: clients[4].name,
      createdBy: operatorRef(owner),
      createdAt: daysFromNow(-2),
      completedAt: minutesAgo(90),
      completedBy: operatorRef(owner),
      assignee: operatorRef(owner),
    },
    {id: id("tk"), title: "Renew the Payme merchant certificate", kind: "other", priority: "high", status: "open", createdBy: operatorRef(finance), createdAt: daysFromNow(-1), dueAt: daysFromNow(5)},
    {id: id("tk"), title: "Find out why a kitchen screen disconnects at night", kind: "followUp", priority: "normal", status: "open", createdBy: operatorRef(support), createdAt: minutesAgo(300)},
    {
      id: id("tk"),
      title: "Quarterly check-in with every Scale client",
      description: "Ask what they would pay more for. Note answers on each client.",
      kind: "call",
      priority: "low",
      status: "open",
      createdBy: operatorRef(owner),
      createdAt: daysFromNow(-3),
      dueAt: daysFromNow(10),
      assignee: operatorRef(owner),
    },
  );

  // Activity: a little of everything, newest first.
  let feed: Omit<T.ActivityEvent, "id" | "category">[] = [];
  // Notes say what they say in the timeline, not just that one was written.
  for (let n of notes)
    feed.push({
      actor: {kind: "operator", id: n.author.id, name: n.author.name},
      action: "note.created",
      summary: `Note: ${n.body}`,
      clientID: n.clientID,
      clientName: clients.find((c) => c.id === n.clientID)?.name,
      createdAt: n.createdAt,
    });
  for (let inv of invoices) {
    feed.push({
      actor: {kind: "system", name: "Billing"},
      action: "invoice.issued",
      summary: `Issued ${inv.number} for ${inv.total.display}`,
      clientID: inv.clientID,
      clientName: inv.clientName,
      createdAt: inv.issuedAt,
    });
  }
  for (let c of clients) {
    feed.push({
      actor: {kind: "operator", id: c.accountManager?.id, name: c.accountManager?.name ?? "Helm"},
      action: "client.created",
      summary: `Signed on ${c.subscription?.plan.name ?? "—"}`,
      clientID: c.id,
      clientName: c.name,
      createdAt: c.createdAt,
    });
  }
  for (let p of payments) {
    feed.push({
      actor: {kind: "system", name: p.vendor === "none" ? "Billing" : p.vendor === "click" ? "Click" : "Payme"},
      action: p.status === "failed" ? "payment.failed" : "payment.succeeded",
      summary: p.status === "failed" ? `Charge of ${p.amount.display} failed: ${p.failureReason}` : `Collected ${p.amount.display}`,
      clientID: p.clientID,
      clientName: p.clientName,
      createdAt: p.createdAt,
    });
  }
  for (let c of clients.filter((c) => c.status === "suspended")) {
    feed.push({
      actor: {kind: "operator", id: finance.id, name: operatorRef(finance).name},
      action: "client.suspended",
      summary: c.suspendedReason!,
      clientID: c.id,
      clientName: c.name,
      createdAt: daysFromNow(-1),
    });
  }
  for (let n of fleetNodes.filter((n) => n.lastExitCode !== undefined)) {
    feed.push({
      actor: {kind: "system", name: "Fleet"},
      action: "fleet.crashLooping",
      summary: `${n.lanName} restarted ${n.restartCount} times`,
      clientID: n.tenantID,
      clientName: n.tenantName,
      createdAt: minutesAgo(between(20, 600)),
    });
  }
  feed.push({actor: {kind: "operator", id: owner.id, name: operatorRef(owner).name}, action: "release.default", summary: "Made 2026.11.2 the default release", createdAt: daysFromNow(-3)});
  feed.push({
    actor: {kind: "operator", id: support.id, name: operatorRef(support).name},
    action: "client.impersonated",
    summary: "Opened the dash as support to fix a printer route",
    clientID: clients[4].id,
    clientName: clients[4].name,
    createdAt: minutesAgo(80),
  });
  feed.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  activity.push(...feed.map((e) => ({...e, id: id("ev")}) as T.ActivityEvent));
  for (let event of activity) event.category ??= seedCategory(event.action);
}

generate();

// ---- Releases, announcements --------------------------------------------------------------------

export let releases: T.Release[] = [
  {
    version: "2026.11.2",
    channel: "stable",
    releasedAt: daysFromNow(-4),
    notes: "Label printing on shelf stock, faster sync after a long offline stretch, Payme receipt fix.",
    running: 0,
    targeted: 0,
    isDefault: true,
  },
  {version: "2026.11.1", channel: "stable", releasedAt: daysFromNow(-11), notes: "Exchange rates and revaluation, retire installations from the hub.", running: 0, targeted: 0, isDefault: false},
  {version: "2026.10.4", channel: "stable", releasedAt: daysFromNow(-24), notes: "Document exports, kitchen display reconnect.", running: 0, targeted: 0, isDefault: false},
  {version: "2026.09.3", channel: "stable", releasedAt: daysFromNow(-52), notes: "Supervisor agent 1.4 with health-gated updates.", running: 0, targeted: 0, isDefault: false},
  {version: "2026.11.3-beta.1", channel: "beta", releasedAt: daysFromNow(-1), notes: "Delivery zones on the map, fiscal module for Uzbekistan's OFD.", running: 0, targeted: 0, isDefault: false},
];

export let announcements: T.Announcement[] = [
  {
    id: id("an"),
    title: "Scheduled maintenance Sunday 03:00–04:00",
    body: "The dash and online ordering will be unavailable for up to an hour while we upgrade the database. Tills keep selling offline and sync afterwards.",
    severity: "warning",
    audience: {kind: "all"},
    status: "scheduled",
    startsAt: daysFromNow(2),
    endsAt: daysFromNow(3),
    createdBy: operatorRef(operators[0]),
    createdAt: daysFromNow(-1),
  },
  {
    id: id("an"),
    title: "New: exchange rates and revaluation",
    body: "Growth and Scale clients can now price in USD and revalue stock when the rate moves. See Finance → Rates.",
    severity: "info",
    audience: {kind: "plans", planSlugs: ["growth", "scale"]},
    status: "live",
    startsAt: daysFromNow(-6),
    createdBy: operatorRef(operators[1]),
    createdAt: daysFromNow(-6),
  },
  {
    id: id("an"),
    title: "Payme outage resolved",
    body: "Card payments through Payme failed between 14:10 and 14:55. Charges have been retried.",
    severity: "critical",
    audience: {kind: "all"},
    status: "ended",
    startsAt: daysFromNow(-20),
    endsAt: daysFromNow(-19),
    createdBy: operatorRef(operators[0]),
    createdAt: daysFromNow(-20),
  },
];

export function recountReleases() {
  for (let r of releases) {
    r.running = fleetNodes.filter((n) => n.runningVersion === r.version && !n.retiredAt).length;
    r.targeted = fleetNodes.filter((n) => n.targetVersion === r.version && !n.retiredAt).length;
  }
}
recountReleases();
