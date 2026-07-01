# ketsoc

**Globally-distributed realtime sockets-as-a-service, on the edge.**

`ketsoc` (socket → soc·ket → **ket·soc**) is a realtime messaging backend built on
Cloudflare Durable Objects, plus a dark-violet observability dashboard that puts your
connections, throughput, and tail latency front and centre. It's meant to be the leaner,
better-priced alternative to Ably / Pusher / PubNub.

> **Status — Phase 1 (developer platform).** What runs today: email/password auth,
> multi-tenant orgs with owner/member roles and link invites, environments (immutable
> names, `prod` reserved + permanent, 5 max), reveal-once API keys, and a live
> observability **Overview** screen
> driven by a deterministic seeded-metrics engine. The realtime data plane (`/connect`,
> `/emit`) is scaffolded; SDKs and the ClickHouse-backed telemetry pipeline come next.

---

## Architecture

```
                         ┌──────────────────────────────────────────┐
  Browser (SPA)  ───────▶│  Cloudflare Worker  (src/index.ts)        │
  React 19 + Vite        │                                           │
                         │  /api/*   → auth · orgs · envs · keys ·   │
                         │             metrics   (D1-backed)         │
                         │  /connect,/emit → realtime data plane     │
                         │  everything else → SPA from ASSETS        │
                         └───────┬───────────────────┬───────────────┘
                                 │                   │
                     ┌───────────▼──────┐   ┌────────▼──────────┐
                     │  Durable Objects │   │  D1 (SQLite)      │
                     │  SessionDO       │   │  users, sessions, │
                     │  UserDO          │   │  orgs, envs, keys │
                     └──────────────────┘   └───────────────────┘
```

- **Worker** (`src/`) — TypeScript, NodeNext, strict. Routes `/api/*`, the realtime
  endpoints, and serves the built dashboard as a single-page app via the `ASSETS` binding.
- **Durable Objects** — `SessionDO`, `UserDO` (per-tenant realtime state).
- **D1** — relational store today; sits behind repository interfaces (`src/db/repos.ts`) so
  it can be swapped for ClickHouse-style telemetry later without touching services.
- **Dashboard** (`dashboard/`) — React 19 + TanStack Query + React Router + Tailwind v4.

---

## Prerequisites

- **Node** ≥ 20
- **pnpm** ≥ 9 — `corepack enable && corepack prepare pnpm@latest --activate`
- **Wrangler** — installed as a dev dependency; no global install needed.

---

## Setup

```bash
# 1. Install workspace + dashboard deps
pnpm install
pnpm --dir dashboard install

# 2. Local secrets — copy the example and set a long random JWT secret
cp .dev.vars.example .dev.vars
#   then edit .dev.vars → JWT_SECRET="…"

# 3. Create the local D1 database and apply migrations
pnpm db:migrate:local
```

`.dev.vars` is gitignored. In production, set the secret with
`wrangler secret put JWT_SECRET` instead.

---

## Run it locally

There are two ways to run the stack. Use **split dev** while developing the UI (instant HMR),
and **unified** to sanity-check exactly what ships to production.

### Split dev (recommended for development)

Two terminals:

```bash
# Terminal 1 — the Worker + D1 on http://localhost:8787
pnpm dev

# Terminal 2 — the dashboard with hot reload on http://localhost:5173
pnpm dashboard:dev
```

Open **http://localhost:5173**. Vite proxies `/api/*` to the Worker on `:8787`
(see `dashboard/vite.config.ts`), so auth, orgs, and live metrics all work end-to-end.
Sign up, create an org and an environment, generate an API key, and watch the live
Overview. (Auto-provisioning a personal org with `prod` + `test` on signup is on the
roadmap — see KAU-63.)

### Unified (production-like)

Build the SPA, then let the Worker serve it from the `ASSETS` binding:

```bash
pnpm dashboard:build   # → dashboard/dist
pnpm dev               # Worker serves API + SPA on http://localhost:8787
```

Open **http://localhost:8787** — one origin, exactly as deployed.

---

## Deploy to Cloudflare

```bash
pnpm db:create                 # one-time: creates the D1 DB; copy the id into wrangler.jsonc
pnpm db:migrate                # apply migrations to the remote D1
wrangler secret put JWT_SECRET # set the production secret
pnpm dashboard:build           # build the SPA the Worker will serve
wrangler deploy                # ship the Worker + assets
```

---

## Scripts

**Root (Worker):**

| Script                                        | What it does                                  |
| --------------------------------------------- | --------------------------------------------- |
| `pnpm dev`                                    | `wrangler dev` — Worker + D1 + DOs on `:8787` |
| `pnpm test`                                   | Worker unit tests (Vitest)                    |
| `pnpm typecheck`                              | `tsc --noEmit`                                |
| `pnpm lint`                                   | ESLint (`--fix`)                              |
| `pnpm build`                                  | Type-emit build (`tsc`)                       |
| `pnpm db:migrate:local`                       | Apply D1 migrations to the local DB           |
| `pnpm db:migrate`                             | Apply D1 migrations to the remote DB          |
| `pnpm dashboard:dev` / `pnpm dashboard:build` | Proxy to the dashboard workspace              |

**Dashboard (`dashboard/`):** `pnpm dev`, `pnpm build`, `pnpm test`, `pnpm typecheck`, `pnpm lint`.

---

## Project layout

```
src/                    Worker
  index.ts              router: /healthz, /connect, /emit, /api/*, SPA fallback
  auth/                 password (PBKDF2), JWT (HS256), cookies, tokens, service
  tenancy/              org + environment services
  keys/                 API-key format + service
  api/                  HTTP handlers (auth, orgs, envs, keys, metrics)
  db/                   repo interfaces + in-memory fakes + D1 implementations
  telemetry/seed.ts     deterministic seeded-metrics engine
dashboard/src/          React SPA (routes, lib hooks, ui primitives, app shell)
migrations/             D1 schema (0001_init … 0005_api_keys)
docs/superpowers/specs/ design spec (source of truth)
```

---

## Testing

```bash
pnpm test                 # Worker unit tests
pnpm --dir dashboard test # Dashboard component tests
```

Services are tested against in-memory repository fakes; the D1 implementations are verified
by running `wrangler dev` against a real local D1. TDD throughout — the tree stays green
(typecheck + lint + tests + build) on every commit.

---

## Core concepts

- **IDs** — TypeID: a UUIDv7 with a type prefix (`usr_…`, `org_…`, `env_…`, `key_…`),
  sortable and self-describing.
- **API keys** — formatted `{type}.{env}.{kid}.{secret}` (e.g. `kpk`/`ksk` for
  publishable/secret). Stored as SHA-256; the secret is shown **once** at creation.
- **Environments** — names are `^[a-z]{4}$`, immutable once created. `prod` is
  reserved, permanent, and live-mode; everything else is test-mode. Capped at 5 per org.
  (Seeding `prod` + `test` automatically on org creation is on the roadmap — KAU-63.)

---

## Tech stack

Cloudflare Workers · Durable Objects · D1 · TypeScript (strict) ·
React 19 · Vite · Tailwind v4 · TanStack Query · React Router · Radix · lucide-react.
