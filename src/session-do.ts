import { DurableObject } from "cloudflare:workers";
import type {
  Env,
  WsConnectedEvent,
  WsEventMessage,
  InternalSendPayload,
  RegisterSessionPayload,
  DeregisterSessionPayload,
} from "./types.js";
import { okResponse, errResponse } from "./types.js";

/**
 * SessionDO — one instance per (userId + sessionId).
 *
 * Responsibilities:
 *   - Holds the actual WebSocket connection.
 *   - Registers itself with UserDO on connect, deregisters on close.
 *   - Receives /internal/send calls from UserDO and forwards to WS.
 *
 * Placement: CF creates this DO close to the connecting client, keeping
 * the hot WebSocket path geographically close and low-latency.
 */
export class SessionDO extends DurableObject<Env> {
  // ─── Internal /connect ────────────────────────────────────────────────────

  /**
   * Upgrades the HTTP request to a WebSocket, notifies UserDO, and returns
   * the client-side socket wrapped in a 101 response.
   *
   * Expected query params: userId, sessionId, hint (optional)
   */
  override async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);

    // ── Route: internal send from UserDO ────────────────────────────────────
    if (url.pathname === "/internal/send") {
      return this.handleInternalSend(req);
    }

    // ── Route: WebSocket upgrade ─────────────────────────────────────────────
    if (req.headers.get("Upgrade") !== "websocket") {
      return errResponse("NOT_WS", "Expected WebSocket upgrade", 426);
    }

    const userId = url.searchParams.get("userId");
    const sessionId = url.searchParams.get("sessionId");
    const hint = url.searchParams.get("hint") ?? null;

    if (!userId || !sessionId) {
      return errResponse(
        "MISSING_PARAMS",
        "userId and sessionId are required",
        400
      );
    }

    // Hibernate-style accept — survives DO restarts
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    this.ctx.acceptWebSocket(server, [userId, sessionId]);

    const connectedAt = Date.now();

    // Persist metadata so it survives hibernation
    await this.ctx.storage.put("meta", {
      userId,
      sessionId,
      hint,
      connectedAt,
    });

    // Send connected event to client
    const connectedMsg: WsConnectedEvent = {
      type: "connected",
      userId,
      sessionId,
    };
    server.send(JSON.stringify(connectedMsg));

    // Register with UserDO
    await this.registerWithUserDO({ userId, sessionId, hint, connectedAt });

    return new Response(null, { status: 101, webSocket: client });
  }

  // ─── WebSocket handlers (hibernation-safe) ────────────────────────────────

  override async webSocketMessage(
    ws: WebSocket,
    message: string | ArrayBuffer
  ): Promise<void> {
    // For now: log and forward to consumer webhook (webhook delivery parked for later)
    // The tags are [userId, sessionId]
    const tags = this.ctx.getTags(ws);
    const userId = tags[0] ?? "unknown";
    const sessionId = tags[1] ?? "unknown";
    console.log(
      `[SessionDO] message from userId=${userId} sessionId=${sessionId}`,
      message
    );

    // TODO: forward to registered consumer webhook
    void ws;
  }

  override async webSocketClose(
    ws: WebSocket,
    code: number,
    reason: string,
    _wasClean: boolean
  ): Promise<void> {
    const tags = this.ctx.getTags(ws);
    const userId = tags[0] ?? "unknown";
    const sessionId = tags[1] ?? "unknown";
    console.log(
      `[SessionDO] closed userId=${userId} sessionId=${sessionId} code=${code}`
    );

    ws.close(code, reason);
    await this.deregisterFromUserDO(userId, sessionId);
  }

  override async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    const tags = this.ctx.getTags(ws);
    console.error(`[SessionDO] error tags=${JSON.stringify(tags)}`, error);
    ws.close(1011, "internal error");
  }

  // ─── Internal send (called by UserDO) ────────────────────────────────────

  private async handleInternalSend(req: Request): Promise<Response> {
    let payload: InternalSendPayload;
    try {
      payload = (await req.json()) as InternalSendPayload;
    } catch {
      return errResponse("BAD_JSON", "Invalid JSON body", 400);
    }

    const sockets = this.ctx.getWebSockets();
    if (sockets.length === 0) {
      return errResponse(
        "NO_CONNECTION",
        "No active WebSocket for this session",
        404
      );
    }

    const msg: WsEventMessage = {
      type: "event",
      event: payload.event,
      data: payload.data,
    };
    const raw = JSON.stringify(msg);
    for (const ws of sockets) {
      ws.send(raw);
    }

    return okResponse(null);
  }

  // ─── UserDO coordination ──────────────────────────────────────────────────

  private async registerWithUserDO(params: {
    userId: string;
    sessionId: string;
    hint: string | null;
    connectedAt: number;
  }): Promise<void> {
    const userDo = this.getUserDO(params.userId);
    const body: RegisterSessionPayload = {
      ...params,
      sessionDoId: this.ctx.id.toString(),
    };
    await userDo.fetch("http://internal/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  private async deregisterFromUserDO(
    userId: string,
    sessionId: string
  ): Promise<void> {
    const userDo = this.getUserDO(userId);
    const body: DeregisterSessionPayload = { sessionId };
    await userDo.fetch("http://internal/deregister", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  private getUserDO(
    userId: string
  ): DurableObjectStub<import("./user-do.js").UserDO> {
    const id = this.env.USER_DO.idFromName(userId);
    return this.env.USER_DO.get(id);
  }
}
