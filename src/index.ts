import type { Env, EmitPayload } from "./types.js";
import { okResponse, errResponse } from "./types.js";
import { SessionDO } from "./session-do.js";
import { UserDO } from "./user-do.js";
import { AuthService } from "./auth/service.js";
import { OrgService } from "./tenancy/service.js";
import { EnvService } from "./tenancy/env-service.js";
import { KeyService } from "./keys/service.js";
import {
  D1UserRepo,
  D1SessionRepo,
  D1OrgRepo,
  D1MembershipRepo,
  D1EnvRepo,
  D1ApiKeyRepo,
} from "./db/d1-repos.js";
import { handleAuthRequest, getAuthUser } from "./api/auth.js";
import { handleOrgsRequest } from "./api/orgs.js";
import { handleEnvsRequest } from "./api/envs.js";
import { handleKeysRequest } from "./api/keys.js";
import { handleMetricsRequest } from "./api/metrics.js";
import { handleConnectionsRequest } from "./api/connections.js";

export { SessionDO, UserDO };

/**
 * Main Worker entrypoint.
 *
 * Routes:
 *   GET  /connect          — WebSocket upgrade (client-facing)
 *   POST /emit             — Emit event to a user (server/producer-facing)
 *   GET  /                 — Health check
 */
export default {
  async fetch(
    req: Request,
    env: Env,
    _ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(req.url);

    // ── Health check ─────────────────────────────────────────────────────────
    if (req.method === "GET" && url.pathname === "/healthz") {
      return okResponse({ service: "ketsoc", status: "ok" });
    }

    // ── Auth API ─────────────────────────────────────────────────────────────
    if (url.pathname.startsWith("/api/auth/")) {
      const authService = new AuthService({
        users: new D1UserRepo(env.DB),
        sessions: new D1SessionRepo(env.DB),
        jwtSecret: env.JWT_SECRET,
      });
      const authResponse = await handleAuthRequest(req, authService);
      if (authResponse) {
        return authResponse;
      }
    }

    // ── API keys (nested under envs, requires auth) ───────────────────────────
    if (
      url.pathname.startsWith("/api/orgs/") &&
      url.pathname.split("/")[4] === "envs" &&
      url.pathname.split("/")[6] === "keys"
    ) {
      const authService = new AuthService({
        users: new D1UserRepo(env.DB),
        sessions: new D1SessionRepo(env.DB),
        jwtSecret: env.JWT_SECRET,
      });
      const user = await getAuthUser(req, authService);
      if (!user) {
        return errResponse("UNAUTHENTICATED", "Not signed in", 401);
      }
      const orgService = new OrgService({
        orgs: new D1OrgRepo(env.DB),
        memberships: new D1MembershipRepo(env.DB),
      });
      const envService = new EnvService({ envs: new D1EnvRepo(env.DB) });
      const keyService = new KeyService({ keys: new D1ApiKeyRepo(env.DB) });
      return handleKeysRequest(
        req,
        { orgService, envService, keyService },
        user
      );
    }

    // ── Metrics API (nested under envs, requires auth) ────────────────────────
    if (
      url.pathname.startsWith("/api/orgs/") &&
      url.pathname.split("/")[4] === "envs" &&
      url.pathname.split("/")[6] === "metrics"
    ) {
      const authService = new AuthService({
        users: new D1UserRepo(env.DB),
        sessions: new D1SessionRepo(env.DB),
        jwtSecret: env.JWT_SECRET,
      });
      const user = await getAuthUser(req, authService);
      if (!user) {
        return errResponse("UNAUTHENTICATED", "Not signed in", 401);
      }
      const orgService = new OrgService({
        orgs: new D1OrgRepo(env.DB),
        memberships: new D1MembershipRepo(env.DB),
      });
      const envService = new EnvService({ envs: new D1EnvRepo(env.DB) });
      return handleMetricsRequest(req, { orgService, envService }, user);
    }

    // ── Connections API (nested under envs, requires auth) ────────────────────
    if (
      url.pathname.startsWith("/api/orgs/") &&
      url.pathname.split("/")[4] === "envs" &&
      url.pathname.split("/")[6] === "connections"
    ) {
      const authService = new AuthService({
        users: new D1UserRepo(env.DB),
        sessions: new D1SessionRepo(env.DB),
        jwtSecret: env.JWT_SECRET,
      });
      const user = await getAuthUser(req, authService);
      if (!user) {
        return errResponse("UNAUTHENTICATED", "Not signed in", 401);
      }
      const orgService = new OrgService({
        orgs: new D1OrgRepo(env.DB),
        memberships: new D1MembershipRepo(env.DB),
      });
      const envService = new EnvService({ envs: new D1EnvRepo(env.DB) });
      return handleConnectionsRequest(req, { orgService, envService }, user);
    }

    // ── Environments API (nested under orgs, requires auth) ───────────────────
    if (
      url.pathname.startsWith("/api/orgs/") &&
      url.pathname.split("/")[4] === "envs"
    ) {
      const authService = new AuthService({
        users: new D1UserRepo(env.DB),
        sessions: new D1SessionRepo(env.DB),
        jwtSecret: env.JWT_SECRET,
      });
      const user = await getAuthUser(req, authService);
      if (!user) {
        return errResponse("UNAUTHENTICATED", "Not signed in", 401);
      }
      const orgService = new OrgService({
        orgs: new D1OrgRepo(env.DB),
        memberships: new D1MembershipRepo(env.DB),
      });
      const envService = new EnvService({ envs: new D1EnvRepo(env.DB) });
      return handleEnvsRequest(req, { orgService, envService }, user);
    }

    // ── Orgs API (requires auth) ─────────────────────────────────────────────
    if (url.pathname.startsWith("/api/orgs")) {
      const authService = new AuthService({
        users: new D1UserRepo(env.DB),
        sessions: new D1SessionRepo(env.DB),
        jwtSecret: env.JWT_SECRET,
      });
      const user = await getAuthUser(req, authService);
      if (!user) {
        return errResponse("UNAUTHENTICATED", "Not signed in", 401);
      }
      const envService = new EnvService({ envs: new D1EnvRepo(env.DB) });
      const orgService = new OrgService({
        orgs: new D1OrgRepo(env.DB),
        memberships: new D1MembershipRepo(env.DB),
        // Every org is born with prod + test environments (spec §14 onboarding).
        seedEnvironments: (orgId) =>
          envService.seedDefaults(orgId).then(() => undefined),
      });
      return handleOrgsRequest(req, orgService, user);
    }

    // ── WebSocket connect ────────────────────────────────────────────────────
    if (req.method === "GET" && url.pathname === "/connect") {
      if (req.headers.get("Upgrade") !== "websocket") {
        return errResponse("NOT_WS", "Expected WebSocket upgrade", 426);
      }

      const userId = url.searchParams.get("userId");
      const hint = url.searchParams.get("hint") ?? null;
      let sessionId = url.searchParams.get("sessionId");

      if (!userId) {
        return errResponse("MISSING_PARAMS", "userId is required", 400);
      }

      // Generate a session ID if the client didn't provide one
      if (!sessionId) {
        sessionId = crypto.randomUUID();
      }

      // Route to a SessionDO — name = userId:sessionId so each session
      // gets its own DO instance, co-located with the connecting client
      const doId = env.SESSION_DO.idFromName(`${userId}:${sessionId}`);
      const stub = env.SESSION_DO.get(doId);

      // Forward the full request (including Upgrade header) to SessionDO
      const forwardUrl = new URL(req.url);
      forwardUrl.searchParams.set("userId", userId);
      forwardUrl.searchParams.set("sessionId", sessionId);
      if (hint) forwardUrl.searchParams.set("hint", hint);

      return stub.fetch(new Request(forwardUrl.toString(), req));
    }

    // ── Emit (producer → ketsoc → client) ────────────────────────────────────
    if (req.method === "POST" && url.pathname === "/emit") {
      let payload: EmitPayload;
      try {
        payload = (await req.json()) as EmitPayload;
      } catch {
        return errResponse("BAD_JSON", "Invalid JSON body", 400);
      }

      if (!payload.userId || !payload.event) {
        return errResponse(
          "MISSING_FIELDS",
          "userId and event are required",
          400
        );
      }

      const userDoId = env.USER_DO.idFromName(payload.userId);
      const userDo = env.USER_DO.get(userDoId);

      return userDo.fetch("http://internal/emit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: payload.sessionId,
          event: payload.event,
          data: payload.data ?? null,
        }),
      });
    }

    // ── Static assets / SPA fallback ─────────────────────────────────────────
    // API + socket routes are handled above; everything else serves the
    // dashboard SPA from the ASSETS binding (not_found_handling = SPA).
    return env.ASSETS.fetch(req);
  },
} satisfies ExportedHandler<Env>;
