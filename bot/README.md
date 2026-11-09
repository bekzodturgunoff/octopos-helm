# @octopos_helm_bot

Helm in Telegram for the Octopos team. It does three things:

- **Team alerts** in the team group, with a **🙋 Take it** button. Whoever presses it gets a task in Helm, and the message shows who took it, so two people never go to the same restaurant.
- **📍 Branches on the map:** on every client card and alert. It sends each branch as a Telegram location card, privately, and a phone opens it in Yandex, Google or 2GIS for directions. After "Take it", the button stays on the message for whoever took it.
- **Personal messages:** the morning digest, "new task for you" with a **✓ Done** button, and alerts about your own clients.
- **Quick answers** in a private chat:

| Command          | What it answers                                                    | Needs (Helm role)  |
| ---------------- | ------------------------------------------------------------------ | ------------------ |
| `/today`         | Your morning digest, now                                           | —                  |
| `/tasks`         | Your open tasks, ✓ buttons to finish them                          | —                  |
| `/client <name>` | Status, plan, health, debt, renewal, owner, manager, dash link     | View clients       |
| `/overdue`       | Who owes money, worst first, total                                 | View billing       |
| `/fleet`         | Installations not running: crashing, wrong settings, offline, etc. | View installations |
| `/id`            | This chat's id (also works in groups), for Helm's team-alerts page | —                  |
| `/logout`        | Disconnect this Telegram                                           | —                  |

It speaks Uzbek, Russian or English, based on each person's Telegram language. The team group uses `TEAM_LANGUAGE`.

## How it stays safe

- **Nobody types a username.** In Helm, Settings → Notifications → **Connect Telegram** gives a one-time link (`t.me/octopos_helm_bot?start=<code>`, 10 minutes, works once). Pressing Start sends the code to the server (`/bot.telegram.redeem`), which links that Telegram account and returns a session for that person.
- **The bot has no powers of its own.** Every question goes to the API with that person's session, so their Helm role applies exactly as in Helm. A "Reports only" person gets "your role does not allow this" for `/overdue`.
- **No data in groups.** In groups it only answers `/id` and `/help`. Client cards from buttons in the group are sent to the person privately.
- **Disconnecting ends the session.** Unlinking (in Helm or with `/logout`) or disabling someone stops the bot from acting for them. The bot notices at its next call and forgets them.

## Set it up

1. In Telegram, open **@BotFather**:
   - `/newbot` → name `Octopos Helm` → username `octopos_helm_bot`. Copy the token.
   - `/setjoingroups` → Enable, so it can be added to the team group.
   - Keep privacy mode on (the default). The bot only needs commands.
2. `cp .env.example .env`, then fill in the token and two random secrets:
   ```bash
   openssl rand -hex 32   # HELM_BOT_KEY
   openssl rand -hex 32   # EVENTS_SECRET
   ```
   Give the same two secrets to the API server.
3. Run it with Node 23.6 or newer. There is nothing to install, because Node runs the TypeScript directly:
   ```bash
   cd bot && npm start
   ```
4. Add the bot to the team group, send `/id`, and paste the number into Helm → Administration → Team alerts.

`npm run check` type-checks it (it uses the TypeScript in the Helm folder above). Keep `DATA_FILE` on storage that survives deploys: it holds who is linked.

## Put it live

It runs as a Docker container on the same server and `kdsx` network as kdsx-api. It long-polls Telegram, so it needs no domain, no HTTPS and no open port.

1. On the server, put the Helm repo next to kdsx-api and create `bot/.env` from `.env.example`. Set:
   - `HELM_API_URL=http://master-api:3000`
   - the bot token, `HELM_BOT_KEY` and `EVENTS_SECRET`
2. In kdsx-api's environment, set the same `HELM_BOT_KEY` and `EVENTS_SECRET`, plus `HELM_BOT_URL=http://helm-bot:8787`.
3. From the Helm repo root:
   ```bash
   docker compose -f bot/docker-compose.yml up -d --build
   docker compose -f bot/docker-compose.yml logs -f    # "@octopos_helm_bot starting"
   ```
4. Only one copy may run per token: Telegram refuses a second poller with `409 Conflict`. Stop any copy running on a laptop first.

To update, pull and rerun step 3. The linked accounts stay in the `helm_bot_data` volume.

## What the API server needs to do

All of this is in `api-spec/operator.yml`, tag `OperatorTelegram`:

- `GET /operator.telegram.me`, `POST /operator.telegram.link`, `POST /operator.telegram.unlink`: Helm's Connect Telegram card (already built against the mock).
- `POST /bot.telegram.redeem` (header `X-Bot-Key`): checks the code, stores the link and returns a session for that operator.
- **Sending events:** `POST <bot>/events` with `Authorization: Bearer <EVENTS_SECRET>` and a `BotEvent` body:
  - **Team alerts:** `{to: {team: true, chatID}}` for each `AlertEvent` switched on in the team notification settings, after their thresholds (crash loop minutes, offline hours, key accounts only).
  - **Task assigned:** `{event: "taskAssigned", to: {operatorID}}` when someone assigns a task to someone else.
  - **Digest:** `{event: "digest", to: {operatorID}, text}` at each person's digest time. The text is the same as `notifications.me.preview`.

  The bot answers `200 {delivered: true}`, `404 {reason: "NOT_LINKED"}` (the person has no Telegram) or `409 {reason: "TELEGRAM_REFUSED"}` (they blocked the bot, or it was removed from the group).

Example:

```bash
curl -X POST http://localhost:8787/events -H "Authorization: Bearer $EVENTS_SECRET" -H "Content-Type: application/json" -d '{
  "event": "fleetCrashLooping", "to": {"team": true, "chatID": "-1001987654321"}, "at": "2026-11-09T09:00:00Z",
  "client": {"id": "tn1", "name": "Black Bear Coffee", "slug": "black-bear-coffee"},
  "node": {"nodeID": "n1", "tenantID": "tn1", "restartCount": 14, "lastExitCode": 1}
}'
```

## Files

| File              | What is in it                                                    |
| ----------------- | ---------------------------------------------------------------- |
| `src/main.ts`     | Start-up: command menus, long polling, the events server         |
| `src/commands.ts` | Every command and button                                         |
| `src/events.ts`   | `POST /events`: turning a `BotEvent` into a message with buttons |
| `src/telegram.ts` | The few Telegram Bot API calls used, with `fetch`                |
| `src/helm.ts`     | Calls to the Helm API, as the person or as the bot               |
| `src/store.ts`    | Who is linked, and alerts waiting for "Take it" (a JSON file)    |
| `src/i18n.ts`     | Everything it says, in uz / ru / en                              |
| `src/format.ts`   | HTML escaping, dates in Tashkent time, links, status words       |

Types come from `../src/api/types.ts` and installation health from `../src/lib/fleet.ts`, so the bot and Helm judge things the same way.
