import type { Env, EmitPayload } from "./types.js";
import { okResponse, errResponse } from "./types.js";
import { SessionDO } from "./session-do.js";
import { UserDO } from "./user-do.js";

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
    if (req.method === "GET" && url.pathname === "/") {
      return okResponse({ service: "ketsoc", status: "ok" });
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

    return errResponse("NOT_FOUND", "Route not found", 404);
  },
} satisfies ExportedHandler<Env>;
