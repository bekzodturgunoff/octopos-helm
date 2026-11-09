import {config} from "./config.ts";

// The few parts of the Telegram Bot API the bot uses, called directly with fetch: no library to
// keep up to date, and every call is visible here.

export type User = {id: number; first_name: string; username?: string; language_code?: string};
export type Chat = {id: number; type: "private" | "group" | "supergroup" | "channel"; title?: string};
export type Message = {message_id: number; from?: User; chat: Chat; text?: string};
export type CallbackQuery = {id: string; from: User; message?: Message; data?: string};
export type Update = {update_id: number; message?: Message; callback_query?: CallbackQuery};

export type Button = {text: string; url: string} | {text: string; callback_data: string};
export type Keyboard = Button[][];

export class TelegramError extends Error {
  code: number;
  constructor(code: number, description: string) {
    super(description);
    this.code = code;
  }
}

export async function call<T>(method: string, params: object = {}): Promise<T> {
  let response = await fetch(`${config.telegramAPI}/bot${config.token}/${method}`, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(params),
  });
  let body = (await response.json()) as {ok: boolean; result: T; error_code?: number; description?: string};
  if (!body.ok) throw new TelegramError(body.error_code ?? response.status, body.description ?? "Telegram refused the call");
  return body.result;
}

export function send(chatID: number | string, text: string, keyboard?: Keyboard) {
  return call<Message>("sendMessage", {
    chat_id: chatID,
    text,
    parse_mode: "HTML",
    link_preview_options: {is_disabled: true},
    reply_markup: keyboard?.length ? {inline_keyboard: keyboard} : undefined,
  });
}

export function edit(chatID: number | string, messageID: number, text: string, keyboard?: Keyboard) {
  return call<Message>("editMessageText", {
    chat_id: chatID,
    message_id: messageID,
    text,
    parse_mode: "HTML",
    link_preview_options: {is_disabled: true},
    reply_markup: {inline_keyboard: keyboard ?? []},
  });
}

/** A place as Telegram's own map card: tapping it on a phone offers every navigator installed. */
export function sendVenue(chatID: number | string, venue: {latitude: number; longitude: number; title: string; address: string}) {
  return call<Message>("sendVenue", {chat_id: chatID, ...venue});
}

export function answer(callbackID: string, text?: string, alert = false) {
  return call<true>("answerCallbackQuery", {callback_query_id: callbackID, text, show_alert: alert});
}

/** Long polling: no public URL or certificate needed, and it works behind any firewall. */
export async function poll(onUpdate: (update: Update) => Promise<void>, signal: AbortSignal) {
  let offset = 0;
  while (!signal.aborted) {
    try {
      let updates = await call<Update[]>("getUpdates", {offset, timeout: 25, allowed_updates: ["message", "callback_query"]});
      for (let update of updates) {
        offset = update.update_id + 1;
        // One bad update must not stop the others, or the same one would be retried forever.
        await onUpdate(update).catch((err) => console.error("update failed", update.update_id, err));
      }
    } catch (err) {
      console.error("getUpdates failed, retrying in 3s:", (err as Error).message);
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
}
