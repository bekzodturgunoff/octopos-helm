# Octopos Helm

The console the Octopos team runs its clients from: who pays, who is about to, who is late, and which installations are broken — across every tenant at once. The dash (`kdsx-dash-v2`) is a client running _one_ business; Helm is us running _all_ of them.

Same stack and conventions as the dash: React 18 + Vite + TypeScript, TanStack Router (flat file routes) and TanStack Query, Tailwind 4 with `@yeahuz/kdsx-tailwind`, components from `@yeahuz/kdsx-react`, i18next, ECharts, `let` everywhere, Prettier at 200 columns.

## Running it

```bash
export NPM_TOKEN=…          # GitHub Packages, read:packages — same as the dash
pnpm install
cp env.example .env         # VITE_API_MOCK=on by default
pnpm dev                    # http://localhost:5180 (the dash keeps 5173)
```

With `VITE_API_MOCK=on` every request is answered in the browser by `src/api/mock` — 40 generated clients, invoices, payments, 128 installations, tasks and an activity log. Changes persist until the tab reloads. Sign in as `bekzod@octopos.uz` (owner) with any password; `dilnoza@`, `jasur@`, `madina@` and `aziz@octopos.uz` show the Manager, Support, Finance and Account manager (assigned clients only) views.

Set `VITE_API_MOCK=` (empty) and `VITE_API_URL` to talk to a real API.

## What is in it

| Area           | Route                                        | What it is for                                                                                                                                                  |
| -------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Overview       | `/`                                          | MRR and trend, past due, renewals this week, plan mix, fleet health, a ranked "needs attention" list                                                            |
| Clients        | `/clients`, `/clients/$id`                   | Search/filter/sort by health, MRR or renewal; a client page with subscription, billing, installations, notes, activity                                          |
| New client     | `/flows/new-client`                          | Create a tenant, owner, plan and trial in one form                                                                                                              |
| Billing        | `/billing/*`                                 | Renewals calendar, overdue (dunning) queue, invoices, payments, plans                                                                                           |
| Fleet          | `/fleet`, `/fleet/$id`, `/fleet/releases`    | Every installation judged from both heartbeats (logic ported from the dash's `lib/fleet.ts`), pin/pause/retire, release rollout                                 |
| Tasks          | `/tasks`                                     | Quick add, Mine / Everyone / Unassigned / Done with counts, search and filters, click to edit, snooze and assign from the row, tick with Undo, N for a new task |
| Announcements  | `/announcements`                             | Banners for the clients' dash, by plan or for everyone, scheduled or now                                                                                        |
| Access control | `/administration/roles/*`, `/flows/new-role` | Same as the dash: roles, role page, edit details, edit permissions (full access, search, grouped capabilities with scope), 3-step new-role flow                 |
| Administration | `/administration/*`                          | Team (invite, change role, disable), append-only activity log                                                                                                   |
| Settings       | `/settings/*`                                | Same layout as the dash: account card, language and appearance (incl. finish)                                                                                   |

New beyond the dash's admin section: **client health score** (payment 40% · activity 35% · installations 25%), **dunning queue** with a next step per account, **support sessions** into a client's dash (logged, with a reason), **renewal calendar** split autopay/manual, **release rollout** view, **tasks**, **announcements**, **notes**, **audit log**, **role-based access control** with custom roles and an _assigned clients only_ scope for account managers and a **⌘K palette** that finds clients by name, subdomain, owner or phone.

## For the backend

Everything the UI needs is in **`api-spec/operator.yml`** — 48 operations, OpenAPI 3.0, in the same RPC style as `kdsx-api/api-specs` (GET reads with query params, POST writes with a JSON body, the same `Money` and `Error` shapes). Each operation names the capability it must check as `x-capability`.

- **Two already exist** in kdsx-api: `operator.fleet.nodes` (add `tenantName` to each node) and `operator.fleet.retireNode`.
- **Auth**: every call sends `Authorization: Bearer <sessionID>` from `operator.auth.signIn`. The current static `OperatorToken` can be accepted on the same header while sessions are built.
- **Access control**: an operator holds one role; `operator.auth.me` returns the role's permissions as a map of capability → scope. The `assigned` scope must be enforced server-side on every client and billing list and on single reads/writes. The Owner role is built in (`internal`) and can never be edited or left without an active member.
- **Errors**: return kdsx-api's `Error` body; Helm shows `message` to the operator as-is, so write it for a person.
- **Server-owned rules** (the UI only displays them): health score and grade, the "needs attention" list, the dunning `nextStep`, MRR (yearly at a twelfth).
- **One dash change** is needed for announcements to reach clients: a read endpoint such as `announcements.current` and a banner like `SubscriptionExpiryBanner`.

### Switching from the mock to the real API

The frontend calls the API only through `src/api`:

- `types.ts` — every request and response type, field for field with the spec.
- `sdk.ts` — `xxxOptions({query})` and `xxxMutation()` in exactly the shape `@hey-api` generates into `@yeahuz/kdsx-api`, named by the spec's operationIds.
- `client.ts` — the one `fetch`, adding the bearer token and `Accept-Language`.

So there are two ways to go live:

1. **Point it at the API** — implement the spec and set `VITE_API_MOCK=` empty. Nothing else changes.
2. **Generate into kdsx-api** — add `operator.yml`'s paths to `api-specs`, publish, then replace `from "@/api"` with `from "@yeahuz/kdsx-api"` across `src/`. The function names already match.

Keep `src/api/mock` working when the contract changes: it is how the UI is developed and demoed without a backend.

## Checks

```bash
pnpm lint            # prefer-const is off: the house style declares with let
pnpm format:check
pnpm build           # tsc -b && vite build
```
