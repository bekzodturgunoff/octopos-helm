# Connecting Helm to the backend

Everything the backend needs to build so Helm and @octopos_helm_bot work against the real API, in one place. Helm needs no code changes: implement the contract, change four settings, done.

**The contract is `api-spec/operator.yml`.** It has 88 operations, in OpenAPI 3.0 and the same RPC style as `kdsx-api/api-specs`: GET reads with query parameters, POST writes with a JSON body, and the same `Money` and `Error` shapes. It matches `src/api/types.ts` and `src/api/sdk.ts` field for field, and it was checked against both before this was written.

**The demo backend is the reference implementation.** `src/api/mock/index.ts` answers every one of those operations in the browser, with the validation, error codes and side effects (activity log entries, health recount, and so on) Helm expects. When the spec leaves a detail open, do what the mock does.

## 1. What Helm sends

Every request:

| Header            | When                                                                          |
| ----------------- | ----------------------------------------------------------------------------- |
| `Authorization`   | `Bearer <sessionID>` from `operator.auth.signIn`, on every call except signIn |
| `Accept-Language` | `uz`, `ru` or `en`: write `Error.message` in that language                    |
| `X-Step-Up`       | A fresh step-up token on risky operations (see 3)                             |
| `Content-Type`    | `application/json` on POST                                                    |

Helm runs on its own origin, so the API must answer **CORS** for it: allow Helm's origin, those four headers, and GET, POST and OPTIONS. Dates are ISO 8601 in UTC; money is always the `Money` object.

## 2. Build order

Each step makes more of Helm usable. Counts are operations, by spec tag.

1. **Auth (10):** `auth.signIn`, `auth.verifyTwoFactor`, `auth.me`, `auth.signOut`, two-factor setup / enable / disable, `auth.stepUp`, `security.get` / `update`. Without `auth.me`, nobody gets past the login page.
2. **Clients (20) and Metrics (4):** the client list and page, onboarding, notes, remote access, support sessions, the overview numbers, the "needs attention" list, and `clients.places` for the map.
3. **Billing (20):** plans, renewals, overdue and dunning, promises, win-back, invoices, payments.
4. **Fleet (5):** `fleet.nodes` and `fleet.retireNode` **already exist in kdsx-api**. Add `tenantName` to each node. Build `fleet.setNodeTarget`, `fleet.releases` and `fleet.setDefaultRelease`.
5. **Tasks (5), Activity (2), Team (3), Access (6), Announcements (3), Notifications (6).**
6. **Telegram (4):** see 6.

## 3. Rules the server must enforce

- **Sessions.** `signIn` returns `{sessionID, operator}`, or `{twoFactorRequired: true, challengeID}` when the operator has two-factor; then `verifyTwoFactor` finishes it. A disabled operator gets `403 OPERATOR_DISABLED`. Any `401` makes Helm sign the person out, so return `401` only for a missing, expired or ended session.
- **Permissions.** Each operation names its permission as `x-capability`. A list means any one of them, and no `x-capability` means any signed-in operator. Refuse with `403 FORBIDDEN`. Helm only hides what the server would refuse; it is not the check.
- **The `assigned` scope.** A role can limit `client.read`, `client.write`, `client.impersonate`, `billing.read` and `billing.write` to the clients the operator manages (`access.resources` lists which capabilities allow it). Filter every list by it and refuse single reads and writes outside it. `auth.me` returns the role's permissions as a map of capability to scope.
- **The Owner role** is built in (`internal`): it cannot be edited or deleted, and the last active Owner cannot be disabled or moved off it (`422 LAST_OWNER`).
- **Step-up.** Without a valid `X-Step-Up` header, these answer `428 STEP_UP_REQUIRED`: `clients.suspend`, `subscriptions.cancel`, `invoices.void`, `fleet.retireNode`, `roles.delete`, `team.update`, `security.update`, `clients.impersonate` with `mode=full`. Helm then asks for a fresh code, calls `auth.stepUp`, and retries with the token it returns.
- **Errors.** Return kdsx-api's `Error` body. Helm shows `message` to the person as-is, so write it as a sentence for a person, in the `Accept-Language` language. Helm and the bot act on these statuses: `401`, `403`, `404`, `409`, `410`, `422` and `428`. Use the same `code` strings as the mock: `SLUG_TAKEN`, `OPERATOR_DISABLED`, `CODE_INVALID`, `CHALLENGE_EXPIRED` and the rest (`grep 'fail(' src/api/mock/index.ts` lists all of them).

## 4. Numbers the server owns

Helm displays these and never computes them, so every screen and the bot agree:

- **Health score and grade:** payment 40%, activity 35%, installations 25%. Good from 70, Watch from 45, At risk below.
- **The "needs attention" list** (`attention`), ranked.
- **The dunning `nextStep`** for each overdue account.
- **MRR:** a yearly plan counts at a twelfth.
- **Installation counts** (`Client.installations`, and per branch in `clients.places`): `healthy`, `degraded`, `failing` or `offline`, judged from both heartbeats within 5 minutes, as in `countInstallations` in `src/api/mock/data.ts`. A branch's own installations are the nodes whose `location.id` is that branch.

## 5. Jobs that run on their own

- **Payment chasing:** retries, reminders, the grace period and suspension, following `billing.dunning` settings.
- **Team alerts:** when an event switched on in `TeamNotificationSettings` fires (`fleetCrashLooping`, `fleetOffline`, `paymentFailed`, `promiseBroken`, `clientSigned`, `trialEnding`, `clientChurned`, `noFirstSale`), after its thresholds, send it to the bot (see 6).
- **Task assigned:** when someone assigns a task to someone else, send `taskAssigned` to the bot.
- **Digest:** at each person's digest time, send `digest` to the bot with the same text as `notifications.me.preview`. Write it in the person's language: `Accept-Language` for the preview, and for the scheduled one the `languageCode` stored when they linked Telegram (Uzbek, Russian or English; Uzbek otherwise). The demo backend's `DIGEST_WORDS` has the wording in all three.

## 6. Telegram (@octopos_helm_bot)

The bot is in `bot/` and runs next to kdsx-api on the `kdsx` Docker network (see `bot/README.md`).

- **Linking:**
  - `telegram.me`, `telegram.link` and `telegram.unlink` serve Helm's Connect Telegram card.
  - `/bot.telegram.redeem` (header `X-Bot-Key`) checks a one-time code (10 minutes, single use), stores the link, and returns a session for that operator.
  - The bot then calls the API as that person, so their role applies to everything it shows.
- **Events:** POST a `BotEvent` (schema in the spec) to `<HELM_BOT_URL>/events` with `Authorization: Bearer <EVENTS_SECRET>`. The bot answers:
  - `200` when the message was delivered
  - `404 NOT_LINKED` when the person has no Telegram linked
  - `409 TELEGRAM_REFUSED` when the person blocked the bot or it was removed from the group
- **Settings on the API:** `HELM_BOT_KEY` and `EVENTS_SECRET` (the same values as the bot's `.env`), and `HELM_BOT_URL=http://helm-bot:8787`.

## 7. Map

- `ClientLocation` carries `latitude`, `longitude` and `phone`. Take them from the tenant's own location, the one delivery already uses.
- `clients.places` lists every branch that has both coordinates (churned clients included), with that branch's installation counts and how many branches have no point yet. Filtering happens in the browser.
- The map draws from the geo stack's tiles and fonts (`kdsx-api/docker-compose-geo.yml`). Helm needs their public URLs, the same ones the dash uses.

## 8. Changes outside the API

- **Dash subdomains:** every client's dash is `https://<slug>.<VITE_DASH_DOMAIN>`, for example `black-bear-coffee.dash.octopos.uz`. This needs wildcard DNS and TLS for `*.dash.octopos.uz`, and the dash must find the tenant from the subdomain. `clients.create` reserves the slug (`clients.checkSlug` checks it as it is typed).
- **Support sessions:** `clients.impersonate` returns a one-time `url` into the client's dash, `?support-session=<id>`. The dash has to accept it, show a "Support is viewing" banner with the reason, and end at `expiresAt` or when `supportSessions.end` is called. The dash does not handle this yet.
- **Announcements:** the dash needs a read endpoint (for example `announcements.current`) and a banner like `SubscriptionExpiryBanner` to show them.

## 9. Going live

Helm (`.env`, see `env.example`):

```bash
VITE_API_MOCK=                               # empty: use the real API
VITE_API_URL=https://<api host>
VITE_DASH_DOMAIN=dash.octopos.uz
VITE_MAP_TILES_URL=https://<tile server>     # the same three map values as the dash
VITE_MAP_ARCHIVE=uzbekistan
VITE_MAP_GLYPHS=https://<font server>/font/{fontstack}/{range}
```

Bot: `bot/.env` (see `bot/.env.example`), with `HELM_API_URL=http://master-api:3000`.

To check an endpoint against the contract, sign in to Helm on the real API and open the page that uses it. Every page loads through `src/api` only, so a wrong field shows up as a broken page, not a silent difference. `npx @redocly/cli lint api-spec/operator.yml` validates the spec after edits; its one existing error (no `servers` entry) is expected.
