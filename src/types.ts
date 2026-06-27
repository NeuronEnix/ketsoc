// ─── Environment ────────────────────────────────────────────────────────────

export interface Env {
  SESSION_DO: DurableObjectNamespace<import("./session-do.js").SessionDO>;
  USER_DO: DurableObjectNamespace<import("./user-do.js").UserDO>;
}

// ─── Wire protocol – client facing ──────────────────────────────────────────

/** Sent by ketsoc to the client immediately after WS handshake. */
export interface WsConnectedEvent {
  type: "connected";
  userId: string;
  sessionId: string;
}

/** Sent by ketsoc to the client when a producer emits an event. */
export interface WsEventMessage {
  type: "event";
  event: string;
  data: unknown;
}

/** Sent by the client (React) to ketsoc. */
export interface WsClientMessage {
  type: "message";
  event: string;
  data: unknown;
}

export type WsOutboundMessage = WsConnectedEvent | WsEventMessage;
export type WsInboundMessage = WsClientMessage;

// ─── Internal DO-to-DO types ─────────────────────────────────────────────────

/** Stored inside UserDO to track a live session. */
export interface StoredSession {
  sessionId: string;
  userId: string;
  hint: string | null;
  connectedAt: number;
  /** serialised DO ID — reconstructed via idFromString() */
  sessionDoId: string;
}

/** Body sent from SessionDO → UserDO on connect. */
export interface RegisterSessionPayload {
  sessionId: string;
  userId: string;
  hint: string | null;
  connectedAt: number;
  sessionDoId: string;
}

/** Body sent from SessionDO → UserDO on close. */
export interface DeregisterSessionPayload {
  sessionId: string;
}

/** Body for the internal SessionDO /internal/send endpoint. */
export interface InternalSendPayload {
  event: string;
  data: unknown;
}

// ─── Public API types ────────────────────────────────────────────────────────

/** POST /emit body (Node server → ketsoc). */
export interface EmitPayload {
  userId: string;
  /** Omit to target the newest session. */
  sessionId?: string;
  event: string;
  data: unknown;
}

// ─── Response helpers ────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  code: string;
  msg: string;
  data: T;
}

export function okResponse<T>(data: T, status = 200): Response {
  const body: ApiResponse<T> = { code: "OK", msg: "OK", data };
  return Response.json(body, { status });
}

export function errResponse(
  code: string,
  msg: string,
  status: number
): Response {
  const body: ApiResponse<null> = { code, msg, data: null };
  return Response.json(body, { status });
}
