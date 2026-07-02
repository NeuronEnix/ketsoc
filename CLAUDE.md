# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**ketsoc** ("socket" reversed — never rename it) is a globally-distributed realtime socket-as-a-service on Cloudflare Workers + Durable Objects, with a dark-violet observability dashboard. Phase 1 (current) is the developer dashboard + backend: email/password auth, multi-tenancy (orgs → environments → API keys), and observability screens fed by **seeded (deterministic fake) telemetry** — there is no real socket traffic or telemetry store yet.

Design spec: `docs/superpowers/specs/2026-07-02-ketsoc-dashboard-design.md`. Work is tracked in Linear project **ketsoc** (team **Kaushik**); issue descriptions there are execution-ready specs — follow them as written. Active branch: `feat/dashboard`.

## Commands

Two independent TypeScript projects: the Worker at the repo root (`src/`) and the SPA in `dashboard/`. **The tree is green only when all eight gates pass — run both sets before every commit:**

```sh
pnpm typecheck && pnpm lint && pnpm test && pnpm build                # Worker (eslint --fix, vitest 3 on node)
pnpm -C dashboard typecheck && pnpm -C dashboard lint \
  && pnpm -C dashboard test && pnpm -C dashboard build                # Dashboard (oxlint, vitest 4 + jsdom, tsc -b + vite build)
```

Single test file: `pnpm vitest run src/auth/service.test.ts` or `pnpm -C dashboard vitest run src/routes/overview.test.tsx`. Tests are colocated `*.test.ts(x)` next to sources.

Local dev (split mode, recommended): `pnpm dev` (wrangler on :8787) + `pnpm dashboard:dev` (vite on :5173, proxies `/api` → :8787). Unified/production-like: `pnpm dashboard:build` then `pnpm dev` — the Worker serves `dashboard/dist` via the ASSETS binding (`run_worker_first` keeps `/api/*` on the Worker). First-time setup: copy `.dev.vars.example` → `.dev.vars` with a `JWT_SECRET`, then `pnpm db:migrate:local`. See README for the full walkthrough.

## Architecture

Request flow: `src/index.ts` (router) → `src/api/*` (thin HTTP handlers: parse path segments, auth, map service errors to statuses) → services (`src/auth/service.ts`, `src/tenancy/service.ts`, `src/keys/`, env service) → repo **interfaces** in `src/db/repos.ts` with D1 implementations. Everything returns the `{code, msg, data}` envelope (`src/contract.ts`, `errResponse` in `src/types.ts`).

- `src/api/services.ts` — `buildAuthService/buildEnvService/buildKeyService/buildOrgService(env)` factories plus `requireAuth(req, env)` which returns `PublicUser | Response` (a ready 401). Handlers check `instanceof Response` and return early.
- URL shape: `/api/orgs/:orgId/envs/:envId/{keys,metrics,connections,events,usage}` — `index.ts` has an `ENV_SCOPED` set and a single env-scoped dispatcher; don't add per-resource routing branches.
- Auth: PBKDF2 password hashes, HS256 JWT via WebCrypto (`src/auth/jwt.ts` — hand-rolled, constant-time compare, alg pinned), httpOnly cookies `ks_at` (path `/`) + `ks_rt` (path `/api/auth` only), rotating refresh sessions stored in D1. Login timing is equalized with a dummy hash.
- Seeded telemetry (`src/telemetry/*`): FNV-1a hash → mulberry32 PRNG keyed on (envId, mode, time bucket), so data is deterministic per environment yet appears live (sliding series, seq-keyed event tail, month-progress usage). Any new fake data must follow this pattern — never `Math.random()`.
- API keys: format `{kpk|ksk}.{env}.{kid}.{secret}`, SHA-256 hash at rest, plaintext returned exactly once at creation.
- Environment rules (enforced in the env service): names are exactly 4 lowercase letters, immutable; `prod` is reserved, permanent, and the only live-mode env; cap 5 per org; all others are test-mode.
- Durable Objects `SessionDO`/`UserDO` are declared and bound but are Phase-2 surface (socket runtime); Phase 1 doesn't route to them.

Dashboard (`dashboard/src/`): `routes/*` are the screens; `lib/*` holds the fetch client (`api.ts`) and one TanStack Query hook module per resource; `components/app-shell.tsx` is the heart — `OrgGate` (loading → onboarding when 0 orgs → shell), org/env switchers, `CurrentEnvProvider` (env selection self-heals across org switches, prefers `prod`). Framer Motion is loaded via `LazyMotion` + `m` + `domAnimation` only — never import `motion.*` (bundle size).

## Non-obvious constraints

- **TS strict extras**: `exactOptionalPropertyTypes` (declare optionals as `T | undefined`; pass optional params with conditional spread `...(x ? { x } : {})`) and `erasableSyntaxOnly` (no enums, namespaces, or constructor parameter properties).
- **Worker tests never touch D1.** Services are tested against in-memory repo fakes; D1 repos are thin SQL verified by wrangler-dev smokes. `@cloudflare/vitest-pool-workers` is known-broken for this setup (see Linear KAU-47) — don't re-attempt it.
- **Dashboard test harness**: `dashboard/src/test/setup.ts` stubs `ResizeObserver` and `Element.prototype.scrollIntoView` (cmdk needs both under jsdom). Screen tests `vi.mock` `../lib/api` (and `sonner` where toasts are asserted).
- **Onboarding gate is intentionally two-phase**: creating the org must NOT invalidate the `["orgs"]` query (that would unmount onboarding before the reveal-once key step); the parent invalidates on finish. Don't "fix" this.
- **Password policy is deliberate**: any non-empty password is valid. Do not add strength rules.
- **PBKDF2 is capped at 100,000 iterations on deployed Workers** — `crypto.subtle.deriveBits` throws above that in production (error 1101) while local workerd happily runs more, so this class of bug only appears after deploy. Keep `DEFAULT_ITERATIONS` and the `DUMMY_HASH` prefix at 100000.
- Verify features end-to-end (wrangler dev smoke or browser), not just unit tests, before calling them done. When smoke-testing with curl, quote header vars — an unquoted `-H Origin:$H` after `-b "$J"` folds into the Cookie header and corrupts the JWT (cost us hours; see KAU-81).

## Workflow rules (user-mandated)

- Commit format: `type(scope): intent` — e.g. `feat(dashboard): code-split routes`, `fix(auth): …`. Scope = top-level dir or module when the change is confined to it; optional otherwise. Types: feat/fix/chore/refactor/docs/test. **No `Co-Authored-By` trailer.**
- TDD: failing test first, then implementation; keep all eight gates green at every commit.
- Update the Linear issue (In Progress → Done with a completion comment) as part of finishing any tracked work; file follow-ups as new issues instead of leaving TODOs.
