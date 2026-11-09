import {onCallback, onMessage} from "./commands.ts";
import {startEventServer} from "./events.ts";
import {messages, type Lang} from "./i18n.ts";
import {call, poll} from "./telegram.ts";

// @octopos_helm_bot: Telegram for the Octopos team. Two doors in — Telegram updates (long polling)
// and the server's events (HTTP) — and every answer goes out as the person it is for.

async function registerCommands() {
  let names = ["today", "tasks", "client", "overdue", "fleet", "id", "help", "logout"] as const;
  // The menu next to the text box, in each person's Telegram language; Uzbek for everyone else.
  for (let lang of ["uz", "ru", "en"] as Lang[]) {
    let commands = names.map((command) => ({command, description: messages[lang].commands[command]}));
    let language = lang === "uz" ? {} : {language_code: lang};
    await call("setMyCommands", {commands, scope: {type: "all_private_chats"}, ...language});
    // The profile people see before pressing Start, kept here so it never drifts from what the bot does.
    let profile = messages[lang].profile;
    // Telegram rate-limits name changes; a refusal on a restart must not stop the bot.
    let quiet = (err: Error) => console.warn(`profile (${lang}):`, err.message);
    await call("setMyName", {name: profile.name, ...language}).catch(quiet);
    await call("setMyShortDescription", {short_description: profile.short, ...language}).catch(quiet);
    await call("setMyDescription", {description: profile.description, ...language}).catch(quiet);
  }
  // In groups only /id is useful: everything else answers in private.
  await call("setMyCommands", {commands: [{command: "id", description: messages.uz.commands.id}], scope: {type: "all_group_chats"}});
}

let stop = new AbortController();
let me = await call<{username: string}>("getMe");
console.log(`@${me.username} starting`);
await registerCommands().catch((err) => console.error("setMyCommands failed:", err.message));
let server = startEventServer();

for (let signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    console.log("stopping");
    stop.abort();
    server.close();
    // getUpdates can be mid-wait for up to 25s; nothing is lost by not waiting for it.
    setTimeout(() => process.exit(0), 500);
  });
}

await poll(async (update) => {
  if (update.message) await onMessage(update.message);
  else if (update.callback_query) await onCallback(update.callback_query);
}, stop.signal);
