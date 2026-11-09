import {mkdirSync, readFileSync, renameSync, writeFileSync} from "node:fs";
import {dirname} from "node:path";
import {config} from "./config.ts";
import type {Lang} from "./i18n.ts";
import type {Button} from "./telegram.ts";

/** A Telegram account linked to a Helm operator, and the session the bot uses for them. */
export type Link = {
  telegramUserID: number;
  chatID: number;
  operatorID: string;
  sessionID: string;
  name: string;
  lang: Lang;
  linkedAt: string;
};

/** A team alert waiting for someone to press "Take it"; callback_data is too small to carry it. */
export type Alert = {
  /** The task it becomes. */
  title: string;
  clientID?: string;
  kind: "followUp" | "call" | "payment" | "install" | "other";
  /** The message as sent, and its link buttons, so it can be redrawn with who took it. */
  html: string;
  links: Button[];
  createdAt: string;
};

type Data = {links: Record<string, Link>; alerts: Record<string, Alert>};

// A JSON file is enough for a few dozen people. It is written to a temp file and renamed, so a
// crash mid-write never leaves half a file behind.
let data: Data = load();

function load(): Data {
  try {
    return JSON.parse(readFileSync(config.dataFile, "utf8")) as Data;
  } catch {
    return {links: {}, alerts: {}};
  }
}

function save() {
  mkdirSync(dirname(config.dataFile), {recursive: true});
  let temp = `${config.dataFile}.tmp`;
  writeFileSync(temp, JSON.stringify(data, null, 2));
  renameSync(temp, config.dataFile);
}

export function linkOf(telegramUserID: number) {
  return data.links[telegramUserID];
}

export function linkOfOperator(operatorID: string) {
  return Object.values(data.links).find((link) => link.operatorID === operatorID);
}

export function setLink(link: Link) {
  // One Telegram per operator: linking a new account drops the old one, as the server does.
  for (let [id, existing] of Object.entries(data.links)) if (existing.operatorID === link.operatorID) delete data.links[id];
  data.links[link.telegramUserID] = link;
  save();
}

export function dropLink(telegramUserID: number) {
  delete data.links[telegramUserID];
  save();
}

export function putAlert(alert: Alert, id = Math.random().toString(36).slice(2, 10)) {
  data.alerts[id] = alert;
  // Alerts nobody took within a week are not going to be taken.
  let weekAgo = Date.now() - 7 * 86400000;
  for (let [key, value] of Object.entries(data.alerts)) if (Date.parse(value.createdAt) < weekAgo) delete data.alerts[key];
  save();
  return id;
}

export function takeAlert(id: string) {
  let alert = data.alerts[id];
  if (alert) {
    delete data.alerts[id];
    save();
  }
  return alert;
}
