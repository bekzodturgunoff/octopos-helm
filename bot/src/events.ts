import {createServer, type IncomingMessage, type ServerResponse} from "node:http";
import type * as T from "../../src/api/types.ts";
import {config} from "./config.ts";
import {date, esc, helmURL} from "./format.ts";
import {messages, type Lang, type Messages} from "./i18n.ts";
import {linkOfOperator, putAlert, type Alert} from "./store.ts";
import {send, TelegramError, type Button, type Keyboard} from "./telegram.ts";

// The server's way in: POST /events with a BotEvent (api-spec/operator.yml), Bearer EVENTS_SECRET.
// The server decides what happened and to whom; the bot decides how it reads and which buttons it
// gets. Answers 200 {delivered: true}, or 404 {delivered: false, reason: "NOT_LINKED"} for a person
// with no Telegram, so the server can fall back or stop trying.

const TASK_KIND: Record<T.AlertEvent, Alert["kind"]> = {
  fleetCrashLooping: "install",
  fleetOffline: "install",
  paymentFailed: "payment",
  promiseBroken: "payment",
  clientSigned: "followUp",
  trialEnding: "call",
  clientChurned: "call",
  noFirstSale: "call",
};

function detailOf(event: T.BotEvent, m: Messages, lang: Lang) {
  let parts: string[] = [];
  if (event.node?.restartCount) parts.push(m.restarts(event.node.restartCount));
  if (event.node?.lastExitCode !== undefined && event.event === "fleetCrashLooping") parts.push(m.exitCode(event.node.lastExitCode));
  if (event.node?.offlineSince) parts.push(m.since(date(event.node.offlineSince, lang, true)));
  if (event.invoice) parts.push(`${esc(event.invoice.amount.display)}, ${m.invoice(esc(event.invoice.number))}`);
  return parts.length ? ` — ${parts.join(", ")}` : "";
}

/** The message, its link buttons, and the title of the task "Take it" would create. */
export function render(event: T.BotEvent, lang: Lang): {html: string; links: Button[]; title?: string} {
  let m = messages[lang];
  let client = esc(event.client?.name ?? "—");
  let open = (path: string): Button => ({text: m.openInHelm, url: helmURL(path)});
  let clientLink = event.client ? [open(`/clients/${event.client.id}`)] : [];
  switch (event.event) {
    case "digest":
      return {html: esc(event.text ?? ""), links: [open("/")]};
    case "taskAssigned":
      return {html: m.event.taskAssigned(esc(event.task?.title ?? ""), esc(event.task?.createdBy?.name ?? "")), links: [open("/tasks")]};
    case "fleetCrashLooping":
    case "fleetOffline":
      return {
        html: m.event[event.event](client, detailOf(event, m, lang)),
        links: event.node ? [open(`/fleet/${event.node.nodeID}`)] : clientLink,
        title: taskTitle(event),
      };
    case "paymentFailed":
    case "promiseBroken":
    case "trialEnding":
      return {html: m.event[event.event](client, detailOf(event, m, lang)), links: clientLink, title: taskTitle(event)};
    case "clientSigned":
    case "clientChurned":
    case "noFirstSale":
      return {html: m.event[event.event](client), links: clientLink, title: taskTitle(event)};
  }
}

// Tasks are read in Helm by the whole team, so their titles stay in one language: the team's.
function taskTitle(event: T.BotEvent) {
  let m = messages[config.teamLanguage];
  let plain = (html: string) =>
    html
      .replace(/<[^>]+>/g, "")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&");
  let name = event.client?.name ?? "";
  switch (event.event) {
    case "paymentFailed":
    case "promiseBroken":
    case "trialEnding":
    case "fleetCrashLooping":
    case "fleetOffline":
      return plain(m.event[event.event](name, "")).replace(/^\S+\s/, "");
    case "clientSigned":
    case "clientChurned":
    case "noFirstSale":
      return plain(m.event[event.event](name)).replace(/^\S+\s/, "");
    default:
      return name;
  }
}

export async function deliver(event: T.BotEvent): Promise<{status: number; body: object}> {
  let personal = "operatorID" in event.to ? linkOfOperator(event.to.operatorID) : undefined;
  if ("operatorID" in event.to && !personal) return {status: 404, body: {delivered: false, reason: "NOT_LINKED"}};
  let chatID = personal ? personal.chatID : (event.to as {chatID: string}).chatID;
  let lang = personal ? personal.lang : config.teamLanguage;
  let {html, links, title} = render(event, lang);
  let m = messages[lang];

  let keyboard: Keyboard = [];
  if (event.event === "taskAssigned" && event.task) keyboard.push([{text: m.done, callback_data: `tdm:${event.task.id}`}, ...links]);
  else if (title && event.event !== "digest") {
    // Anything that needs a person gets "Take it": whoever presses it gets a task in Helm and the
    // message says who, so two people never drive to the same restaurant.
    let id = putAlert({title, clientID: event.client?.id, kind: TASK_KIND[event.event as T.AlertEvent], html, links, createdAt: new Date().toISOString()});
    keyboard.push([{text: m.takeIt, callback_data: `tk:${id}`}, ...links]);
  } else if (links.length) keyboard.push(links);
  // Whoever is going there gets the branches as map cards, privately.
  if (event.client && event.event !== "digest") keyboard.push([{text: m.branchesOnMap, callback_data: `pl:${event.client.id}`}]);

  try {
    let message = await send(chatID, html, keyboard);
    return {status: 200, body: {delivered: true, messageID: message.message_id}};
  } catch (err) {
    // 403: the person blocked the bot, or it was removed from the group.
    if (err instanceof TelegramError && (err.code === 403 || err.code === 400)) return {status: 409, body: {delivered: false, reason: "TELEGRAM_REFUSED", message: err.message}};
    throw err;
  }
}

async function readJSON(req: IncomingMessage) {
  let chunks: Buffer[] = [];
  let size = 0;
  for await (let chunk of req) {
    size += (chunk as Buffer).length;
    if (size > 256 * 1024) throw new Error("too large");
    chunks.push(chunk as Buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function reply(res: ServerResponse, status: number, body: object) {
  res.writeHead(status, {"Content-Type": "application/json"});
  res.end(JSON.stringify(body));
}

function valid(event: T.BotEvent) {
  let kinds = [...Object.keys(TASK_KIND), "taskAssigned", "digest"];
  if (!event || !kinds.includes(event.event) || !event.to) return false;
  if ("operatorID" in event.to) return typeof event.to.operatorID === "string";
  return event.to.team === true && /^-?\d+$|^@\w+$/.test(String(event.to.chatID));
}

export function startEventServer() {
  let server = createServer(async (req, res) => {
    try {
      if (req.method === "GET" && req.url === "/health") return reply(res, 200, {ok: true});
      if (req.method !== "POST" || req.url !== "/events") return reply(res, 404, {error: "NOT_FOUND"});
      if (req.headers.authorization !== `Bearer ${config.eventsSecret}`) return reply(res, 401, {error: "UNAUTHENTICATED"});
      let event = (await readJSON(req)) as T.BotEvent;
      if (!valid(event)) return reply(res, 400, {error: "EVENT_INVALID"});
      let {status, body} = await deliver(event);
      reply(res, status, body);
    } catch (err) {
      console.error("event failed", err);
      reply(res, 500, {error: "FAILED", message: (err as Error).message});
    }
  });
  server.listen(config.port, () => console.log(`events: listening on :${config.port}`));
  return server;
}
