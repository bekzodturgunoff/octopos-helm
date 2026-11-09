import {ApiError, currentStepUp, type Method, type RequestOptions} from "../client";
import {randomSecret, sha256, verifyTotp} from "./totp";
import type * as T from "../types";
import {getSession} from "@/constants";
import {appLabel, formatRemoteID, remoteApp, REMOTE_APPS} from "@/lib/remote-apps";
import {DASH_DOMAIN, dashUrl, SLUG_PATTERN} from "@/lib/dash";
import spec from "../../../api-spec/operator.yml?raw";
import {
  activity,
  announcements,
  clients,
  computeHealth,
  countInstallations,
  onboardingOf,
  onboardingSteps,
  daysFromNow,
  fleetNodes,
  id,
  invoices,
  notes,
  NOW,
  operatorRef,
  operators,
  payments,
  planPrice,
  planRef,
  plans,
  recountReleases,
  releases,
  reminders,
  accessResources,
  recountRoles,
  roleRef,
  roles,
  tasks,
  uzs,
  type MockClient,
} from "./data";

// An in-browser stand-in for every operator.* endpoint in api-spec/operator.yml. It answers with
// the same shapes and the same error body the real API will, keeps what you change for as long as
// the tab lives, and waits a little so loading states are seen rather than imagined.

type Handler = (input: {query: Record<string, string | undefined>; body: Record<string, unknown>; me: T.Operator | undefined}) => unknown | Promise<unknown>;

function fail(status: number, code: string, message: string): never {
  throw new ApiError({status, code, message, traceID: `mock-${Math.random().toString(16).slice(2, 10)}`});
}

function requireMe(me: T.Operator | undefined) {
  if (!me) fail(401, "UNAUTHENTICATED", "Your session has ended. Sign in again.");
  return me;
}

function findClient(clientID: unknown) {
  let client = clients.find((c) => c.id === clientID);
  if (!client) fail(404, "CLIENT_NOT_FOUND", "No client with that id.");
  return client;
}

function paginate<V>(items: V[], query: {page?: string; pageSize?: string}): T.Page<V> {
  let pageSize = Number(query.pageSize) || 20;
  let pages = Math.max(1, Math.ceil(items.length / pageSize));
  let page = Math.min(Math.max(1, Number(query.page) || 1), pages);
  return {items: items.slice((page - 1) * pageSize, page * pageSize), page, pages, total: items.length};
}

function log(me: T.Operator | undefined, action: string, summary: string, client?: MockClient) {
  activity.unshift({
    id: id("ev"),
    category: categoryOf(action),
    actor: me ? {kind: "operator", id: me.id, name: operatorRef(me).name} : {kind: "system", name: "Helm"},
    action,
    summary,
    clientID: client?.id,
    clientName: client?.name,
    createdAt: new Date().toISOString(),
  });
}

function refresh(client: MockClient) {
  client.balanceDue = uzs(invoices.filter((i) => i.clientID === client.id && i.status === "open").reduce((sum, i) => sum + i.amountDue.majorAmount, 0));
  client.health = computeHealth(client);
}

function summary(client: MockClient): T.Client {
  // The list returns the summary; the detail-only fields stay on the detail endpoint.
  let copy: Partial<MockClient> = {...client};
  let onboarding = client.onboardingDetail;
  for (let key of ["contacts", "locations", "lifetimeValue", "ordersLast30Days", "dailyOrders", "suspendedReason", "onboardingDetail", "remoteAccess"] as const) delete copy[key];
  return {
    ...(copy as T.Client),
    onboarding: onboarding.done < onboarding.total ? {done: onboarding.done, total: onboarding.total, day: onboarding.day, stalled: onboarding.stalled, nextStep: onboarding.nextStep} : undefined,
  };
}

let ATTENTION_ORDER = {high: 0, medium: 1, low: 2};
let PRIORITY_ORDER: Record<T.TaskPriority, number> = {high: 0, normal: 1, low: 2};

let handlers: Record<string, Handler> = {
  // ---- Auth -------------------------------------------------------------------------------------
  "POST /operator.auth.signIn": ({body}) => {
    let operator = operators.find((o) => o.email.toLowerCase() === String(body.email).toLowerCase());
    if (!operator || !body.password) fail(401, "INVALID_CREDENTIALS", "That email and password do not match an operator.");
    if (operator.status === "disabled") fail(403, "OPERATOR_DISABLED", "This account has been disabled.");
    if (operator.twoFactorEnabled) {
      let challengeID = id("ch");
      challenges[challengeID] = {operatorID: operator.id, expiresAt: Date.now() + 5 * 60000};
      return {twoFactorRequired: true, challengeID} satisfies T.SignInResult;
    }
    return {sessionID: `mock-${operator.id}`, operator: signedIn(operator)} satisfies T.SignInResult;
  },
  "POST /operator.auth.verifyTwoFactor": async ({body}) => {
    let challenge = challenges[String(body.challengeID)];
    if (!challenge || challenge.expiresAt < Date.now()) fail(401, "CHALLENGE_EXPIRED", "That took too long. Sign in again.");
    let operator = operators.find((o) => o.id === challenge.operatorID)!;
    if (!(await codeOK(operator, String(body.code)))) fail(401, "CODE_INVALID", "That code is not right. Check the time on your phone and try the next one.");
    delete challenges[String(body.challengeID)];
    return {sessionID: `mock-${operator.id}`, operator: signedIn(operator)} satisfies T.SignInResult;
  },
  "POST /operator.auth.twoFactor.setup": ({me}) => {
    let operator = requireMe(me);
    let secret = randomSecret();
    pendingSecrets[operator.id] = secret;
    return {secret, otpauthURL: `otpauth://totp/Octopos%20Helm:${encodeURIComponent(operator.email)}?secret=${secret}&issuer=Octopos%20Helm&digits=6&period=30`} satisfies T.TwoFactorSetup;
  },
  "POST /operator.auth.twoFactor.enable": async ({body, me}) => {
    let operator = requireMe(me);
    let secret = pendingSecrets[operator.id];
    if (!secret) fail(422, "SETUP_FIRST", "Start the set-up again.");
    if (!(await verifyTotp(secret, String(body.code))) && !(MOCK_CODE === body.code)) fail(422, "CODE_INVALID", "That code is not right — the app shows a new one every 30 seconds.");
    secrets[operator.id] = secret;
    delete pendingSecrets[operator.id];
    operator.twoFactorEnabled = true;
    log(me, "team.twoFactorEnabled", "Turned on two-factor sign-in");
    return {recoveryCodes: Array.from({length: 8}, () => `${randomSecret(4)}-${randomSecret(4)}`.toLowerCase())} satisfies T.TwoFactorEnabled;
  },
  "POST /operator.auth.twoFactor.disable": async ({body, me}) => {
    let operator = requireMe(me);
    if (security.requireTwoFactor) fail(422, "REQUIRED", "Two-factor is required for the whole team; an owner has to turn that off first.");
    if (!(await codeOK(operator, String(body.code)))) fail(422, "CODE_INVALID", "That code is not right.");
    operator.twoFactorEnabled = false;
    delete secrets[operator.id];
    log(me, "team.twoFactorDisabled", "Turned off two-factor sign-in");
    return {disabled: true};
  },
  "POST /operator.auth.stepUp": async ({body, me}) => {
    let operator = requireMe(me);
    if (operator.twoFactorEnabled) {
      if (!(await codeOK(operator, String(body.code ?? "")))) fail(422, "CODE_INVALID", "That code is not right.");
    } else if (!String(body.password ?? "")) fail(422, "PASSWORD_REQUIRED", "Type your password to confirm.");
    let token = id("su");
    stepUps[token] = {operatorID: operator.id, expiresAt: Date.now() + 5 * 60000};
    return {token, expiresAt: new Date(stepUps[token].expiresAt).toISOString()} satisfies T.StepUpResult;
  },
  "GET /operator.security.get": () => security,
  "POST /operator.security.update": ({body, me}) => {
    requireStepUp(me);
    let data = body as unknown as T.SecuritySettings;
    if (!(data.idleTimeoutHours >= 1 && data.idleTimeoutHours <= 72)) fail(422, "TIMEOUT_INVALID", "Idle sign-out between 1 and 72 hours.");
    Object.assign(security, {
      requireTwoFactor: Boolean(data.requireTwoFactor),
      idleTimeoutHours: data.idleTimeoutHours,
      updatedAt: new Date().toISOString(),
      updatedBy: me ? operatorRef(me) : undefined,
    });
    log(me, "team.securityUpdated", `Security: two-factor ${security.requireTwoFactor ? "required" : "optional"}, idle sign-out ${security.idleTimeoutHours}h`);
    return security;
  },
  "GET /operator.activity.verify": async () => {
    // Oldest first, each entry hashed with the one before: change any summary and every hash after it differs.
    let chain = activity.slice().reverse();
    let previous = "0".repeat(64);
    for (let event of chain) {
      event.hash = await sha256(`${previous}|${event.id}|${event.action}|${event.actor.name}|${event.summary}|${event.createdAt}`);
      previous = event.hash;
    }
    return {verified: true, events: chain.length, headHash: previous, checkedAt: new Date().toISOString()} satisfies T.ActivityIntegrity;
  },
  "POST /operator.auth.signOut": () => undefined,
  "GET /operator.auth.me": ({me}) => signedIn(requireMe(me)),

  // ---- Overview ---------------------------------------------------------------------------------
  "GET /operator.metrics.overview": () => {
    let live = clients.filter((c) => c.status !== "churned");
    let mrr = live.reduce((sum, c) => sum + c.mrr.majorAmount, 0);
    let pastDue = clients.filter((c) => c.subscription?.status === "pastDue");
    let in7 = clients.filter((c) => c.subscription && c.status !== "churned" && withinDays(c.subscription.periodEnd, 0, 7));
    let monthStart = new Date(NOW);
    monthStart.setDate(1);
    let history: T.MrrPoint[] = Array.from({length: 12}, (_, i) => {
      let d = new Date(NOW);
      d.setMonth(d.getMonth() - (11 - i), 1);
      let growth = 0.55 + (i / 11) * 0.45;
      let value = Math.round((mrr * growth) / 1000) * 1000;
      return {month: monthKey(d), mrr: i === 11 ? mrr : value, newMrr: Math.round(value * (0.06 + (i % 3) * 0.02)), churnedMrr: Math.round(value * (0.01 + (i % 4) * 0.008))};
    });
    let fleet = live.reduce(
      (acc, c) => {
        acc.total += c.installations.total;
        acc.healthy += c.installations.healthy;
        acc.degraded += c.installations.degraded;
        acc.failing += c.installations.failing;
        acc.offline += c.installations.offline;
        return acc;
      },
      {total: 0, healthy: 0, degraded: 0, failing: 0, offline: 0},
    );
    return {
      currency: "UZS",
      mrr: uzs(mrr),
      mrrChange: (mrr - history[10].mrr) / history[10].mrr,
      activeClients: clients.filter((c) => c.status === "active").length,
      newClientsThisMonth: clients.filter((c) => Date.parse(c.createdAt) >= monthStart.getTime()).length,
      trialing: clients.filter((c) => c.subscription?.status === "trialing").length,
      pastDueCount: pastDue.length,
      pastDueAmount: uzs(pastDue.reduce((sum, c) => sum + c.balanceDue.majorAmount, 0)),
      churnRate: clients.filter((c) => c.status === "churned").length / clients.length,
      renewalsNext7Days: in7.length,
      renewalsNext7DaysAmount: uzs(in7.reduce((sum, c) => sum + (c.subscription?.amount.majorAmount ?? 0), 0)),
      collectionRate: 0.91,
      medianDaysToFirstSale: median(
        clients.filter((c) => Date.parse(c.createdAt) > Date.now() - 90 * 86400000 && c.onboardingDetail.daysToFirstSale !== undefined).map((c) => c.onboardingDetail.daysToFirstSale!),
      ),
      onboardingClients: clients.filter((c) => c.status !== "churned" && c.onboardingDetail.done < c.onboardingDetail.total).length,
      fleet,
      mrrHistory: history,
      planMix: plans.map((p) => ({
        plan: planRef(p),
        clients: live.filter((c) => c.subscription?.plan.id === p.id).length,
        mrr: live.filter((c) => c.subscription?.plan.id === p.id).reduce((s, c) => s + c.mrr.majorAmount, 0),
      })),
    } satisfies T.OverviewMetrics;
  },
  "GET /operator.metrics.revenueMovement": ({query}) => {
    let count = Math.min(24, Math.max(3, Number(query.months) || 12));
    let current = clients.filter((c) => c.status !== "churned").reduce((sum, c) => sum + c.mrr.majorAmount, 0);
    // Walk back from today's MRR with a steady growth story, then forward again so each month's
    // movements add up exactly to its change — the property the real report must also have.
    let months: T.RevenueMovementMonth[] = [];
    let ending = current;
    for (let i = 0; i < count; i++) {
      let d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      let seed = (d.getMonth() + 3) * 7919;
      let wobble = (n: number) => ((seed * (n + 1)) % 97) / 97;
      let newMrr = Math.round((ending * (0.045 + wobble(1) * 0.04)) / 1000) * 1000;
      let expansionMrr = Math.round((ending * (0.015 + wobble(2) * 0.015)) / 1000) * 1000;
      let reactivationMrr = wobble(3) > 0.7 ? Math.round((ending * 0.008) / 1000) * 1000 : 0;
      let contractionMrr = -Math.round((ending * (0.003 + wobble(4) * 0.004)) / 1000) * 1000;
      let churnedMrr = -Math.round((ending * (0.006 + wobble(5) * 0.008)) / 1000) * 1000;
      let starting = ending - newMrr - expansionMrr - reactivationMrr - contractionMrr - churnedMrr;
      months.unshift({
        month: monthKey(d),
        startingMrr: starting,
        newMrr,
        expansionMrr,
        reactivationMrr,
        contractionMrr,
        churnedMrr,
        endingMrr: ending,
        newClients: Math.max(1, Math.round(newMrr / 520000)),
        churnedClients: Math.max(0, Math.round(-churnedMrr / 480000)),
      });
      ending = starting;
    }
    // Compounded month by month over the existing base — new revenue never counts towards keeping
    // what was there, which is what makes these retention rather than growth.
    let grr = months.reduce((acc, m) => acc * (1 + (m.contractionMrr + m.churnedMrr) / (m.startingMrr || 1)), 1);
    let nrr = months.reduce((acc, m) => acc * (1 + (m.expansionMrr + m.reactivationMrr + m.contractionMrr + m.churnedMrr) / (m.startingMrr || 1)), 1);
    let paying = clients.filter((c) => c.mrr.majorAmount > 0).length || 1;
    return {currency: "UZS", months, nrr, grr: Math.min(1, grr), arpa: Math.round(current / paying)} satisfies T.RevenueMovement;
  },
  "GET /operator.metrics.cohorts": ({query}) => {
    let count = Math.min(18, Math.max(3, Number(query.months) || 12));
    let cohorts: T.Cohort[] = [];
    for (let i = count - 1; i >= 0; i--) {
      let d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      let size = 3 + ((d.getMonth() * 5 + d.getFullYear()) % 7);
      let ages = i + 1;
      let clientRetention: number[] = [];
      let revenueRetention: number[] = [];
      let alive = 1;
      let revenue = 1;
      for (let age = 0; age < ages; age++) {
        // Most churn is early: the first three months lose the most, then it flattens.
        if (age > 0) alive *= age <= 3 ? 0.9 - ((d.getMonth() + age) % 3) * 0.03 : 0.985;
        if (age > 0) revenue = alive * (1 + age * 0.012);
        clientRetention.push(Math.round(alive * size) / size);
        revenueRetention.push(Math.round(revenue * 100) / 100);
      }
      cohorts.push({month: monthKey(d), clients: size, startingMrr: size * 560000, clientRetention, revenueRetention});
    }
    return {cohorts};
  },
  "GET /operator.attention": ({me}) => {
    runChasing();
    let items: T.AttentionItem[] = [];
    let visible = visibleTo(me, "client.read");
    for (let c of clients.filter((c) => visible(c.id))) {
      let sub = c.subscription;
      if (c.status === "churned") continue;
      if (sub?.status === "pastDue" && c.status !== "suspended") {
        let days = Math.round((NOW - Date.parse(sub.periodEnd)) / 86400000);
        items.push({
          id: `pd-${c.id}`,
          kind: "pastDue",
          severity: days > 14 ? "high" : "medium",
          clientID: c.id,
          clientName: c.name,
          title: `${c.balanceDue.display} overdue`,
          detail: `${days} days past due · ${reminders[c.id]?.count ?? 0} reminders sent`,
          at: sub.periodEnd,
        });
      }
      let failed = payments.find((p) => p.clientID === c.id && p.status === "failed" && Date.parse(p.createdAt) > NOW - 3 * 86400000);
      if (failed && sub?.status !== "pastDue") {
        items.push({
          id: `pf-${c.id}`,
          kind: "paymentFailed",
          severity: "high",
          clientID: c.id,
          clientName: c.name,
          title: "Card charge failed",
          detail: `${failed.failureReason} · renews ${relDay(sub!.periodEnd)}`,
          at: failed.createdAt,
        });
      }
      if (sub?.status === "trialing" && withinDays(sub.periodEnd, 0, 3) && c.status !== "onboarding") {
        items.push({
          id: `tr-${c.id}`,
          kind: "trialEnding",
          severity: "medium",
          clientID: c.id,
          clientName: c.name,
          title: "Trial ends " + relDay(sub.periodEnd),
          detail: `On ${sub.plan.name}, no card on file`,
          at: sub.periodEnd,
        });
      }
      if (c.installations.failing > 0) {
        items.push({
          id: `fl-${c.id}`,
          kind: "fleetFailing",
          severity: "high",
          clientID: c.id,
          clientName: c.name,
          title: `${c.installations.failing} installation${c.installations.failing > 1 ? "s" : ""} not running`,
          detail: "Supervisor answers, the spoke does not — ours to fix",
          at: new Date(NOW).toISOString(),
        });
      }
      let ob = c.onboardingDetail;
      if (ob.stalled) {
        let installed = ob.steps.find((s) => s.key === "installed");
        let noSale = installed?.done && !ob.steps.find((s) => s.key === "firstSale")?.done;
        items.push({
          id: `ob-${c.id}`,
          kind: noSale ? "noFirstSale" : "onboardingStalled",
          severity: "medium",
          clientID: c.id,
          clientName: c.name,
          title: noSale ? "Installed, no sale yet" : `Onboarding stuck on day ${ob.day}`,
          detail: noSale ? `Tills went in ${Math.floor((Date.now() - Date.parse(installed!.doneAt!)) / 86400000)} days ago — check they are being used` : `Next step: ${ob.nextStep}`,
          at: new Date().toISOString(),
        });
      }
      for (let promise of promises.filter((p) => p.clientID === c.id && p.status === "broken")) {
        items.push({
          id: `pb-${promise.id}`,
          kind: "pastDue",
          severity: "high",
          clientID: c.id,
          clientName: c.name,
          title: "Payment promise broken",
          detail: `${promise.amount.display} was promised for ${promise.promisedFor.slice(0, 10)} · reminders resumed`,
          at: promise.promisedFor,
        });
      }
      if (c.tags.includes("churn risk")) {
        items.push({
          id: `in-${c.id}`,
          kind: "inactive",
          severity: "low",
          clientID: c.id,
          clientName: c.name,
          title: "Orders falling",
          detail: `Activity score ${c.health.activity} · last seen ${relDay(c.lastActiveAt!)}`,
          at: c.lastActiveAt!,
        });
      }
    }
    items.sort((a, b) => ATTENTION_ORDER[a.severity] - ATTENTION_ORDER[b.severity]);
    return {items};
  },

  // ---- Clients ----------------------------------------------------------------------------------
  "GET /operator.clients.list": ({query, me}) => {
    let visible = visibleTo(me, "client.read");
    let list = clients.filter((c) => visible(c.id));
    if (query.q) {
      let q = query.q.toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(q) || c.slug.includes(q) || c.owner.name.toLowerCase().includes(q) || c.owner.phone?.replace(/\s/g, "").includes(q.replace(/\s/g, "")));
    }
    if (query.status) list = list.filter((c) => c.status === query.status);
    if (query.onboarding === "true") list = list.filter((c) => c.status !== "churned" && c.onboardingDetail.done < c.onboardingDetail.total);
    if (query.subscriptionStatus) list = list.filter((c) => c.subscription?.status === query.subscriptionStatus);
    if (query.plan) list = list.filter((c) => c.subscription?.plan.slug === query.plan);
    if (query.health) list = list.filter((c) => c.health.grade === query.health);
    if (query.accountManagerID) list = list.filter((c) => c.accountManager?.id === query.accountManagerID);
    switch (query.sort) {
      case "health":
        list.sort((a, b) => a.health.score - b.health.score);
        break;
      case "mrr":
        list.sort((a, b) => b.mrr.majorAmount - a.mrr.majorAmount);
        break;
      case "renewal":
        list.sort((a, b) => Date.parse(a.subscription?.periodEnd ?? "9999") - Date.parse(b.subscription?.periodEnd ?? "9999"));
        break;
      case "createdAt":
        list.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
        break;
      default:
        list.sort((a, b) => a.name.localeCompare(b.name));
    }
    return paginate(list.map(summary), query);
  },
  "GET /operator.clients.get": ({query, me}) => {
    if (!visibleTo(me, "client.read")(String(query.id))) fail(404, "CLIENT_NOT_FOUND", "No client with that id.");
    return findClient(query.id);
  },
  "GET /operator.clients.places": ({me}) => {
    let visible = visibleTo(me, "client.read");
    let items: T.ClientPlace[] = [];
    let unplaced = 0;
    for (let c of clients.filter((c) => visible(c.id))) {
      for (let location of c.locations) {
        if (location.latitude == null || location.longitude == null) {
          unplaced++;
          continue;
        }
        let nodes = fleetNodes.filter((n) => n.tenantID === c.id && n.location?.id === location.id && !n.retiredAt);
        items.push({
          clientID: c.id,
          clientName: c.name,
          slug: c.slug,
          clientStatus: c.status,
          grade: c.health.grade,
          balanceDue: c.balanceDue,
          accountManager: c.accountManager,
          ownerName: c.owner.name,
          ownerPhone: c.owner.phone,
          city: c.city,
          location: {...location, latitude: location.latitude, longitude: location.longitude},
          // Against the moment the demo's installations were made, as the client's own counts are.
          installations: countInstallations(nodes, NOW),
        });
      }
    }
    return {items, unplaced} satisfies T.ClientPlaces;
  },
  "GET /operator.clients.checkSlug": ({query}) => slugCheck(String(query.slug ?? "")),
  "POST /operator.clients.create": ({body, me}) => {
    let data = body as unknown as T.CreateClientData;
    let check = slugCheck(data.slug);
    if (check.reason === "taken") fail(409, "SLUG_TAKEN", `${data.slug}.${DASH_DOMAIN} is already another client's dash.`);
    if (!check.available) fail(422, "SLUG_INVALID", "The dash address needs 3–40 Latin letters, digits or dashes.");
    let p = plans.find((pl) => pl.id === data.planID) ?? plans[0];
    let manager = operators.find((o) => o.id === data.accountManagerID);
    let client: MockClient = {
      id: id("tn"),
      name: data.name,
      slug: data.slug,
      businessType: data.businessType,
      status: "onboarding",
      city: data.city,
      owner: data.owner,
      subscription: {
        id: id("sb"),
        status: data.trialDays > 0 ? "trialing" : "pending",
        plan: planRef(p),
        billingCycle: data.billingCycle,
        vendor: "none",
        nativeBilling: false,
        amount: planPrice(p, data.billingCycle),
        periodStart: new Date().toISOString(),
        periodEnd: daysFromNow(data.trialDays || 30),
        trialEndsAt: data.trialDays > 0 ? daysFromNow(data.trialDays) : undefined,
      },
      balanceDue: uzs(0),
      mrr: uzs(0),
      health: {score: 50, grade: "watch", payment: 100, fleet: 50, activity: 0},
      installations: {total: 0, healthy: 0, degraded: 0, failing: 0, offline: 0},
      locationsCount: 0,
      usersCount: 1,
      accountManager: manager ? operatorRef(manager) : undefined,
      tags: [],
      createdAt: new Date().toISOString(),
      contacts: [data.owner],
      locations: [],
      lifetimeValue: uzs(0),
      ordersLast30Days: 0,
      dailyOrders: Array(30).fill(0),
      remoteAccess: [],
      onboardingDetail: onboardingOf(onboardingSteps(1, Date.now(), me ? operatorRef(me) : {id: "", name: "Helm"}), new Date().toISOString()),
    };
    clients.unshift(client);
    log(me, "client.created", `Created ${client.name} on ${p.name}${data.trialDays ? ` with a ${data.trialDays}-day trial` : ""}`, client);
    return client;
  },
  "POST /operator.clients.update": ({body, me}) => {
    let data = body as unknown as T.UpdateClientData;
    let client = findClient(data.id);
    if (data.name) client.name = data.name;
    if (data.city !== undefined) client.city = data.city;
    if (data.owner) client.owner = data.owner;
    if (data.tags) client.tags = data.tags;
    if (data.accountManagerID !== undefined) {
      let manager = operators.find((o) => o.id === data.accountManagerID);
      client.accountManager = manager ? operatorRef(manager) : undefined;
    }
    log(me, "client.updated", "Updated client details", client);
    return client;
  },
  "POST /operator.clients.suspend": ({body, me}) => {
    requireStepUp(me);
    let client = findClient(body.id);
    client.status = "suspended";
    client.suspendedReason = String(body.reason || "");
    if (overdueInvoicesOf(client.id).length) suspendedForNonPayment.add(client.id);
    else suspendedForNonPayment.delete(client.id);
    refresh(client);
    log(me, "client.suspended", client.suspendedReason, client);
    return client;
  },
  "POST /operator.clients.reactivate": ({body, me}) => {
    let client = findClient(body.id);
    client.status = "active";
    client.suspendedReason = undefined;
    suspendedForNonPayment.delete(client.id);
    refresh(client);
    log(me, "client.reactivated", "Reactivated access", client);
    return client;
  },
  "POST /operator.clients.impersonate": ({body, me}) => {
    let operator = requireMe(me);
    let data = body as unknown as T.ImpersonateData;
    let client = findClient(data.id);
    if (!visibleTo(me, "client.impersonate")(client.id)) fail(403, "FORBIDDEN", "You can only open the dash of clients you look after.");
    if (!data.reason?.trim()) fail(422, "REASON_REQUIRED", "Say why — the client sees it.");
    if (![15, 30, 60].includes(data.minutes)) fail(422, "DURATION_INVALID", "A session lasts 15, 30 or 60 minutes.");
    if (data.mode === "full") requireStepUp(me);
    // One at a time per operator: a second session ends the first, so there is never doubt which dash you are in.
    for (let s of supportSessions) if (s.operator.id === operator.id && !s.endedAt && Date.parse(s.expiresAt) > Date.now()) s.endedAt = new Date().toISOString();
    let session: T.SupportSession = {
      id: id("ss"),
      clientID: client.id,
      clientName: client.name,
      operator: operatorRef(operator),
      mode: data.mode === "full" ? "full" : "readOnly",
      reason: data.reason.trim(),
      startedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + data.minutes * 60000).toISOString(),
    };
    supportSessions.unshift(session);
    log(me, "support.started", `Started a ${session.mode === "full" ? "full-access" : "read-only"} support session (${data.minutes} min): ${session.reason}`, client);
    return {url: `${dashUrl(client.slug)}/?support-session=${session.id}`, expiresAt: session.expiresAt, session} satisfies T.ImpersonationResult;
  },
  "GET /operator.supportSessions.list": ({query}) => {
    let list = supportSessions.slice();
    if (query.clientID) list = list.filter((s) => s.clientID === query.clientID);
    if (query.operatorID) list = list.filter((s) => s.operator.id === query.operatorID);
    if (query.active === "true") list = list.filter((s) => !s.endedAt && Date.parse(s.expiresAt) > Date.now());
    return {sessions: list};
  },
  "POST /operator.supportSessions.end": ({body, me}) => {
    let session = supportSessions.find((s) => s.id === body.id);
    if (!session) fail(404, "SESSION_NOT_FOUND", "No support session with that id.");
    session.endedAt ??= new Date().toISOString();
    log(me, "support.ended", "Ended the support session", findClient(session.clientID));
    return session;
  },

  "POST /operator.clients.onboarding.update": ({body, me}) => {
    let data = body as unknown as T.UpdateOnboardingData;
    let client = findClient(data.clientID);
    let step = client.onboardingDetail.steps.find((s) => s.key === data.key);
    if (!step) fail(422, "STEP_UNKNOWN", "No such onboarding step.");
    if (step.automatic) fail(422, "STEP_AUTOMATIC", "This step is ticked by the client's own first sale or payment.");
    step.done = data.done;
    step.doneAt = data.done ? new Date().toISOString() : undefined;
    step.doneBy = data.done && me ? operatorRef(me) : undefined;
    client.onboardingDetail = onboardingOf(client.onboardingDetail.steps, client.createdAt);
    if (client.onboardingDetail.done === client.onboardingDetail.total && client.status === "onboarding") client.status = "active";
    log(me, "onboarding.step", `${data.done ? "Done" : "Reopened"}: ${data.key}`, client);
    return client.onboardingDetail;
  },

  // ---- Remote access ----------------------------------------------------------------------------
  "POST /operator.remoteAccess.create": ({body, me}) => {
    let data = body as unknown as T.RemoteAccessData;
    let client = findClient(data.clientID);
    let entry: T.RemoteAccess = {id: id("ra"), ...validRemote(client, data), createdAt: new Date().toISOString()} as T.RemoteAccess;
    client.remoteAccess.push(entry);
    log(me, "remoteAccess.added", `Added ${appLabel(entry)} ${formatRemoteID(entry.remoteID)} (${entry.label})`, client);
    return entry;
  },
  "POST /operator.remoteAccess.update": ({body, me}) => {
    let data = body as unknown as T.UpdateRemoteAccessData;
    let client = clients.find((c) => c.remoteAccess.some((r) => r.id === data.id));
    if (!client) fail(404, "REMOTE_ACCESS_NOT_FOUND", "No remote access entry with that id.");
    let entry = client.remoteAccess.find((r) => r.id === data.id)!;
    Object.assign(entry, validRemote(client, {...entry, ...data}));
    log(me, "remoteAccess.updated", `Updated ${appLabel(entry)} ${formatRemoteID(entry.remoteID)} (${entry.label})`, client);
    return entry;
  },
  "POST /operator.remoteAccess.delete": ({body, me}) => {
    let client = clients.find((c) => c.remoteAccess.some((r) => r.id === body.id));
    if (!client) fail(404, "REMOTE_ACCESS_NOT_FOUND", "No remote access entry with that id.");
    let entry = client.remoteAccess.find((r) => r.id === body.id)!;
    client.remoteAccess = client.remoteAccess.filter((r) => r.id !== body.id);
    log(me, "remoteAccess.removed", `Removed ${appLabel(entry)} ${formatRemoteID(entry.remoteID)} (${entry.label})`, client);
    return {id: entry.id};
  },
  "POST /operator.remoteAccess.logConnection": ({body, me}) => {
    let operator = requireMe(me);
    let client = clients.find((c) => c.remoteAccess.some((r) => r.id === body.id));
    if (!client) fail(404, "REMOTE_ACCESS_NOT_FOUND", "No remote access entry with that id.");
    let entry = client.remoteAccess.find((r) => r.id === body.id)!;
    entry.lastConnectedAt = new Date().toISOString();
    entry.lastConnectedBy = operatorRef(operator);
    log(me, "remoteAccess.connected", `Connected to ${entry.label} with ${appLabel(entry)}`, client);
    return entry;
  },

  // ---- Notes ------------------------------------------------------------------------------------
  "GET /operator.notes.list": ({query}) => ({
    notes: notes.filter((n) => n.clientID === query.clientID).sort((a, b) => Number(b.pinned) - Number(a.pinned) || Date.parse(b.createdAt) - Date.parse(a.createdAt)),
  }),
  "POST /operator.notes.create": ({body, me}) => {
    let author = requireMe(me);
    let client = findClient(body.clientID);
    let note: T.Note = {id: id("nt"), clientID: client.id, body: String(body.body), pinned: Boolean(body.pinned), author: operatorRef(author), createdAt: new Date().toISOString()};
    notes.push(note);
    log(me, "note.created", `Note: ${note.body.length > 140 ? `${note.body.slice(0, 140)}…` : note.body}`, client);
    return note;
  },
  "POST /operator.notes.delete": ({body}) => {
    let index = notes.findIndex((n) => n.id === body.id);
    if (index >= 0) notes.splice(index, 1);
    return {id: body.id};
  },

  // ---- Subscriptions ----------------------------------------------------------------------------
  "POST /operator.subscriptions.changePlan": ({body, me}) => {
    let data = body as unknown as T.ChangePlanData;
    let client = findClient(data.clientID);
    let p = plans.find((pl) => pl.id === data.planID);
    if (!p || !client.subscription) fail(422, "PLAN_NOT_FOUND", "That plan does not exist.");
    if (data.effective === "periodEnd") {
      client.subscription.pendingPlan = planRef(p);
      log(me, "subscription.planScheduled", `Moves to ${p.name} on ${client.subscription.periodEnd.slice(0, 10)}`, client);
    } else {
      client.subscription.plan = planRef(p);
      client.subscription.billingCycle = data.billingCycle;
      client.subscription.amount = planPrice(p, data.billingCycle);
      client.subscription.pendingPlan = undefined;
      if (client.subscription.status !== "trialing") client.mrr = uzs(data.billingCycle === "yearly" ? client.subscription.amount.majorAmount / 12 : client.subscription.amount.majorAmount);
      log(me, "subscription.planChanged", `Changed plan to ${p.name} (${data.billingCycle})`, client);
    }
    return client;
  },
  "POST /operator.subscriptions.extend": ({body, me}) => {
    let data = body as unknown as T.ExtendSubscriptionData;
    let client = findClient(data.clientID);
    let sub = client.subscription;
    if (!sub) fail(422, "NO_SUBSCRIPTION", "This client has no subscription to extend.");
    if (!Number.isInteger(data.days) || data.days < 1 || data.days > 365) fail(422, "DAYS_INVALID", "Extra days must be a whole number from 1 to 365.");
    if (!data.reason?.trim()) fail(422, "REASON_REQUIRED", "Say why the days are given — it goes in the activity log.");
    let base = Math.max(Date.parse(sub.periodEnd), Date.now());
    sub.periodEnd = new Date(base + data.days * 86400000).toISOString();
    if (sub.status === "trialing") sub.trialEndsAt = sub.periodEnd;
    if (sub.status === "pastDue" || sub.status === "expired") sub.status = "active";
    refresh(client);
    log(me, "subscription.extended", `Extended by ${data.days} days: ${data.reason}`, client);
    return client;
  },
  "POST /operator.subscriptions.cancel": ({body, me}) => {
    requireStepUp(me);
    let data = body as unknown as T.CancelSubscriptionData;
    let client = findClient(data.clientID);
    if (!client.subscription) fail(422, "NO_SUBSCRIPTION", "This client has no subscription to cancel.");
    client.subscription.canceledAt = new Date().toISOString();
    churnReasons[client.id] = data.reason;
    client.subscription.status = data.atPeriodEnd ? "scheduledCancel" : "canceled";
    if (!data.atPeriodEnd) {
      client.status = "churned";
      client.mrr = uzs(0);
    }
    log(me, "subscription.canceled", `${data.atPeriodEnd ? "Cancels at period end" : "Canceled now"}: ${data.reason}`, client);
    return client;
  },

  // ---- Plans ------------------------------------------------------------------------------------
  "GET /operator.plans.list": () => ({plans}),

  // ---- Billing ----------------------------------------------------------------------------------
  "GET /operator.billing.renewals": ({query, me}) => {
    let visible = visibleTo(me, "billing.read");
    let from = Date.parse(query.from ?? new Date(NOW).toISOString());
    let to = Date.parse(query.to ?? daysFromNow(30));
    let renewals: T.Renewal[] = clients
      .filter((c) => visible(c.id) && c.subscription && c.status !== "churned" && c.subscription.status !== "pastDue" && c.subscription.status !== "canceled")
      .filter((c) => {
        let at = Date.parse(c.subscription!.periodEnd);
        return at >= from && at <= to;
      })
      .map((c) => ({
        clientID: c.id,
        clientName: c.name,
        plan: c.subscription!.pendingPlan ?? c.subscription!.plan,
        billingCycle: c.subscription!.billingCycle,
        vendor: c.subscription!.vendor,
        nativeBilling: c.subscription!.nativeBilling,
        amount: c.subscription!.amount,
        dueAt: c.subscription!.periodEnd,
        subscriptionStatus: c.subscription!.status,
        lastPaymentFailed: payments.some((p) => p.clientID === c.id && p.status === "failed" && Date.parse(p.createdAt) > NOW - 7 * 86400000),
        owner: c.owner,
      }))
      .sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt));
    return {renewals};
  },
  "GET /operator.billing.overdue": ({me}) => {
    let visible = visibleTo(me, "billing.read");
    runChasing();
    let accounts: T.OverdueAccount[] = invoices
      .filter((i) => visible(i.clientID) && i.status === "open" && Date.parse(i.dueAt) < Date.now())
      .map((invoice) => {
        let client = findClient(invoice.clientID);
        let promise = promises.filter((p) => p.invoiceID === invoice.id && p.status !== "kept").at(-1);
        let schedule = scheduleFor(invoice, client, promise);
        let sent = reminders[client.id];
        let automatic = schedule.filter((step) => step.status === "done" && (step.kind === "reminder" || step.kind === "finalNotice")).length;
        return {
          clientID: client.id,
          clientName: client.name,
          owner: client.owner,
          plan: client.subscription?.plan,
          invoice,
          daysOverdue: Math.floor((Date.now() - Date.parse(invoice.dueAt)) / 86400000),
          remindersSent: (sent?.count ?? 0) + automatic,
          lastReminderAt: latest(sent?.lastAt, schedule.filter((step) => step.status === "done" && step.kind !== "retry" && step.kind !== "suspend").at(-1)?.at),
          finalNoticeSentAt: finalNoticeAt(invoice, client, schedule),
          ...nextStepFor(invoice, client, schedule, promise),
          schedule,
          promise,
          health: client.health,
        };
      })
      .sort((a, b) => b.daysOverdue - a.daysOverdue);
    return {accounts};
  },
  "POST /operator.billing.sendReminder": ({body, me}) => {
    let data = body as unknown as T.SendReminderData;
    let client = findClient(data.clientID);
    if (!data.message?.trim()) fail(422, "MESSAGE_REQUIRED", "Write the message to send.");
    let entry = (reminders[client.id] ??= {count: 0});
    entry.count++;
    entry.lastAt = new Date().toISOString();
    if (data.kind === "finalNotice") entry.finalAt = entry.lastAt;
    let what = data.kind === "finalNotice" ? "final notice" : "payment reminder";
    log(me, "billing.reminderSent", `Sent ${what} by ${data.channel}${data.includePayLink ? " with a pay link" : ""}`, client);
    return {sentAt: entry.lastAt};
  },
  "GET /operator.billing.dunning.get": () => dunningSettings,
  "POST /operator.billing.dunning.update": ({body, me}) => {
    let data = body as unknown as T.DunningSettings;
    let whole = (d: unknown, min: number, max: number) => Number.isInteger(d) && (d as number) >= min && (d as number) <= max;
    if (![...data.retryDays, ...data.reminderDays].every((d) => whole(d, 0, 90))) fail(422, "DAYS_INVALID", "Days must be whole numbers from 0 to 90.");
    if (!whole(data.finalNoticeDay, 1, 89) || !whole(data.graceDays, 2, 90)) fail(422, "DAYS_INVALID", "The final notice day is 1–89 and the grace period 2–90 days.");
    if (data.finalNoticeDay >= data.graceDays) fail(422, "FINAL_AFTER_GRACE", "The final notice has to go out before access is suspended.");
    if ([...data.retryDays, ...data.reminderDays].some((d) => d >= data.graceDays))
      fail(422, "DAYS_AFTER_SUSPEND", `Retries and reminders have to come before day ${data.graceDays}, when access is suspended.`);
    if (!data.channels.length) fail(422, "CHANNEL_REQUIRED", "Choose at least one channel.");
    let time = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (!time.test(data.quietHours.from) || !time.test(data.quietHours.to)) fail(422, "QUIET_HOURS_INVALID", "Quiet hours are two times like 21:00 and 09:00.");
    if (!data.templates.reminder.trim() || !data.templates.finalNotice.trim() || !data.templates.suspended.trim()) fail(422, "TEMPLATE_REQUIRED", "None of the three messages can be empty.");
    Object.assign(dunningSettings, data, {
      retryDays: [...new Set(data.retryDays)].sort((a, b) => a - b),
      reminderDays: [...new Set(data.reminderDays)].sort((a, b) => a - b),
      updatedAt: new Date().toISOString(),
      updatedBy: me ? operatorRef(me) : undefined,
    });
    log(me, "billing.dunningUpdated", dunningSettings.enabled ? "Changed payment chasing settings" : "Turned automatic payment chasing off");
    return dunningSettings;
  },
  "POST /operator.billing.promises.create": ({body, me}) => {
    let author = requireMe(me);
    let data = body as unknown as T.CreatePromiseData;
    let invoice = invoices.find((i) => i.id === data.invoiceID);
    if (!invoice || invoice.status !== "open") fail(422, "INVOICE_NOT_OPEN", "A promise can only be taken against an open invoice.");
    let day = Date.parse(data.promisedFor);
    if (!Number.isFinite(day) || day < Date.now() - 86400000) fail(422, "PROMISE_DATE_INVALID", "The promised date has to be today or later.");
    if (day > Date.now() + 30 * 86400000) fail(422, "PROMISE_TOO_FAR", "Promises longer than 30 days out are a payment plan — give extra days instead.");
    for (let p of promises) if (p.invoiceID === invoice.id && p.status === "pending") p.status = "broken";
    let promise: T.PaymentPromise = {
      id: id("pr"),
      clientID: invoice.clientID,
      invoiceID: invoice.id,
      promisedFor: new Date(day).toISOString(),
      amount: uzs(data.amount ?? invoice.amountDue.majorAmount),
      note: data.note?.trim() || undefined,
      status: "pending",
      createdBy: operatorRef(author),
      createdAt: new Date().toISOString(),
    };
    promises.push(promise);
    log(me, "billing.promise", `Promise to pay ${promise.amount.display} by ${promise.promisedFor.slice(0, 10)} — reminders paused`, findClient(invoice.clientID));
    return promise;
  },
  "POST /operator.billing.promises.cancel": ({body, me}) => {
    let promise = promises.find((p) => p.id === body.id);
    if (!promise) fail(404, "PROMISE_NOT_FOUND", "No promise with that id.");
    promises.splice(promises.indexOf(promise), 1);
    log(me, "billing.promiseCanceled", "Canceled a payment promise — reminders resume", findClient(promise.clientID));
    return {id: promise.id};
  },
  "POST /operator.invoices.paymentLink": ({body, me}) => {
    let invoice = invoices.find((i) => i.id === body.invoiceID);
    if (!invoice || invoice.status !== "open") fail(422, "INVOICE_NOT_OPEN", "Only an open invoice can be paid by link.");
    let vendor: T.PaymentLink["vendor"] = body.vendor === "click" ? "click" : "payme";
    let amount = invoice.amountDue.amount;
    let url =
      vendor === "click"
        ? `https://my.click.uz/services/pay?service_id=00000&merchant_id=00000&amount=${amount / 100}&transaction_param=${invoice.number}`
        : `https://checkout.paycom.uz/${btoa(`m=demo;ac.invoice=${invoice.number};a=${amount}`)}`;
    log(me, "invoice.payLink", `Created a ${vendor === "click" ? "Click" : "Payme"} link for ${invoice.number}`, findClient(invoice.clientID));
    return {url, vendor, expiresAt: new Date(Date.now() + 7 * 86400000).toISOString()} satisfies T.PaymentLink;
  },
  "GET /operator.billing.winBack": ({query, me}) => {
    let visible = visibleTo(me, "billing.read");
    let days = Number(query.days) || 90;
    let candidates: T.WinBackCandidate[] = clients
      .filter((c) => visible(c.id) && (c.status === "churned" || c.subscription?.status === "expired" || c.subscription?.status === "canceled"))
      .map((c) => {
        let churnedAt = c.subscription?.canceledAt ?? c.subscription?.periodEnd ?? c.lastActiveAt ?? c.createdAt;
        let offer = winBackOffers[c.id];
        return {
          clientID: c.id,
          clientName: c.name,
          owner: c.owner,
          lastPlan: c.subscription?.plan,
          lastAmount: c.subscription?.amount,
          churnedAt,
          reason: churnReasons[c.id] ?? "Moved to a competitor's POS",
          monthsActive: Math.max(1, Math.round((Date.parse(churnedAt) - Date.parse(c.createdAt)) / (30 * 86400000))),
          lifetimeValue: c.lifetimeValue,
          offerSentAt: offer?.sentAt,
          offer: offer ? {discountPercent: offer.discountPercent, months: offer.months} : undefined,
        };
      })
      .filter((c) => Date.parse(c.churnedAt) > Date.now() - days * 86400000)
      .sort((a, b) => Date.parse(b.churnedAt) - Date.parse(a.churnedAt));
    return {candidates};
  },
  "POST /operator.billing.winBack.sendOffer": ({body, me}) => {
    let data = body as unknown as T.SendWinBackOfferData;
    let client = findClient(data.clientID);
    if (!(data.discountPercent >= 0 && data.discountPercent <= 100) || !(data.months >= 1 && data.months <= 12)) fail(422, "OFFER_INVALID", "Discount 0–100% for 1–12 months.");
    winBackOffers[client.id] = {discountPercent: data.discountPercent, months: data.months, sentAt: new Date().toISOString()};
    log(me, "billing.winBackOffer", `Sent a win-back offer: ${data.discountPercent}% off for ${data.months} months by ${data.channel}`, client);
    return {
      clientID: client.id,
      clientName: client.name,
      owner: client.owner,
      churnedAt: client.subscription?.canceledAt ?? new Date().toISOString(),
      monthsActive: 1,
      lifetimeValue: client.lifetimeValue,
      offerSentAt: winBackOffers[client.id].sentAt,
      offer: data,
    };
  },
  "GET /operator.invoices.list": ({query, me}) => {
    let visible = visibleTo(me, "billing.read");
    let list = invoices.filter((i) => visible(i.clientID)).sort((a, b) => Date.parse(b.issuedAt) - Date.parse(a.issuedAt));
    if (query.status) list = list.filter((i) => i.status === query.status);
    if (query.clientID) list = list.filter((i) => i.clientID === query.clientID);
    if (query.q) {
      let q = query.q.toLowerCase();
      list = list.filter((i) => i.number.toLowerCase().includes(q) || i.clientName.toLowerCase().includes(q));
    }
    return paginate(list, query);
  },
  "GET /operator.invoices.get": ({query}) => {
    let invoice = invoices.find((i) => i.id === query.id);
    if (!invoice) fail(404, "INVOICE_NOT_FOUND", "No invoice with that id.");
    return invoice;
  },
  "POST /operator.invoices.void": ({body, me}) => {
    requireStepUp(me);
    let invoice = invoices.find((i) => i.id === body.id);
    if (!invoice) fail(404, "INVOICE_NOT_FOUND", "No invoice with that id.");
    if (invoice.status === "paid") fail(422, "INVOICE_PAID", "A paid invoice cannot be voided. Refund it instead.");
    invoice.status = "void";
    invoice.amountDue = uzs(0);
    let client = findClient(invoice.clientID);
    if (client.subscription?.status === "pastDue" && !invoices.some((i) => i.clientID === client.id && i.status === "open")) client.subscription.status = "active";
    refresh(client);
    log(me, "invoice.voided", `Voided ${invoice.number}: ${body.reason}`, client);
    return invoice;
  },
  "GET /operator.payments.list": ({query, me}) => {
    let visible = visibleTo(me, "billing.read");
    let list = payments.filter((p) => visible(p.clientID)).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    if (query.status) list = list.filter((p) => p.status === query.status);
    if (query.vendor) list = list.filter((p) => p.vendor === query.vendor);
    if (query.clientID) list = list.filter((p) => p.clientID === query.clientID);
    return paginate(list, query);
  },
  "POST /operator.payments.record": ({body, me}) => {
    let data = body as unknown as T.RecordPaymentData;
    let invoice = invoices.find((i) => i.id === data.invoiceID);
    if (!invoice) fail(404, "INVOICE_NOT_FOUND", "No invoice with that id.");
    if (invoice.status !== "open") fail(422, "INVOICE_NOT_OPEN", "Only an open invoice can take a payment.");
    if (data.amount <= 0) fail(422, "AMOUNT_INVALID", "The amount must be more than zero.");
    let remaining = Math.max(0, invoice.amountDue.majorAmount - data.amount);
    invoice.amountDue = uzs(remaining);
    if (remaining === 0) {
      invoice.status = "paid";
      invoice.paidAt = data.paidAt;
    }
    let client = findClient(invoice.clientID);
    let payment: T.Payment = {
      id: id("pm"),
      clientID: client.id,
      clientName: client.name,
      invoiceID: invoice.id,
      invoiceNumber: invoice.number,
      amount: uzs(data.amount),
      vendor: "none",
      method: data.method,
      status: "succeeded",
      recordedBy: me ? operatorRef(me) : undefined,
      createdAt: data.paidAt,
    };
    payments.push(payment);
    if (client.subscription && remaining === 0 && !invoices.some((i) => i.clientID === client.id && i.status === "open")) {
      if (client.subscription.status === "pastDue") {
        client.subscription.status = "active";
        client.subscription.periodStart = new Date().toISOString();
        client.subscription.periodEnd = daysFromNow(client.subscription.billingCycle === "yearly" ? 365 : 30);
      }
      delete reminders[client.id];
    }
    if (dunningSettings.autoReactivate && client.status === "suspended" && suspendedForNonPayment.has(client.id) && !overdueInvoicesOf(client.id).length) {
      client.status = "active";
      client.suspendedReason = undefined;
      suspendedForNonPayment.delete(client.id);
      log(undefined, "client.reactivated", `Access restored — ${invoice.number} paid`, client);
    }
    refresh(client);
    log(me, "payment.recorded", `Recorded ${payment.amount.display} by ${data.method} against ${invoice.number}`, client);
    return payment;
  },

  // ---- Fleet ------------------------------------------------------------------------------------
  "GET /operator.fleet.nodes": ({query}) => {
    let nodes = fleetNodes.slice();
    if (query.tenantID) nodes = nodes.filter((n) => n.tenantID === query.tenantID);
    if (query.version) nodes = nodes.filter((n) => n.runningVersion === query.version);
    return {nodes};
  },
  "POST /operator.fleet.retireNode": ({body, me}) => {
    requireStepUp(me);
    let node = fleetNodes.find((n) => n.nodeID === body.nodeID && n.tenantID === body.tenantID);
    if (!node) fail(404, "FLEET_NODE_NOT_FOUND", "That installation does not belong to this client.");
    node.retiredAt = new Date().toISOString();
    recountReleases();
    log(me, "fleet.retired", `Retired ${node.lanName ?? node.nodeID.slice(0, 8)}`, findClient(node.tenantID));
    return {id: node.nodeID};
  },
  "POST /operator.fleet.setNodeTarget": ({body, me}) => {
    let data = body as unknown as T.SetFleetNodeTargetData;
    let node = fleetNodes.find((n) => n.nodeID === data.nodeID);
    if (!node) fail(404, "FLEET_NODE_NOT_FOUND", "No installation with that id.");
    if (data.targetVersion && !releases.some((r) => r.version === data.targetVersion)) fail(422, "RELEASE_NOT_FOUND", "There is no such release.");
    node.targetVersion = data.targetVersion;
    node.updatePaused = data.updatePaused;
    recountReleases();
    log(me, "fleet.targetSet", `${node.lanName}: target ${data.targetVersion ?? "default"}${data.updatePaused ? ", updates paused" : ""}`, findClient(node.tenantID));
    return node;
  },
  "GET /operator.fleet.releases": () => ({releases}),
  "POST /operator.fleet.setDefaultRelease": ({body, me}) => {
    let release = releases.find((r) => r.version === body.version);
    if (!release) fail(404, "RELEASE_NOT_FOUND", "There is no such release.");
    if (release.channel !== "stable") fail(422, "RELEASE_NOT_STABLE", "Only a stable release can be the default.");
    let previous = releases.find((r) => r.isDefault);
    for (let r of releases) r.isDefault = r === release;
    for (let n of fleetNodes) if (!n.targetVersion || n.targetVersion === previous?.version) n.targetVersion = release.version;
    recountReleases();
    log(me, "release.default", `Made ${release.version} the default release`);
    return release;
  },

  // ---- Tasks ------------------------------------------------------------------------------------
  "GET /operator.tasks.list": ({query}) => {
    let list = tasks.slice();
    if (query.status) list = list.filter((t) => t.status === query.status);
    if (query.assigneeID) list = list.filter((t) => t.assignee?.id === query.assigneeID);
    if (query.unassigned === "true") list = list.filter((t) => !t.assignee);
    if (query.clientID) list = list.filter((t) => t.clientID === query.clientID);
    if (query.priority) list = list.filter((t) => t.priority === query.priority);
    if (query.kind) list = list.filter((t) => t.kind === query.kind);
    if (query.q) {
      let q = query.q.toLowerCase();
      list = list.filter((t) => [t.title, t.description, t.clientName].some((v) => v?.toLowerCase().includes(q)));
    }
    // Open work by due date, high priority first on the same day; finished work newest first.
    if (query.status === "done") list.sort((a, b) => Date.parse(b.completedAt ?? b.createdAt) - Date.parse(a.completedAt ?? a.createdAt));
    else list.sort((a, b) => Date.parse(a.dueAt ?? "9999") - Date.parse(b.dueAt ?? "9999") || PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
    return {tasks: list};
  },
  "GET /operator.tasks.counts": ({me}) => {
    let open = tasks.filter((t) => t.status === "open");
    let mine = open.filter((t) => t.assignee?.id === me?.id);
    let endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    let startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    return {
      mine: mine.length,
      everyone: open.length,
      unassigned: open.filter((t) => !t.assignee).length,
      overdue: mine.filter((t) => t.dueAt && Date.parse(t.dueAt) < startOfToday.getTime()).length,
      dueToday: mine.filter((t) => t.dueAt && Date.parse(t.dueAt) >= startOfToday.getTime() && Date.parse(t.dueAt) <= endOfToday.getTime()).length,
    } satisfies T.TaskCounts;
  },
  "POST /operator.tasks.create": ({body, me}) => {
    let author = requireMe(me);
    let data = body as unknown as T.CreateTaskData;
    if (!data.title?.trim()) fail(422, "TITLE_REQUIRED", "A task needs a title.");
    let client = data.clientID ? findClient(data.clientID) : undefined;
    let assignee = operators.find((o) => o.id === data.assigneeID);
    let task: T.Task = {
      id: id("tk"),
      title: data.title.trim(),
      description: data.description?.trim() || undefined,
      kind: data.kind,
      priority: data.priority,
      status: "open",
      clientID: client?.id,
      clientName: client?.name,
      assignee: assignee ? operatorRef(assignee) : undefined,
      dueAt: data.dueAt,
      createdBy: operatorRef(author),
      createdAt: new Date().toISOString(),
    };
    tasks.push(task);
    return task;
  },
  "POST /operator.tasks.update": ({body, me}) => {
    let data = body as unknown as T.UpdateTaskData;
    let task = tasks.find((t) => t.id === data.id);
    if (!task) fail(404, "TASK_NOT_FOUND", "No task with that id.");
    if (data.title !== undefined) {
      if (!data.title.trim()) fail(422, "TITLE_REQUIRED", "A task needs a title.");
      task.title = data.title.trim();
    }
    if (data.description !== undefined) task.description = data.description.trim() || undefined;
    if (data.kind) task.kind = data.kind;
    if (data.status && data.status !== task.status) {
      task.status = data.status;
      task.completedAt = data.status === "done" ? new Date().toISOString() : undefined;
      task.completedBy = data.status === "done" && me ? operatorRef(me) : undefined;
    }
    if (data.priority) task.priority = data.priority;
    if (data.dueAt !== undefined) task.dueAt = data.dueAt ?? undefined;
    if (data.assigneeID !== undefined) {
      let assignee = operators.find((o) => o.id === data.assigneeID);
      task.assignee = assignee ? operatorRef(assignee) : undefined;
    }
    return task;
  },

  // ---- Activity ---------------------------------------------------------------------------------
  "GET /operator.activity.list": ({query}) => {
    let list = activity.slice();
    if (query.category) list = list.filter((e) => e.category === query.category);
    if (query.clientID) list = list.filter((e) => e.clientID === query.clientID);
    if (query.actorID) list = list.filter((e) => e.actor.id === query.actorID);
    return paginate(list, {page: query.page, pageSize: query.pageSize ?? "30"});
  },

  // ---- Announcements ----------------------------------------------------------------------------
  "GET /operator.announcements.list": () => ({announcements: announcements.slice().sort((a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt))}),
  "POST /operator.announcements.create": ({body, me}) => {
    let author = requireMe(me);
    let data = body as unknown as T.CreateAnnouncementData;
    if (!data.title?.trim() || !data.body?.trim()) fail(422, "ANNOUNCEMENT_INCOMPLETE", "An announcement needs a title and a message.");
    let announcement: T.Announcement = {
      ...data,
      id: id("an"),
      status: Date.parse(data.startsAt) > Date.now() ? "scheduled" : "live",
      createdBy: operatorRef(author),
      createdAt: new Date().toISOString(),
    };
    announcements.unshift(announcement);
    log(me, "announcement.created", `Announced "${data.title}"`);
    return announcement;
  },
  "POST /operator.announcements.end": ({body, me}) => {
    let announcement = announcements.find((a) => a.id === body.id);
    if (!announcement) fail(404, "ANNOUNCEMENT_NOT_FOUND", "No announcement with that id.");
    announcement.status = "ended";
    announcement.endsAt = new Date().toISOString();
    log(me, "announcement.ended", `Ended "${announcement.title}"`);
    return announcement;
  },

  // ---- Bulk -------------------------------------------------------------------------------------
  "POST /operator.clients.bulkUpdate": ({body, me}) => {
    let data = body as unknown as T.BulkUpdateClientsData;
    if (!data.ids?.length) fail(422, "NOTHING_SELECTED", "Select at least one client.");
    if (data.ids.length > 200) fail(422, "TOO_MANY", "At most 200 clients at once.");
    let visible = visibleTo(me, "client.write");
    let manager = data.accountManagerID ? operators.find((o) => o.id === data.accountManagerID) : undefined;
    let result: T.BulkResult = {updated: 0, skipped: []};
    for (let clientID of data.ids) {
      let client = clients.find((c) => c.id === clientID);
      if (!client || !visible(clientID)) {
        result.skipped.push({id: clientID, reason: "Not one of yours"});
        continue;
      }
      if (data.accountManagerID !== undefined) client.accountManager = manager ? operatorRef(manager) : undefined;
      if (data.addTags?.length) client.tags = [...new Set([...client.tags, ...data.addTags.map((t) => t.trim().toLowerCase()).filter(Boolean)])];
      if (data.removeTags?.length) client.tags = client.tags.filter((t) => !data.removeTags!.includes(t));
      result.updated++;
    }
    log(
      me,
      "client.bulkUpdated",
      `Updated ${result.updated} clients${manager ? ` → manager ${operatorRef(manager).name}` : ""}${data.addTags?.length ? ` +${data.addTags.join(", ")}` : ""}${data.removeTags?.length ? ` −${data.removeTags.join(", ")}` : ""}`,
    );
    return result;
  },
  "POST /operator.tasks.bulkCreate": ({body, me}) => {
    let author = requireMe(me);
    let data = body as unknown as T.BulkCreateTasksData;
    if (!data.clientIDs?.length) fail(422, "NOTHING_SELECTED", "Select at least one client.");
    if (!data.title?.trim()) fail(422, "TITLE_REQUIRED", "A task needs a title.");
    let assignee = operators.find((o) => o.id === data.assigneeID);
    for (let clientID of data.clientIDs) {
      let client = findClient(clientID);
      tasks.push({
        id: id("tk"),
        // {{client}} becomes each client's name, so twenty tasks are not twenty identical lines.
        title: data.title.replace(/\{\{client\}\}/g, client.name).trim(),
        description: data.description,
        kind: data.kind,
        priority: data.priority,
        status: "open",
        clientID: client.id,
        clientName: client.name,
        assignee: assignee ? operatorRef(assignee) : client.accountManager,
        dueAt: data.dueAt,
        createdBy: operatorRef(author),
        createdAt: new Date().toISOString(),
      });
    }
    return {updated: data.clientIDs.length, skipped: []};
  },
  "POST /operator.billing.sendReminders": ({body, me}) => {
    let data = body as unknown as T.BulkRemindData;
    let result: T.BulkResult = {updated: 0, skipped: []};
    for (let item of data.items ?? []) {
      let promise = promises.find((p) => p.invoiceID === item.invoiceID && p.status === "pending");
      if (promise) {
        result.skipped.push({id: item.clientID, reason: "Has a promise to pay"});
        continue;
      }
      let entry = (reminders[item.clientID] ??= {count: 0});
      entry.count++;
      entry.lastAt = new Date().toISOString();
      result.updated++;
    }
    log(me, "billing.remindersSent", `Sent ${result.updated} reminders by ${data.channel}${result.skipped.length ? ` (${result.skipped.length} skipped: promised)` : ""}`);
    return result;
  },

  // ---- Notifications ----------------------------------------------------------------------------
  "GET /operator.notifications.team.get": () => teamNotifications,
  "POST /operator.notifications.team.update": ({body, me}) => {
    let data = body as unknown as T.TeamNotificationSettings;
    if (data.telegram.chatID && !/^-?\d{5,16}$|^@\w{4,}$/.test(data.telegram.chatID)) fail(422, "CHAT_INVALID", "A Telegram chat is a numeric id like -1001234567890 or a public @channel name.");
    if (!(data.crashLoopMinutes >= 1 && data.crashLoopMinutes <= 120) || !(data.offlineHours >= 1 && data.offlineHours <= 72))
      fail(422, "THRESHOLD_INVALID", "Crash loop 1–120 minutes, offline 1–72 hours.");
    Object.assign(teamNotifications, data, {
      telegram: {
        ...data.telegram,
        connected: Boolean(data.telegram.chatID),
        chatTitle: data.telegram.chatID ? (teamNotifications.telegram.chatID === data.telegram.chatID ? teamNotifications.telegram.chatTitle : "Octopos · Support") : undefined,
      },
      updatedAt: new Date().toISOString(),
      updatedBy: me ? operatorRef(me) : undefined,
    });
    log(me, "notifications.updated", "Changed team alerts");
    return teamNotifications;
  },
  "POST /operator.notifications.test": ({body, me}) => {
    if (body.target === "team" && !teamNotifications.telegram.connected) fail(422, "NOT_CONNECTED", "Connect a Telegram group first.");
    let mine = me ? (myNotifications[me.id] ??= defaultMine()) : undefined;
    if (body.target === "me" && (!mine || !telegramOf(me!).connected)) fail(422, "NOT_CONNECTED", "Connect your Telegram first: Settings → Notifications → Connect Telegram.");
    return {sentAt: new Date().toISOString()};
  },
  // ---- Telegram (@octopos_helm_bot) ------------------------------------------------------------
  "GET /operator.telegram.me": ({me}) => telegramOf(requireMe(me)),
  "POST /operator.telegram.link": ({me}) => {
    let operator = requireMe(me);
    let code = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => "abcdefghjkmnpqrstuvwxyz23456789"[b % 31]).join("");
    let expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
    telegramCodes[code] = {operatorID: operator.id, expiresAt: Date.parse(expiresAt), createdAt: Date.now()};
    return {code, url: `https://t.me/${TELEGRAM_BOT}?start=${code}`, expiresAt} satisfies T.TelegramLinkCode;
  },
  "POST /operator.telegram.unlink": ({me}) => {
    let operator = requireMe(me);
    delete telegramLinks[operator.id];
    log(me, "team.telegramUnlinked", `${operator.firstName} ${operator.lastName} disconnected Telegram`);
    return telegramOf(operator);
  },
  "GET /operator.notifications.me.get": ({me}) => (myNotifications[requireMe(me).id] ??= defaultMine()),
  "POST /operator.notifications.me.update": ({body, me}) => {
    let data = body as unknown as T.MyNotificationSettings;
    myNotifications[requireMe(me).id] = {digest: data.digest, includes: data.includes};
    return myNotifications[requireMe(me).id];
  },
  "GET /operator.notifications.me.preview": ({me}) => {
    let operator = requireMe(me);
    let settings = (myNotifications[operator.id] ??= defaultMine());
    let lines = [`☀️ Xayrli tong, ${operator.firstName}! Helm · ${new Date().toLocaleDateString("en", {weekday: "long", day: "numeric", month: "short"})}`];
    let mineOnly = settings.includes.myClientsOnly;
    let ours = (clientID?: string) => !mineOnly || (clientID ? clients.find((c) => c.id === clientID)?.accountManager?.id === operator.id : false);
    if (settings.includes.tasks) {
      let open = tasks.filter((t) => t.status === "open" && t.assignee?.id === operator.id);
      let due = open.filter((t) => t.dueAt && Date.parse(t.dueAt) < Date.now() + 86400000);
      lines.push("", `📝 Tasks: ${due.length} due today or overdue (${open.length} open)`, ...due.slice(0, 5).map((t) => `  • ${t.title}`));
    }
    if (settings.includes.renewals) {
      let soon = clients.filter(
        (c) => ours(c.id) && c.subscription && c.status !== "churned" && Date.parse(c.subscription.periodEnd) > Date.now() && Date.parse(c.subscription.periodEnd) < Date.now() + 7 * 86400000,
      );
      lines.push("", `📅 Renewing this week: ${soon.length}`, ...soon.slice(0, 5).map((c) => `  • ${c.name} — ${c.subscription!.amount.display}${c.subscription!.nativeBilling ? "" : " (manual)"}`));
    }
    if (settings.includes.overdue) {
      let late = clients.filter((c) => ours(c.id) && c.subscription?.status === "pastDue");
      lines.push("", `⚠️ Overdue: ${late.length}`, ...late.slice(0, 5).map((c) => `  • ${c.name} — ${c.balanceDue.display}`));
    }
    if (settings.includes.fleet) {
      let failing = clients.filter((c) => ours(c.id) && c.installations.failing > 0);
      lines.push("", `🖥 Installations not running: ${failing.length}`, ...failing.slice(0, 5).map((c) => `  • ${c.name}`));
    }
    return {text: lines.join("\n")};
  },

  // ---- Team -------------------------------------------------------------------------------------
  "GET /operator.team.list": () => ({operators}),
  "POST /operator.team.invite": ({body, me}) => {
    let data = body as unknown as T.InviteOperatorData;
    if (operators.some((o) => o.email.toLowerCase() === data.email.toLowerCase())) fail(409, "OPERATOR_EXISTS", "Somebody on the team already uses that email.");
    let role = roles.find((r) => r.id === data.roleID);
    if (!role) fail(422, "ROLE_NOT_FOUND", "Choose a role.");
    let operator: T.Operator = {
      id: id("op"),
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      role: roleRef(role),
      status: "invited",
      twoFactorEnabled: false,
      createdAt: new Date().toISOString(),
    };
    operators.push(operator);
    recountRoles();
    log(me, "team.invited", `Invited ${data.email} as ${role.name}`);
    return operator;
  },
  "POST /operator.team.update": ({body, me}) => {
    requireStepUp(me);
    let data = body as unknown as T.UpdateOperatorData;
    let operator = operators.find((o) => o.id === data.id);
    if (!operator) fail(404, "OPERATOR_NOT_FOUND", "No operator with that id.");
    let role = data.roleID ? roles.find((r) => r.id === data.roleID) : undefined;
    if (data.roleID && !role) fail(422, "ROLE_NOT_FOUND", "That role does not exist.");
    let losesOwner = isOwner(operator) && ((role && !role.permissions.some((p) => p.capability === "*")) || data.status === "disabled");
    if (losesOwner && operators.filter((o) => isOwner(o) && o.status === "active").length === 1) fail(422, "LAST_OWNER", "The team needs at least one owner.");
    if (role) operator.role = roleRef(role);
    if (data.status) operator.status = data.status;
    recountRoles();
    log(me, "team.updated", `${operator.firstName} ${operator.lastName}: ${[role?.name, data.status].filter(Boolean).join(", ")}`);
    return operator;
  },

  // ---- Access control ---------------------------------------------------------------------------
  "GET /operator.access.resources": () => ({resources: accessResources}),
  "GET /operator.roles.list": () => ({roles}),
  "GET /operator.roles.get": ({query}) => {
    let role = roles.find((r) => r.id === query.id);
    if (!role) fail(404, "ROLE_NOT_FOUND", "No role with that id.");
    return role;
  },
  "POST /operator.roles.create": ({body, me}) => {
    let data = body as unknown as T.CreateRoleData;
    if (!data.name?.trim()) fail(422, "NAME_REQUIRED", "A role needs a name.");
    if (roles.some((r) => r.name.toLowerCase() === data.name.trim().toLowerCase())) fail(409, "ROLE_EXISTS", "A role with that name already exists.");
    if (!data.permissions?.length) fail(422, "PERMISSIONS_REQUIRED", "Choose at least one permission.");
    validatePermissions(data.permissions);
    let role: T.Role = {
      id: id("rl"),
      name: data.name.trim(),
      description: data.description?.trim() ?? "",
      internal: false,
      permissions: data.permissions,
      memberCount: 0,
      createdAt: new Date().toISOString(),
    };
    roles.push(role);
    log(me, "role.created", `Created role ${role.name} with ${role.permissions.length} permissions`);
    return role;
  },
  "POST /operator.roles.update": ({body, me}) => {
    let data = body as unknown as T.UpdateRoleData;
    let role = roles.find((r) => r.id === data.id);
    if (!role) fail(404, "ROLE_NOT_FOUND", "No role with that id.");
    if (role.internal && data.permissions) fail(422, "ROLE_INTERNAL", "The Owner role's permissions cannot be changed.");
    if (data.name !== undefined) {
      if (!data.name.trim()) fail(422, "NAME_REQUIRED", "A role needs a name.");
      if (roles.some((r) => r.id !== role.id && r.name.toLowerCase() === data.name!.trim().toLowerCase())) fail(409, "ROLE_EXISTS", "A role with that name already exists.");
      role.name = data.name.trim();
      for (let o of operators) if (o.role.id === role.id) o.role = roleRef(role);
    }
    if (data.description !== undefined) role.description = data.description.trim();
    if (data.permissions) {
      if (!data.permissions.length) fail(422, "PERMISSIONS_REQUIRED", "Choose at least one permission.");
      validatePermissions(data.permissions);
      role.permissions = data.permissions;
    }
    log(me, "role.updated", `Updated role ${role.name}`);
    return role;
  },
  "POST /operator.roles.delete": ({body, me}) => {
    requireStepUp(me);
    let role = roles.find((r) => r.id === body.id);
    if (!role) fail(404, "ROLE_NOT_FOUND", "No role with that id.");
    if (role.internal) fail(422, "ROLE_INTERNAL", "The Owner role cannot be deleted.");
    if (role.memberCount > 0) fail(409, "ROLE_IN_USE", `${role.memberCount} people have this role. Move them to another role first.`);
    roles.splice(roles.indexOf(role), 1);
    log(me, "role.deleted", `Deleted role ${role.name}`);
    return {id: role.id};
  },
};

function roleOf(operator: T.Operator) {
  return roles.find((r) => r.id === operator.role.id);
}

function signedIn(operator: T.Operator): T.SignedInOperator {
  let permissions: T.SignedInOperator["permissions"] = {};
  for (let permission of roleOf(operator)?.permissions ?? []) permissions[permission.capability] = permission.scope ?? true;
  return {...operator, permissions, mustSetUpTwoFactor: security.requireTwoFactor && !operator.twoFactorEnabled};
}

/**
 * The "assigned" scope, enforced where the server must enforce it: a list read with a capability
 * scoped to assigned clients only ever contains the clients this operator manages.
 */
function visibleTo(me: T.Operator | undefined, capability: T.Capability) {
  if (!me) return () => false;
  let permissions = signedIn(me).permissions;
  if (permissions["*"]) return () => true;
  let scope = permissions[capability];
  if (!scope) return () => false;
  if (scope === "assigned") return (clientID: string) => clients.find((c) => c.id === clientID)?.accountManager?.id === me.id;
  return () => true;
}

let promises: T.PaymentPromise[] = [];
let challenges: Record<string, {operatorID: string; expiresAt: number}> = {};
let secrets: Record<string, string> = {};
let pendingSecrets: Record<string, string> = {};
let stepUps: Record<string, {operatorID: string; expiresAt: number}> = {};
let security: T.SecuritySettings = {requireTwoFactor: false, idleTimeoutHours: 12};
// Demo mode only: the accounts that start with two-factor on have no phone behind them, so this
// code stands in. A real server never has one.
let MOCK_CODE = "123456";

async function codeOK(operator: T.Operator, code: string) {
  if (code === MOCK_CODE) return true;
  let secret = secrets[operator.id];
  return Boolean(secret) && (await verifyTotp(secret, code));
}

/** The risky actions ask for a fresh proof: a code (or the password, without two-factor) from the last five minutes. */
function requireStepUp(me: T.Operator | undefined) {
  let operator = requireMe(me);
  let token = currentStepUp();
  let entry = token ? stepUps[token] : undefined;
  if (!entry || entry.operatorID !== operator.id || entry.expiresAt < Date.now()) fail(428, "STEP_UP_REQUIRED", "Confirm it is you to do this.");
}
let supportSessions: T.SupportSession[] = [];
let myNotifications: Record<string, T.MyNotificationSettings> = {};
let teamNotifications: T.TeamNotificationSettings = {
  telegram: {chatID: "-1001987654321", chatTitle: "Octopos · Support", connected: true},
  events: {fleetCrashLooping: true, fleetOffline: true, paymentFailed: true, promiseBroken: true, clientSigned: true, trialEnding: false, clientChurned: true, noFirstSale: true},
  crashLoopMinutes: 10,
  offlineHours: 4,
  offlineKeyAccountsOnly: true,
};

const TELEGRAM_BOT = "octopos_helm_bot";
let telegramLinks: Record<string, T.TelegramLink> = {};
let telegramCodes: Record<string, {operatorID: string; expiresAt: number; createdAt: number}> = {};

/**
 * Demo mode has no bot to press Start in, so a link code counts as pressed five seconds after it was
 * made, while Helm is waiting for it. The real server links only when the bot redeems the code.
 */
function telegramOf(operator: T.Operator): T.TelegramLink {
  for (let [code, pending] of Object.entries(telegramCodes)) {
    if (pending.operatorID !== operator.id || pending.expiresAt < Date.now() || Date.now() - pending.createdAt < 5000) continue;
    delete telegramCodes[code];
    telegramLinks[operator.id] = {
      connected: true,
      username: `@${operator.firstName.toLowerCase()}_${operator.lastName.toLowerCase().slice(0, 3)}`,
      firstName: operator.firstName,
      linkedAt: new Date().toISOString(),
    };
    log(operator, "team.telegramLinked", `${operator.firstName} ${operator.lastName} connected Telegram`);
  }
  return telegramLinks[operator.id] ?? {connected: false};
}

function defaultMine(): T.MyNotificationSettings {
  return {digest: {enabled: true, time: "08:30", days: "weekdays"}, includes: {tasks: true, renewals: true, overdue: true, fleet: true, myClientsOnly: false}};
}

/** The filter chip an event falls under, from the first half of its action. */
export function categoryOf(action: string): T.ActivityCategory {
  let head = action.split(".")[0];
  if (head === "payment") return "payment";
  if (head === "billing" || head === "invoice" || head === "subscription") return "billing";
  if (head === "support" || head === "remoteAccess" || action === "client.impersonated") return "support";
  if (head === "note") return "note";
  if (head === "fleet" || head === "release") return "fleet";
  if (head === "team" || head === "role" || head === "notifications") return "team";
  return "client";
}
let winBackOffers: Record<string, {discountPercent: number; months: number; sentAt: string}> = {};
let churnReasons: Record<string, string> = {};

let dunningSettings: T.DunningSettings = {
  enabled: true,
  retryDays: [3, 7, 14],
  reminderDays: [1, 7],
  finalNoticeDay: 14,
  graceDays: 21,
  autoSuspend: true,
  autoReactivate: true,
  channels: ["telegram", "sms"],
  includePayLink: true,
  quietHours: {from: "21:00", to: "09:00"},
  templates: {
    reminder: "Assalomu alaykum, {{name}}! {{business}} uchun Octopos obunasi {{amount}} — to'lov muddati {{due}} edi. To'lash: {{link}}",
    finalNotice: "{{name}}, {{business}} uchun {{amount}} hali to'lanmagan. {{days}} kundan so'ng dash va onlayn buyurtmalar to'xtatiladi. To'lash: {{link}}",
    suspended: "{{business}} uchun kirish to'xtatildi. Kassalar oflayn ishlashda davom etadi. To'lovdan so'ng darhol tiklanadi: {{link}}",
  },
};

// Something on the overdue page to see before anyone has taken a promise.
{
  let REASONS = ["Moved to a competitor's POS", "Closed the second location; could not afford Scale", "Owner sold the business", "Wanted fiscal receipts before we had them"];
  clients.filter((c) => c.status === "churned").forEach((c, i) => (churnReasons[c.id] = REASONS[i % REASONS.length]));
  let open = invoices.find((i) => i.status === "open" && clients.find((c) => c.id === i.clientID)?.status === "active");
  if (open) {
    promises.push({
      id: id("pr"),
      clientID: open.clientID,
      invoiceID: open.id,
      promisedFor: new Date(Date.now() + 2 * 86400000).toISOString(),
      amount: open.amountDue,
      note: "Accountant back on Monday; transfer goes out then.",
      status: "pending",
      createdBy: operatorRef(operators[3]),
      createdAt: new Date(Date.now() - 86400000).toISOString(),
    });
  }
}

/** A promise whose day has passed with the invoice still open is broken; a paid one was kept. */
function settlePromises() {
  for (let promise of promises) {
    if (promise.status !== "pending") continue;
    let invoice = invoices.find((i) => i.id === promise.invoiceID);
    if (invoice?.status === "paid") promise.status = "kept";
    else if (Date.parse(promise.promisedFor) + 86400000 < Date.now()) promise.status = "broken";
  }
}

/** Clients Helm itself suspended for an unpaid invoice — the only ones a payment brings back on its own. */
let suspendedForNonPayment = new Set(clients.filter((c) => c.status === "suspended" && c.suspendedReason?.startsWith("Unpaid")).map((c) => c.id));

function overdueInvoicesOf(clientID: string) {
  return invoices.filter((i) => i.clientID === clientID && i.status === "open" && Date.parse(i.dueAt) < Date.now());
}

/**
 * The automatic chase, as the server would run it: retries for autopay clients, reminders, the
 * final notice, and suspension once the grace period is over. Nothing before a promise's day.
 */
function scheduleFor(invoice: T.Invoice, client: MockClient, promise?: T.PaymentPromise): T.DunningStep[] {
  if (!dunningSettings.enabled) return [];
  let due = Date.parse(invoice.dueAt);
  let at = (day: number) => new Date(due + day * 86400000).toISOString();
  let now = Date.now();
  let autopay = client.subscription?.nativeBilling;
  let pausedUntil = promise?.status === "pending" ? Date.parse(promise.promisedFor) : 0;
  let promisedAt = promise?.status === "pending" ? Date.parse(promise.createdAt) : Infinity;
  let steps: T.DunningStep[] = [
    ...(autopay ? dunningSettings.retryDays.map((day) => ({kind: "retry" as const, day, at: at(day), status: "upcoming" as const})) : []),
    ...dunningSettings.reminderDays.map((day) => ({kind: "reminder" as const, day, at: at(day), status: "upcoming" as const})),
    {kind: "finalNotice", day: dunningSettings.finalNoticeDay, at: at(dunningSettings.finalNoticeDay), status: "upcoming"},
    ...(dunningSettings.autoSuspend ? [{kind: "suspend" as const, day: dunningSettings.graceDays, at: at(dunningSettings.graceDays), status: "upcoming" as const}] : []),
  ];
  steps.sort((a, b) => a.day - b.day);
  for (let step of steps) {
    let when = Date.parse(step.at);
    if (step.kind === "suspend") step.status = client.status === "suspended" ? "done" : pausedUntil > now ? "paused" : "upcoming";
    else if (when <= now) step.status = when >= promisedAt && when < pausedUntil ? "skipped" : "done";
    else if (when < pausedUntil) step.status = "paused";
  }
  return steps;
}

function finalNoticeAt(invoice: T.Invoice, client: MockClient, schedule: T.DunningStep[]) {
  let automatic = schedule.find((step) => step.kind === "finalNotice" && step.status === "done")?.at;
  let manual = reminders[client.id]?.finalAt;
  return latest(automatic, manual && Date.parse(manual) >= Date.parse(invoice.dueAt) ? manual : undefined);
}

function latest(a?: string, b?: string) {
  if (!a) return b;
  if (!b) return a;
  return Date.parse(a) > Date.parse(b) ? a : b;
}

/** One answer to "what now" for an overdue invoice, whether chasing runs on its own or not. */
function nextStepFor(invoice: T.Invoice, client: MockClient, schedule: T.DunningStep[], promise?: T.PaymentPromise): Pick<T.OverdueAccount, "nextStep" | "nextStepAt" | "manual"> {
  let now = new Date().toISOString();
  let graceAt = new Date(Date.parse(invoice.dueAt) + dunningSettings.graceDays * 86400000).toISOString();
  if (client.status === "suspended") return {nextStep: "suspended", nextStepAt: now, manual: false};
  if (promise?.status === "pending") return {nextStep: "waitForPromise", nextStepAt: promise.promisedFor, manual: false};
  let finalAt = finalNoticeAt(invoice, client, schedule);
  if (dunningSettings.enabled) {
    let upcoming = schedule.find((step) => step.status === "upcoming" || step.status === "paused");
    if (upcoming) {
      let kinds = {retry: "retry", reminder: "remind", finalNotice: "finalNotice", suspend: "suspend"} as const;
      return {nextStep: kinds[upcoming.kind], nextStepAt: upcoming.at, manual: false};
    }
    // Everything automatic has run and suspension is left to people.
    return {nextStep: "suspend", nextStepAt: graceAt, manual: true};
  }
  let days = (Date.now() - Date.parse(invoice.dueAt)) / 86400000;
  if (!finalAt && days >= dunningSettings.finalNoticeDay) return {nextStep: "finalNotice", nextStepAt: now, manual: true};
  if (finalAt) return {nextStep: "suspend", nextStepAt: latest(graceAt, finalAt)!, manual: true};
  let nextReminder = dunningSettings.reminderDays.map((day) => new Date(Date.parse(invoice.dueAt) + day * 86400000).toISOString()).find((at) => at > (reminders[client.id]?.lastAt ?? invoice.dueAt));
  return {nextStep: "remind", nextStepAt: nextReminder && nextReminder > now ? nextReminder : now, manual: true};
}

/**
 * What the server's chasing job does on its own, run whenever someone looks: suspends accounts past
 * the grace period (never before the final notice, never while a promise is pending).
 */
function runChasing() {
  settlePromises();
  if (!dunningSettings.enabled || !dunningSettings.autoSuspend) return;
  for (let invoice of invoices.filter((i) => i.status === "open" && Date.parse(i.dueAt) < Date.now())) {
    let client = findClient(invoice.clientID);
    if (client.status !== "active") continue;
    let promise = promises.find((p) => p.invoiceID === invoice.id && p.status === "pending");
    let schedule = scheduleFor(invoice, client, promise);
    let suspend = schedule.find((step) => step.kind === "suspend");
    if (!suspend || suspend.status !== "upcoming" || Date.parse(suspend.at) > Date.now() || !finalNoticeAt(invoice, client, schedule)) continue;
    client.status = "suspended";
    client.suspendedReason = `Unpaid ${invoice.number}: ${dunningSettings.graceDays} days past due after the final notice.`;
    suspendedForNonPayment.add(client.id);
    refresh(client);
    log(undefined, "client.suspended", client.suspendedReason, client);
  }
}
runChasing();

/** "2026-11" for a local date. toISOString would shift the 1st of the month into the previous one east of UTC. */
function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function median(values: number[]) {
  if (!values.length) return undefined;
  let sorted = values.slice().sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

// Subdomains the platform itself uses.
let RESERVED_SLUGS = new Set(["www", "api", "app", "dash", "admin", "helm", "mail", "status", "help", "docs", "billing", "pay"]);

function slugCheck(slug: string): T.SlugCheck {
  if (!SLUG_PATTERN.test(slug)) return {slug, available: false, reason: "invalid"};
  let free = (s: string) => !RESERVED_SLUGS.has(s) && !clients.some((c) => c.slug === s);
  if (free(slug)) return {slug, available: true};
  let n = 2;
  while (!free(`${slug.slice(0, 37)}-${n}`)) n++;
  return {slug, available: false, reason: RESERVED_SLUGS.has(slug) ? "reserved" : "taken", suggestion: `${slug.slice(0, 37)}-${n}`};
}

function validRemote(client: MockClient, data: Partial<T.RemoteAccessData>) {
  let app = remoteApp(data.app);
  if (!REMOTE_APPS.some((a) => a.app === data.app)) fail(422, "REMOTE_APP_INVALID", "Pick the app: anydesk, rustdesk, teamviewer or other.");
  let remote = String(data.remoteID ?? "").replace(/\s/g, "");
  if (!app.pattern.test(remote)) fail(422, "REMOTE_ID_INVALID", `That does not look like a ${app.name} ID.`);
  if (app.app === "other" && !data.appName?.trim()) fail(422, "APP_NAME_REQUIRED", "Say which app it is.");
  if (!data.label?.trim()) fail(422, "LABEL_REQUIRED", 'Name the machine, e.g. "Main hall · Till 1".');
  let duplicate = client.remoteAccess.find((r) => r.app === app.app && r.remoteID === remote);
  if (duplicate && !("id" in data && (data as {id?: string}).id === duplicate.id)) fail(409, "REMOTE_ID_EXISTS", `That ID is already saved as "${duplicate.label}".`);
  let location = client.locations.find((l) => l.id === data.locationID);
  return {
    label: data.label.trim(),
    app: app.app,
    remoteID: remote,
    appName: app.app === "other" ? data.appName?.trim() : undefined,
    locationID: location?.id,
    locationName: location?.name,
    nodeID: data.nodeID || undefined,
    unattended: Boolean(data.unattended),
    passwordNote: data.passwordNote?.trim() || undefined,
    note: data.note?.trim() || undefined,
  };
}

function isOwner(operator: T.Operator) {
  return roleOf(operator)?.permissions.some((p) => p.capability === "*") ?? false;
}

function validatePermissions(permissions: T.Permission[] | undefined) {
  if (!permissions) return;
  let catalog = new Map(accessResources.flatMap((r) => r.capabilities).map((c) => [c.value, c]));
  for (let permission of permissions) {
    if (permission.capability === "*") continue;
    let entry = catalog.get(permission.capability);
    if (!entry) fail(422, "UNKNOWN_CAPABILITY", `${permission.capability} is not a capability.`);
    if (permission.scope && !entry.scopes.includes(permission.scope)) fail(422, "INVALID_SCOPE", `${entry.name} cannot be limited to ${permission.scope}.`);
  }
}

function withinDays(at: string, from: number, to: number) {
  let delta = (Date.parse(at) - Date.now()) / 86400000;
  return delta >= from && delta <= to;
}

function relDay(at: string) {
  let days = Math.round((Date.parse(at) - Date.now()) / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  return days > 0 ? `in ${days} days` : `${-days} days ago`;
}

function currentOperator() {
  let session = getSession();
  if (!session.startsWith("mock-")) return undefined;
  return operators.find((o) => o.id === session.slice(5) && o.status !== "disabled");
}

/**
 * What each endpoint needs, read from api-spec/operator.yml's x-capability, so the demo refuses
 * exactly what the real server will and a role built here behaves the same once it is real.
 * "a" or "[a, b]" (any one of them); no x-capability means any signed-in operator.
 */
let REQUIRED: Record<string, T.Capability[]> = (() => {
  let required: Record<string, T.Capability[]> = {};
  let path = "";
  let method = "";
  for (let line of spec.split("\n")) {
    let match = /^ {2}(\/operator\.[\w.]+):/.exec(line);
    if (match) path = match[1];
    match = /^ {4}(get|post):/.exec(line);
    if (match) method = match[1].toUpperCase();
    match = /^ {6}x-capability: (.+)$/.exec(line);
    if (match && path) required[`${method} ${path}`] = match[1].replace(/[[\]\s]/g, "").split(",") as T.Capability[];
  }
  return required;
})();

function allowed(me: T.Operator, key: string) {
  let needed = REQUIRED[key];
  if (!needed) return true;
  let permissions = signedIn(me).permissions;
  return Boolean(permissions["*"]) || needed.some((capability) => permissions[capability]);
}

export async function handleMock<R>(method: Method, path: string, options: RequestOptions): Promise<R> {
  await new Promise((resolve) => setTimeout(resolve, 180 + Math.random() * 320));
  let handler = handlers[`${method} ${path}`];
  if (!handler) fail(404, "NOT_FOUND", `The mock has no ${method} ${path}. Add it to src/api/mock/index.ts.`);
  let me = currentOperator();
  if (!path.startsWith("/operator.auth.signIn") && path !== "/operator.auth.verifyTwoFactor") requireMe(me);
  if (me && !allowed(me, `${method} ${path}`)) fail(403, "FORBIDDEN", `Your role does not allow this (${REQUIRED[`${method} ${path}`].join(" or ")}).`);
  let query = Object.fromEntries(Object.entries((options.query ?? {}) as Record<string, unknown>).map(([k, v]) => [k, v === undefined || v === null ? undefined : String(v)]));
  // Copy out, so a page that holds on to a result never sees it change under it without a refetch.
  let result = await handler({query, body: (options.body ?? {}) as Record<string, unknown>, me});
  return (result === undefined ? undefined : structuredClone(result)) as R;
}
