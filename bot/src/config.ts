// Settings come from the environment, or from bot/.env when it exists (see .env.example).
try {
  process.loadEnvFile();
} catch {
  // No .env: everything comes from the real environment.
}

function need(name: string) {
  let value = process.env[name];
  if (!value) {
    console.error(`${name} is not set. Copy .env.example to .env and fill it in.`);
    process.exit(1);
  }
  return value;
}

export let config = {
  /** From @BotFather. Never commit it. */
  token: need("TELEGRAM_BOT_TOKEN"),
  /** Where the operator.* API lives — the same as Helm's VITE_API_URL. */
  apiURL: need("HELM_API_URL").replace(/\/$/, ""),
  /** Shared secret for /bot.telegram.redeem; the server checks it as X-Bot-Key. */
  botKey: need("HELM_BOT_KEY"),
  /** The server sends events with this as its Bearer. */
  eventsSecret: need("EVENTS_SECRET"),
  /** Helm itself, for "Open in Helm" buttons. */
  appURL: (process.env.HELM_APP_URL || "https://helm.octopos.uz").replace(/\/$/, ""),
  dashDomain: process.env.DASH_DOMAIN || "dash.octopos.uz",
  port: Number(process.env.PORT || 8787),
  /** Who is linked to whom; keep it on a volume that survives deploys. */
  dataFile: process.env.DATA_FILE || "./data/bot.json",
  /** The team group's language: alerts there are read by everyone. */
  teamLanguage: (process.env.TEAM_LANGUAGE || "uz") as "uz" | "ru" | "en",
  /** Only changed by tests, which stand up a fake Telegram. */
  telegramAPI: (process.env.TELEGRAM_API_URL || "https://api.telegram.org").replace(/\/$/, ""),
};
