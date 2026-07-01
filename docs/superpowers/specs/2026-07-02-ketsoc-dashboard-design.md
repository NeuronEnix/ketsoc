# ketsoc — Dashboard + Tenancy (Phase 1) Design Spec

**Date:** 2026-07-02
**Status:** Approved (owner delegated all remaining decisions; this doc is the source of truth)
**Branch:** `feat/dashboard`

---

## 1. Vision

**ketsoc** ("socket" reversed) is a globally-distributed realtime **socket-as-a-service** built on Cloudflare Durable Objects — a leaner, better-priced competitor to Ably / Pusher / PubNub. **Socket** is the first product; **Live Objects** and **Streaming** come later. The surface is organized by product so it grows into that roadmap.

This spec covers **Phase 1: the developer dashboard + the backend it needs.** The goal is an observability console so good a developer's first reaction is *"damn — every metric I want is right here."* Dark, violet, dense-but-breathable, real-time.

### Product framing shown in the UI
- **Socket** — live (the current product).
- **Live Objects**, **Streaming** — "Coming soon" nav entries (non-clickable placeholders).

---

## 2. Scope & phasing

**Phase 1 (this spec):**
- Email/password auth (roll-our-own, D1 + JWT httpOnly cookie).
- Tenancy: orgs, memberships, link-based invites, environments, API keys.
- The full dark/violet dashboard: Overview, Connections, Metrics, Events/Tail, Environments, API Keys, Usage, Settings.
- Backend the UI needs: auth + org/env/key CRUD + a metrics/query API + an SSE `/live` endpoint.
- **Data realism:** real where cheap (connections, events, messages, active users — from the existing socket + counting hooks), **seeded-but-realistic** for deep latency analytics (percentiles, RTT, region distribution, historical series). All behind one `TelemetryStore` interface so the seeded→real swap later only touches the server.

**Phase 2 (later, not now):** telemetry pipeline — instrument the DOs → Cloudflare Queue → D1 (later ClickHouse) → aggregation; dogfood the socket for the dashboard's own live feed; token-auth connect flow.

**Phase 3+:** JS SDK, then Live Objects / Streaming products.

**Explicitly out of scope for Phase 1:** billing/checkout (Usage screen shows real counts + a static plan card only), email delivery (invites are link-based), org `handle`/vanity subdomains (reserved column only), one-way delay metric (dropped), SSO/OAuth/2FA, password complexity rules.

---

## 3. Platform & architecture principles

**Committed substrate: Cloudflare Workers + Durable Objects.** Bring battle-tested distribution patterns *that fit DOs*; do not force patterns that fight the platform.

- **Use:** key-sharding via DO naming, a coordinator-DO for fan-out, hibernatable WebSockets, Cloudflare Queues for at-least-once ingest, idempotency keys, CQRS read-models to feed the dashboard, colocation of the hot WS path near clients.
- **Avoid forcing:** cross-shard transactions, always-on brokers (use Queues), global strong consistency beyond a single DO.
- **Storage split:**
  - **D1 (relational, low-volume, permanent):** accounts, orgs, memberships, invites, environments, api_keys, auth sessions.
  - **Telemetry/logs:** D1 **now** (fast to build) behind a `TelemetryStore` interface; destined for **ClickHouse** later (columnar, high-ingest). The interface is the seam — swapping the implementation must not touch callers.
- **All IDs:** UUIDv7 with a **TypeID** prefix (`org_…`, `env_…`, `usr_…`, `key_…`, `mbr_…`, `inv_…`, `conn_…`, `evt_…`). Prefixes give Stripe-grade DX; UUIDv7 gives time-sortable inserts (good for D1 today, ClickHouse tomorrow).

---

## 4. Repo structure

Single repo, worker at root, dashboard in a subfolder (no workspace tooling):

```
/                      # Cloudflare Worker (API + socket) — existing src/ stays
  src/
    index.ts           # worker entry + HTTP router (extended)
    session-do.ts      # existing SessionDO (+ lightweight counting hooks)
    user-do.ts         # existing UserDO
    types.ts           # existing wire/response types
    db/                # D1 access: schema, migrations, repositories
    auth/              # password hashing, JWT, cookies, middleware
    api/               # route handlers: auth, orgs, envs, keys, metrics, live
    telemetry/         # TelemetryStore interface + D1 impl + seeded generator
    ids.ts             # TypeID / UUIDv7 helpers
  migrations/          # D1 SQL migrations
  dashboard/           # Vite + React + TS SPA
    src/
      routes/          # screens
      components/      # UI + shadcn/ui
      lib/             # api client, hooks, formatters, sse
      styles/          # tailwind + theme tokens
  wrangler.jsonc       # + D1 binding, static assets binding, (Queue later)
  docs/superpowers/specs/
```

The Worker serves the built SPA via **Workers static assets** (single deploy). Dashboard dev runs on Vite with the API proxied. Shared API-contract types live in `src/types` and are consumed by the dashboard via a Vite path alias to avoid drift.

---

## 5. Data model (D1)

TypeIDs stored as `TEXT` primary keys. Timestamps as integer epoch-ms. All tables get `created_at`; mutable ones get `updated_at`.

### users
| col | type | notes |
|---|---|---|
| id | TEXT PK | `usr_…` |
| email | TEXT UNIQUE | lowercased, format-validated |
| password_hash | TEXT | PBKDF2/scrypt via WebCrypto (salt embedded) |
| display_name | TEXT | optional |
| created_at, updated_at | INTEGER | |

### orgs
| col | type | notes |
|---|---|---|
| id | TEXT PK | `org_…` — referenced everywhere internally |
| display_name | TEXT | editable label, 1–40 chars, any characters (trimmed) |
| handle | TEXT NULL UNIQUE | **reserved for later** (subdomain); unused in P1 |
| owner_user_id | TEXT FK→users | creator |
| created_at, updated_at | INTEGER | |

### memberships (user ↔ org, many-to-many)
| col | type | notes |
|---|---|---|
| id | TEXT PK | `mbr_…` |
| user_id | TEXT FK | |
| org_id | TEXT FK | |
| role | TEXT | `owner` \| `member` |
| created_at | INTEGER | |
| UNIQUE(user_id, org_id) | | |

**Limit:** a user may **own ≤ 5 orgs** (orgs where role=owner). Being invited into others doesn't count.

### invites (link-based)
| col | type | notes |
|---|---|---|
| id | TEXT PK | `inv_…` |
| org_id | TEXT FK | |
| token | TEXT UNIQUE | high-entropy; the invite link carries it |
| email | TEXT NULL | optional hint; not enforced in P1 |
| role | TEXT | granted on accept |
| status | TEXT | `pending` \| `accepted` \| `revoked` |
| invited_by | TEXT FK→users | |
| expires_at | INTEGER | e.g. +7 days |
| created_at | INTEGER | |

### environments
| col | type | notes |
|---|---|---|
| id | TEXT PK | `env_…` |
| org_id | TEXT FK | |
| name | TEXT | `^[a-z]{4}$` **immutable**; `prod` reserved |
| mode | TEXT | `live` (only `prod`) \| `test` (everything else) |
| is_permanent | INTEGER | 1 for `prod` (no delete/rename) |
| created_at | INTEGER | |
| UNIQUE(org_id, name) | | |

**Rules:** seed `prod` + `test` on org creation. Name = exactly 4 lowercase letters, **immutable once created**, unique within org, never `prod` (system-only). Any env deletable **except `prod`**. **Strict cap: 5 envs per org total.** `prod` → `mode=live` (billable); all others → `mode=test` (sandbox, unbilled, **TEST MODE** badge).

### api_keys
| col | type | notes |
|---|---|---|
| id | TEXT PK | `key_…` = the `kid` |
| env_id | TEXT FK | |
| type | TEXT | `public` (`kpk`) \| `secret` (`ksk`) |
| label | TEXT | editable metadata (e.g. "mobile app") |
| key_hash | TEXT | SHA-256 of the full key string |
| key_prefix | TEXT | display hint, e.g. `kpk.prod7f.a1b9c4.` |
| last_used_at | INTEGER NULL | |
| revoked_at | INTEGER NULL | |
| created_at | INTEGER | |

**Key format:** `{type}.{env}.{kid}.{secret}` → `kpk.prod7f.a1b9c4.Xq7Lm2…` / `ksk.…`.
- `type`: `kpk`/`ksk` — stable scannable prefix (secret-scanner friendly), encodes public/secret.
- `env`: 6-char ref derived from `env_id`.
- `kid`: short id linking to the `api_keys` row → **O(1) lookup + revoke** without storing the secret.
- `secret`: 32 bytes CSPRNG, base62.
- Stored as **SHA-256 only** (high-entropy → no bcrypt needed). Shown **once** on creation. Optional CRC checksum suffix deferred to P2.

### auth_sessions
| col | type | notes |
|---|---|---|
| id | TEXT PK | `ses_…` |
| user_id | TEXT FK | |
| refresh_token_hash | TEXT | rotating refresh |
| user_agent, ip | TEXT | audit |
| expires_at | INTEGER | |
| created_at | INTEGER | |

### Telemetry tables (D1 now, behind `TelemetryStore`)
- **events** (`evt_…`, env_id, ts, type [`connect`/`disconnect`/`message_in`/`message_out`/`error`], conn_id, region, event_name, bytes, meta JSON) — powers the Events/Tail + log explorer.
- **connections** (conn_id, env_id, user_ref, region, connected_at, disconnected_at, last_seen, msgs_in, msgs_out) — live/recent connections.
- **metric_rollups** (env_id, bucket_ts, granularity, connections, msgs_in, msgs_out, latency p50/p95/p99/p999, rtt p50/p95/p99, errors, by_region JSON) — pre-aggregated series for charts; seeded generator fills history + rolling live buckets in P1.

---

## 6. Auth design

- **Signup:** email + password → create user + auto-create their first org happens in **onboarding** (see §14), not on the signup form.
- **Password hashing:** WebCrypto **PBKDF2-HMAC-SHA-256** (high iteration count) or scrypt; salt + params embedded in the stored string. No external native deps (Workers-compatible). **No complexity rules** (per owner) — any non-empty password accepted.
- **Email:** standard format validation, stored lowercased, unique.
- **Sessions:** short-lived **access JWT** (~15 min) + rotating **refresh** (in `auth_sessions`), both delivered as **httpOnly, Secure, SameSite=Lax cookies**. CSRF mitigated by SameSite + (for mutations) an origin check. `jsonwebtoken` already present, but prefer WebCrypto/`jose`-style HS256 signing that runs cleanly on Workers.
- **Middleware:** `requireAuth` (valid access cookie → user), `requireOrg` (membership check → role), `requireEnv` (env belongs to org).
- **Endpoints:** `POST /api/auth/signup`, `/login`, `/logout`, `POST /api/auth/refresh`, `GET /api/auth/me`.

---

## 7. Tenancy

- New account → onboarding creates the user's **first org** (name it) + seeds `prod`+`test` + reveals first keys.
- **Roles:** `owner` (manage members, envs, keys, delete org) / `member` (full read + operational: view metrics, create/rotate keys, manage non-prod envs — final split tunable, default: members can do everything except manage members & delete org).
- **Invites:** owner generates a link (`/invite/{token}`); accepting requires sign-in/up then joins the org.
- **Limits:** ≤ 5 owned orgs per user; ≤ 5 envs per org.
- **Switchers:** top-bar **Org switcher** + **Environment switcher**; selection scopes the whole app and is reflected in the URL (`/o/{org_id}/e/{env}/…`).

---

## 8. API surface (Worker, all under `/api`, JSON envelope `{code,msg,data}`)

- **auth:** signup, login, logout, refresh, me
- **orgs:** `GET /orgs`, `POST /orgs`, `GET /orgs/:id`, `PATCH /orgs/:id` (display_name), `DELETE /orgs/:id`
- **members:** `GET /orgs/:id/members`, `POST /orgs/:id/invites`, `GET /orgs/:id/invites`, `POST /invites/:token/accept`, `DELETE …/members/:mbrId`, `DELETE …/invites/:invId`
- **environments:** `GET /orgs/:id/envs`, `POST /orgs/:id/envs` (validate `^[a-z]{4}$`, cap 5), `DELETE …/envs/:envId` (block `prod`)
- **api keys:** `GET /envs/:envId/keys`, `POST /envs/:envId/keys` (returns full key once), `PATCH …/keys/:keyId` (label), `DELETE …/keys/:keyId` (revoke)
- **metrics:** `GET /envs/:envId/metrics/overview`, `/series?metric=&range=&granularity=`, `/connections`, `/connections/:connId`, `/usage`
- **events:** `GET /envs/:envId/events?filter…` (log explorer, cursor-paginated)
- **live:** `GET /envs/:envId/live` (SSE stream of metric ticks + event feed)

Keep the existing socket routes (`/connect`, `/emit`, `/`) untouched; add free counting hooks in `SessionDO`/`UserDO` that write `events`/`connections` via `TelemetryStore`.

---

## 9. Live updates

Phase 1: **SSE** from `/api/envs/:envId/live` pushing (a) rolling metric ticks and (b) recent events, ~1/sec, from the seeded generator + real counters. Robust, no extra infra. Phase 2 swaps this to dogfood the ketsoc socket itself.

---

## 10. Dashboard information architecture (screens)

Auth: **Sign in**, **Sign up**, **Onboarding** (name org → seed envs → reveal keys), **Accept invite**.

App shell: left product nav (Socket ▸ Overview/Connections/Metrics/Events; Live Objects/Streaming = coming soon; bottom: Environments, API Keys, Usage, Settings), top bar (org switcher, env switcher + TEST MODE badge, ⌘K, user menu).

1. **Overview** — the "damn" screen: live connection count (animated), msgs/sec in/out, latency chips **p50/p95/p99/p99.9 (tail)**, RTT, active users, sparklines, a live event ticker, region breakdown, connection/throughput mini-charts.
2. **Connections** — real-time table (conn id, region, latency, RTT, duration, msgs), row → detail drawer.
3. **Metrics** — time-series explorer + range picker: latency histogram & percentile bands over time, throughput, disconnect/error rate, per-region.
4. **Events / Tail** — live tail (beautiful `wrangler tail`) + filterable log explorer (env, type, event name, conn, time; cursor pagination). This is "query the database."
5. **Environments** — list/create (4-letter rule, cap 5)/delete (not `prod`); mode + TEST MODE badges.
6. **API Keys** — per env: list, create (reveal-once modal, copy-on-click), relabel, revoke; `kpk`/`ksk` clearly distinguished.
7. **Usage** — real counts (connections, messages, connection-minutes) vs a static plan card; live vs test split.
8. **Settings** — profile, org (display name, members + invites, danger zone: delete org).

---

## 11. Visual design system (LOCKED)

**Mood:** Vercel × Linear × PlanetScale, with a ketsoc **violet soul**. Dark-first, high data density, precise, alive.

**Palette (dark):**
- Canvas `#08080B`; elevated surfaces `#0F0F16`, `#16161F`; hairline borders `rgba(255,255,255,0.06)` / `#1C1C26`.
- Text: primary `#EDEDF2`, muted `#9A9AA8`, faint `#6B6B78`.
- **Brand violet** `#7C5CFF` (primary), bright/glow `#9D7BFF`, deep `#5B3FD6`; accent gradient violet→indigo `#7C5CFF → #4E3CCB` (and a magenta `#C15CFF` for the second data series).
- Semantic (desaturated for dark): success `#3ECF8E`, warning `#F5A623`, error `#FF5C7A`, info `#5CC8FF`.
- Data-viz sequence: violet, cyan, magenta, amber, green — colorblind-reasonable, high contrast on `#08080B`.

**Typography:** UI = **Inter** (or Geist). Numbers/metrics/IDs/keys/code = **JetBrains Mono** with **tabular figures** — the developer signal. Big metric readouts are mono, medium weight.

**Components:** **shadcn/ui** (Radix + Tailwind), **Lucide** icons. Cards: elevated surface + hairline border + subtle inner top highlight + soft violet glow on hover/active. Buttons: violet primary (with faint glow), ghost/secondary subdued. Inputs dark with violet focus ring.

**Charts:** **uPlot** for high-frequency time-series (latency, throughput, connections) — canvas, extremely fast; **Recharts/visx** for simpler bars/donuts; custom SVG sparklines. Latency shown as percentile bands + a histogram. Numbers animate (count-up / tick).

**Motion:** Framer Motion — subtle. Live pulse dots, count-up numbers, skeleton loaders, smooth drawer/dialog transitions, route fades. Nothing gratuitous.

**Signature dev-delight details:** ⌘K command palette; copy-on-click for every key/ID (mono + check animation); **TEST MODE** badge on non-prod; live "connected" pulse; latency p50/p95/p99/**p99.9** as distinct chips; region flags; empty states with personality; `sonner` toasts; keyboard nav; fully responsive; respects `prefers-reduced-motion`.

**Accessibility:** WCAG AA contrast on all text, focus-visible rings, ARIA on interactive components (Radix gives most of this), reduced-motion support.

---

## 12. Frontend architecture

- **Vite + React 18 + TypeScript** SPA. Router: React Router (data routes) or TanStack Router. Server state: **TanStack Query**. Light client state: Zustand or context. Forms: React Hook Form + Zod (Zod also validates the org/env/key rules client-side, mirrored server-side).
- **API client:** typed fetch wrapper around the `{code,msg,data}` envelope; cookies carry auth; 401 → refresh → retry → redirect to login.
- **SSE hook:** `useLiveStream(envId)` feeding Overview/Connections/Events.
- **Theme tokens** in Tailwind config (the palette above) as CSS variables; single dark theme (purple) for P1.

---

## 13. Socket core integration

Existing `SessionDO`/`UserDO` stay. Add **free counting hooks**: on connect/disconnect/message, write an `events` row and update `connections`/`metric_rollups` via `TelemetryStore` (async, non-blocking, best-effort). Connections are scoped by env: DO naming becomes `{env_id}:{userId}:{sessionId}` once keys resolve an env (public key → env). Full token-auth connect is P2; P1 wires the schema + counting so the dashboard shows real connection/message/active-user data.

---

## 14. Onboarding flow

Signup (email+pw) → **Create your organization** (display name) → auto-seed `prod`+`test` → **Your API keys** (reveal `kpk`/`ksk` for `prod`, copy-on-click, "store the secret now") → land on Overview. Accepting an invite routes into the inviting org instead of creating one.

---

## 15. Testing strategy

- **Unit:** validators (email, org name, env `^[a-z]{4}$`, key format/parse), password hashing round-trip, TypeID gen/parse, JWT/cookie logic, TelemetryStore (D1 impl + seeded generator), limit enforcement (≤5 orgs, ≤5 envs, prod-undeletable).
- **Integration (Workers test env / Miniflare + D1):** auth flows, org/env/key CRUD with authz, metrics endpoints, SSE emits, socket counting hooks.
- **Frontend:** component tests (Vitest + Testing Library) for critical flows (auth, key reveal, env create limits), plus a smoke e2e (Playwright) for signup→onboarding→overview.
- **TDD throughout** (superpowers:test-driven-development). Never merge a broken tree; typecheck + lint + tests + build must pass.

---

## 16. Non-goals / YAGNI (Phase 1)

Billing/checkout, email delivery, org handles/subdomains, one-way delay, SSO/OAuth/2FA, password rules, project/app layer between org and env, multi-theme (dark-violet only), the ClickHouse implementation (interface only), the JS SDK.

---

## 17. Roadmap after Phase 1

**P2:** telemetry pipeline (DO instrumentation → Queue → D1→ClickHouse), real analytics replacing seeded, token-auth connect, dogfood socket for `/live`. **P3:** JS SDK. **P4+:** Live Objects, Streaming; billing; org handles + custom domains (CNAME).

---

## 18. Decisions taken (owner-delegated defaults)

Frontend = Vite React SPA · Auth = roll-our-own D1+JWT · Data = real base + seeded analytics · Repo = single repo + `/dashboard` · IDs = TypeID/UUIDv7 · Org = id+display_name (handle reserved) · Envs = prod+test seeded, 4-letter immutable names, prod reserved, cap 5, live/test mode · Keys = `kpk`/`ksk` `{type}.{env}.{kid}.{secret}`, SHA-256 at rest · Members = owner/member, link invites · Dropped one-way delay · Theme = dark violet (locked palette above).
