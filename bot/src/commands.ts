import type * as T from "../../src/api/types.ts";
import {fleetHealth, fleetNodeLabel} from "../../src/lib/fleet.ts";
import {config} from "./config.ts";
import {date, dashURL, esc, helmURL, word} from "./format.ts";
import {asBot, asOperator, HelmError} from "./helm.ts";
import {langOf, messages, type Lang} from "./i18n.ts";
import {dropLink, linkOf, setLink, takeAlert, putAlert, type Link} from "./store.ts";
import {answer, edit, send, sendVenue, type CallbackQuery, type Keyboard, type Message} from "./telegram.ts";

// Everything a person can ask the bot. Each command runs as the person who sent it, so a reply
// only ever holds what their Helm role allows; a 403 from the API is answered as "not allowed".

type Handler = (link: Link, args: string, chatID: number) => Promise<void>;

let PERSONAL: Record<string, Handler> = {
  today: async (link, _args, chatID) => {
    let {text} = await asOperator<{text: string}>(link, "GET", "/operator.notifications.me.preview");
    await send(chatID, esc(text), [[{text: messages[link.lang].openInHelm, url: helmURL("/")}]]);
  },

  tasks: async (link, _args, chatID) => {
    let {text, keyboard} = await renderTasks(link);
    await send(chatID, text, keyboard);
  },

  client: async (link, args, chatID) => {
    let m = messages[link.lang];
    let q = args.trim();
    if (!q) return void (await send(chatID, m.clientUsage));
    let page = await asOperator<T.Page<T.Client>>(link, "GET", "/operator.clients.list", {query: {q, pageSize: 6}});
    if (page.items.length === 0) return void (await send(chatID, m.noClients(esc(q))));
    if (page.items.length === 1) return sendClient(link, page.items[0].id, chatID);
    await send(
      chatID,
      m.pickClient(page.total),
      page.items.map((client) => [{text: client.name, callback_data: `c:${client.id}`}]),
    );
  },

  overdue: async (link, _args, chatID) => {
    let m = messages[link.lang];
    let {accounts} = await asOperator<{accounts: T.OverdueAccount[]}>(link, "GET", "/operator.billing.overdue");
    if (accounts.length === 0) return void (await send(chatID, m.noOverdue));
    accounts.sort((a, b) => b.daysOverdue - a.daysOverdue);
    let total = accounts.reduce((sum, a) => sum + a.invoice.amountDue.majorAmount, 0);
    let currency = accounts[0].invoice.amountDue.currency;
    let lines = accounts.slice(0, 10).map((a) => `• <b>${esc(a.clientName)}</b> — ${esc(a.invoice.amountDue.display)} · ${m.daysLate(a.daysOverdue)}`);
    if (accounts.length > 10) lines.push(`… +${accounts.length - 10}`);
    let keyboard: Keyboard = accounts.slice(0, 6).map((a) => [{text: a.clientName, callback_data: `c:${a.clientID}`}]);
    keyboard.push([{text: m.openInHelm, url: helmURL("/billing/overdue")}]);
    await send(chatID, [m.overdueTitle(accounts.length, esc(sum(total, currency))), "", ...lines].join("\n"), keyboard);
  },

  fleet: async (link, _args, chatID) => {
    let m = messages[link.lang];
    let {nodes} = await asOperator<{nodes: T.FleetNode[]}>(link, "GET", "/operator.fleet.nodes");
    let live = nodes.filter((node) => !node.retiredAt);
    let bad = live.map((node) => ({node, health: fleetHealth(node)})).filter((row) => row.health !== "healthy");
    if (bad.length === 0) return void (await send(chatID, m.fleetAllGood(live.length)));
    // Ours to fix first (crashing, misconfigured), the customer's network last.
    let order = ["crashLooping", "misconfigured", "neverStarted", "degraded", "offline"];
    bad.sort((a, b) => order.indexOf(a.health) - order.indexOf(b.health));
    let lines = bad.slice(0, 12).map(({node, health}) => `• <b>${esc(node.tenantName)}</b> · ${esc(fleetNodeLabel(node))} — ${m.fleetState[health] ?? health}`);
    if (bad.length > 12) lines.push(`… +${bad.length - 12}`);
    let keyboard: Keyboard = bad.slice(0, 5).map(({node}) => [{text: `${node.tenantName} · ${fleetNodeLabel(node)}`, url: helmURL(`/fleet/${node.nodeID}`)}]);
    keyboard.push([{text: m.openInHelm, url: helmURL("/fleet?tab=needsAction")}]);
    await send(chatID, [m.fleetTitle(bad.length, live.length), "", ...lines].join("\n"), keyboard);
  },

  logout: async (link, _args, chatID) => {
    await asOperator(link, "POST", "/operator.telegram.unlink", {body: {}}).catch((err) => {
      // Already gone on the server is fine: the point is to be disconnected.
      if (!(err instanceof HelmError && err.status === 401)) throw err;
    });
    dropLink(link.telegramUserID);
    await send(chatID, messages[link.lang].loggedOut);
  },
};

function sum(major: number, currency: string) {
  let n = Math.round(major)
    .toLocaleString("ru-RU")
    .replace(/[\u00a0\u202f]/g, " ");
  return currency === "UZS" ? `${n} so'm` : `${n} ${currency}`;
}

export async function renderTasks(link: Link): Promise<{text: string; keyboard: Keyboard}> {
  let m = messages[link.lang];
  let {tasks} = await asOperator<{tasks: T.Task[]}>(link, "GET", "/operator.tasks.list", {query: {status: "open", assigneeID: link.operatorID}});
  if (tasks.length === 0) return {text: m.noTasks, keyboard: [[{text: m.openInHelm, url: helmURL("/tasks")}]]};
  tasks.sort((a, b) => (a.dueAt ? Date.parse(a.dueAt) : Infinity) - (b.dueAt ? Date.parse(b.dueAt) : Infinity));
  let shown = tasks.slice(0, 8);
  let lines = shown.map((task, i) => {
    let late = task.dueAt && Date.parse(task.dueAt) < Date.now();
    let due = task.dueAt ? ` — ${late ? `⚠️ ${m.overdue}` : m.due(date(task.dueAt, link.lang))}` : "";
    return `${i + 1}. ${esc(task.title)}${task.clientName ? ` · <i>${esc(task.clientName)}</i>` : ""}${due}`;
  });
  // Four ✓ buttons to a row keeps them big enough to hit on a phone.
  let buttons = shown.map((task, i) => ({text: `✓ ${i + 1}`, callback_data: `td:${task.id}`}));
  let keyboard: Keyboard = [];
  for (let i = 0; i < buttons.length; i += 4) keyboard.push(buttons.slice(i, i + 4));
  keyboard.push([{text: m.openInHelm, url: helmURL("/tasks")}]);
  return {text: [m.tasksTitle(tasks.length), "", ...lines].join("\n"), keyboard};
}

async function sendClient(link: Link, clientID: string, chatID: number) {
  let m = messages[link.lang];
  let lang = link.lang;
  let c = await asOperator<T.ClientDetail>(link, "GET", "/operator.clients.get", {query: {id: clientID}});
  let sub = c.subscription;
  let lines = [
    `<b>${esc(c.name)}</b>${c.city ? ` · ${esc(c.city)}` : ""}`,
    "",
    `${m.status}: ${word(c.status, lang)}${sub && word(sub.status, lang) !== word(c.status, lang) ? ` · ${word(sub.status, lang)}` : ""}`,
    sub ? `${m.plan}: ${esc(sub.plan.name)} · ${esc(sub.amount.display)}` : "",
    `${m.health}: ${word(c.health.grade, lang)} (${c.health.score})`,
    `${m.owes}: ${c.balanceDue.amount > 0 ? `<b>${esc(c.balanceDue.display)}</b>` : m.nothingOwed}`,
    sub?.periodEnd ? `${m.renews}: ${date(sub.periodEnd, lang)}` : "",
    `${m.owner}: ${esc(c.owner.name)}${c.owner.phone ? ` · ${esc(c.owner.phone)}` : ""}`,
    c.accountManager ? `${m.manager}: ${esc(c.accountManager.name)}` : "",
    `${m.dash}: ${esc(dashURL(c.slug).replace("https://", ""))}`,
  ].filter((line, i) => line || i === 1);
  let keyboard: Keyboard = [
    [
      {text: m.openInHelm, url: helmURL(`/clients/${c.id}`)},
      {text: m.openDash, url: dashURL(c.slug)},
    ],
  ];
  if (c.locations.some(placed)) keyboard.push([{text: m.branchesOnMap, callback_data: `pl:${c.id}`}]);
  await send(chatID, lines.join("\n"), keyboard);
}

function placed(location: T.ClientLocation): location is T.ClientLocation & {latitude: number; longitude: number} {
  return location.latitude != null && location.longitude != null;
}

/** Each branch with a point, as a map card the phone opens in Yandex, Google or 2GIS. */
async function sendPlaces(link: Link, clientID: string, chatID: number) {
  let m = messages[link.lang];
  let c = await asOperator<T.ClientDetail>(link, "GET", "/operator.clients.get", {query: {id: clientID}});
  let places = c.locations.filter(placed);
  if (places.length === 0) return void (await send(chatID, m.noPlaces(esc(c.name))));
  for (let location of places.slice(0, 8)) {
    let address = [location.address, location.phone].filter(Boolean).join(" · ");
    await sendVenue(chatID, {latitude: location.latitude, longitude: location.longitude, title: `${c.name} · ${location.name}`, address: address || c.name});
  }
}

/** Runs a command for a linked person and turns API refusals into a sentence they can act on. */
async function asLinked(lang: Lang, chatID: number, link: Link | undefined, work: (link: Link) => Promise<void>) {
  let m = messages[lang];
  if (!link) return void (await send(chatID, m.notLinked(helmURL("/settings/notifications"))));
  try {
    await work(link);
  } catch (err) {
    if (err instanceof HelmError && err.status === 401) {
      dropLink(link.telegramUserID);
      await send(chatID, m.sessionEnded);
    } else if (err instanceof HelmError && err.status === 403) {
      await send(chatID, m.forbidden);
    } else {
      console.error(err);
      await send(chatID, m.failed(esc((err as Error).message)));
    }
  }
}

export async function onMessage(message: Message) {
  let text = message.text?.trim();
  if (!text?.startsWith("/") || !message.from) return;
  let [head, ...rest] = text.split(/\s+/);
  let command = head.slice(1).split("@")[0].toLowerCase();
  let args = rest.join(" ");
  let chatID = message.chat.id;
  let link = linkOf(message.from.id);
  let lang = link?.lang ?? langOf(message.from.language_code);
  let m = messages[lang];
  let isPrivate = message.chat.type === "private";

  if (command === "id") return void (await send(chatID, m.chatID(chatID)));
  if (command === "help") return void (await send(chatID, m.help));
  // Answers hold one person's view of clients and money; in the team group that would show it to
  // everyone, so outside /id and /help the bot only talks in private.
  if (!isPrivate) return;

  if (command === "start") return start(message, args.trim());
  let handler = PERSONAL[command];
  if (!handler) return void (await send(chatID, m.help));
  await asLinked(lang, chatID, link, (link) => handler(link, args, chatID));
}

async function start(message: Message, code: string) {
  let from = message.from!;
  let lang = langOf(from.language_code);
  let m = messages[lang];
  let existing = linkOf(from.id);
  if (!code) {
    if (existing) return void (await send(message.chat.id, m.help));
    return void (await send(message.chat.id, m.notLinked(helmURL("/settings/notifications"))));
  }
  try {
    let result = await asBot<T.RedeemTelegramLinkResult>("/bot.telegram.redeem", {
      code,
      telegramUserID: from.id,
      chatID: message.chat.id,
      username: from.username,
      firstName: from.first_name,
      languageCode: from.language_code,
    } satisfies T.RedeemTelegramLinkData);
    let operator = result.operator;
    setLink({
      telegramUserID: from.id,
      chatID: message.chat.id,
      operatorID: operator.id,
      sessionID: result.sessionID,
      name: `${operator.firstName} ${operator.lastName}`,
      lang,
      linkedAt: new Date().toISOString(),
    });
    await send(message.chat.id, m.welcome(esc(operator.firstName)));
  } catch (err) {
    if (err instanceof HelmError && err.code === "OPERATOR_DISABLED") return void (await send(message.chat.id, m.disabled));
    if (err instanceof HelmError && (err.status === 404 || err.status === 410 || err.status === 422)) return void (await send(message.chat.id, m.codeInvalid));
    // Anything else — usually Helm's API not answering — still gets a reply, not silence.
    console.error("redeem failed", err);
    await send(message.chat.id, m.failed(esc((err as Error).message)));
  }
}

export async function onCallback(query: CallbackQuery) {
  let data = query.data ?? "";
  let link = linkOf(query.from.id);
  let lang = link?.lang ?? langOf(query.from.language_code);
  let m = messages[lang];
  let chatID = query.message?.chat.id ?? query.from.id;
  let [kind, id] = [data.slice(0, data.indexOf(":")), data.slice(data.indexOf(":") + 1)];

  if (!link) return void (await answer(query.id, m.linkFirst, true));

  if (kind === "c") {
    await answer(query.id);
    // A client card goes to the person who asked, never into a group.
    return asLinked(lang, query.from.id, link, (link) => sendClient(link, id, query.from.id));
  }

  if (kind === "pl") {
    await answer(query.id);
    // Like a client card: to the person who pressed it, never into a group.
    return asLinked(lang, query.from.id, link, (link) => sendPlaces(link, id, query.from.id));
  }

  if (kind === "td" || kind === "tdm") {
    try {
      await asOperator(link, "POST", "/operator.tasks.update", {body: {id, status: "done"} satisfies T.UpdateTaskData});
    } catch (err) {
      await answer(query.id, err instanceof HelmError && err.status === 403 ? m.forbidden : m.failed((err as Error).message), true);
      return;
    }
    await answer(query.id, m.taskDone);
    if (!query.message) return;
    if (kind === "td") {
      let {text, keyboard} = await renderTasks(link);
      await edit(chatID, query.message.message_id, text, keyboard);
    } else {
      await edit(chatID, query.message.message_id, `${esc(query.message.text ?? "")}\n\n${m.taskDone}`, [[{text: m.openInHelm, url: helmURL("/tasks")}]]);
    }
    return;
  }

  if (kind === "tk") {
    let alert = takeAlert(id);
    if (!alert) return void (await answer(query.id, m.alreadyTaken, true));
    try {
      await asOperator<T.Task>(link, "POST", "/operator.tasks.create", {
        body: {
          title: alert.title,
          kind: alert.kind,
          priority: "high",
          clientID: alert.clientID,
          assigneeID: link.operatorID,
          dueAt: new Date(Date.now() + 86400000).toISOString(),
        } satisfies T.CreateTaskData,
      });
    } catch (err) {
      // Nobody got it after all; put it back so someone else can.
      putAlert(alert, id);
      await answer(query.id, err instanceof HelmError && err.status === 403 ? m.forbidden : m.failed((err as Error).message), true);
      return;
    }
    await answer(query.id, m.takenBy(link.name));
    if (query.message) {
      let team = messages[config.teamLanguage];
      let rows: Keyboard = alert.links.length ? [alert.links] : [];
      // The one who took it is the one most likely to need the way there.
      if (alert.clientID) rows.push([{text: team.branchesOnMap, callback_data: `pl:${alert.clientID}`}]);
      await edit(chatID, query.message.message_id, `${alert.html}\n\n${team.takenBy(esc(link.name))}`, rows.length ? rows : undefined);
    }
    return;
  }

  await answer(query.id);
}
