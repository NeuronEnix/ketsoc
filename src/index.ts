import type { Env, EmitPayload } from "./types.js";
import { okResponse, errResponse } from "./types.js";
import { SessionDO } from "./session-do.js";
import { UserDO } from "./user-do.js";
import {
  buildAuthService,
  buildEnvService,
  buildKeyService,
  buildOrgService,
  requireAuth,
} from "./api/services.js";
import { handleAuthRequest } from "./api/auth.js";
import { handleOrgsRequest } from "./api/orgs.js";
import { handleEnvsRequest } from "./api/envs.js";
import { handleKeysRequest } from "./api/keys.js";
import { handleMetricsRequest } from "./api/metrics.js";
import { handleConnectionsRequest } from "./api/connections.js";
import { handleEventsRequest } from "./api/events.js";
import { handleUsageRequest } from "./api/usage.js";

export { SessionDO, UserDO };

// Env-scoped endpoints under /api/orgs/:org/envs/:env/<kind>.
const ENV_SCOPED = new Set([
  "keys",
  "metrics",
  "connections",
  "events",
  "usage",
]);

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
      const authResponse = await handleAuthRequest(req, buildAuthService(env));
      if (authResponse) {
        return authResponse;
      }
    }

    // ── Env-scoped APIs: /api/orgs/:org/envs/:env/<kind> (requires auth) ───────
    const segs = url.pathname.split("/");
    if (
      url.pathname.startsWith("/api/orgs/") &&
      segs[4] === "envs" &&
      segs[6] !== undefined &&
      ENV_SCOPED.has(segs[6])
    ) {
      const user = await requireAuth(req, env);
      if (user instanceof Response) {
        return user;
      }
      const orgService = buildOrgService(env);
      const envService = buildEnvService(env);
      switch (segs[6]) {
        case "keys":
          return handleKeysRequest(
            req,
            { orgService, envService, keyService: buildKeyService(env) },
            user
          );
        case "metrics":
          return handleMetricsRequest(req, { orgService, envService }, user);
        case "connections":
          return handleConnectionsRequest(
            req,
            { orgService, envService },
            user
          );
        case "events":
          return handleEventsRequest(req, { orgService, envService }, user);
        case "usage":
          return handleUsageRequest(req, { orgService, envService }, user);
      }
    }

    // ── Environments API (nested under orgs, requires auth) ───────────────────
    if (url.pathname.startsWith("/api/orgs/") && segs[4] === "envs") {
      const user = await requireAuth(req, env);
      if (user instanceof Response) {
        return user;
      }
      return handleEnvsRequest(
        req,
        { orgService: buildOrgService(env), envService: buildEnvService(env) },
        user
      );
    }

    // ── Orgs API (requires auth) ─────────────────────────────────────────────
    if (url.pathname.startsWith("/api/orgs")) {
      const user = await requireAuth(req, env);
      if (user instanceof Response) {
        return user;
      }
      const envService = buildEnvService(env);
      // Every org is born with prod + test environments (spec §14 onboarding).
      const orgService = buildOrgService(env, (orgId) =>
        envService.seedDefaults(orgId).then(() => undefined)
      );
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
