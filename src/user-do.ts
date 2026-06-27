import { DurableObject } from "cloudflare:workers";
import type {
  Env,
  StoredSession,
  RegisterSessionPayload,
  DeregisterSessionPayload,
  InternalSendPayload,
} from "./types.js";
import { okResponse, errResponse } from "./types.js";

/**
 * UserDO — one instance per userId.
 *
 * Responsibilities:
 *   - Tracks all live sessions for a user: { sessionId → StoredSession }
 *   - Routes /emit: resolves userId (+ optional sessionId) → SessionDO stub → sends
 *   - Lightweight metadata only — not in the hot WS data path
 *
 * Placement: idFromName(userId) — CF picks a consistent location.
 * Since this is metadata-only (not streaming), one global location is fine.
 */
export class UserDO extends DurableObject<Env> {
  /** In-memory session map — rebuilt from storage on cold start if needed. */
  private sessions = new Map<string, StoredSession>();
  private initialized = false;

  // ─── Route dispatcher ─────────────────────────────────────────────────────

  override async fetch(req: Request): Promise<Response> {
    await this.ensureInitialized();

    const url = new URL(req.url);

    if (req.method === "POST" && url.pathname === "/register") {
      return this.handleRegister(req);
    }

    if (req.method === "POST" && url.pathname === "/deregister") {
      return this.handleDeregister(req);
    }

    if (req.method === "POST" && url.pathname === "/emit") {
      return this.handleEmit(req);
    }

    return errResponse("NOT_FOUND", "Unknown route", 404);
  }

  // ─── Register / deregister ────────────────────────────────────────────────

  private async handleRegister(req: Request): Promise<Response> {
    let payload: RegisterSessionPayload;
    try {
      payload = (await req.json()) as RegisterSessionPayload;
    } catch {
      return errResponse("BAD_JSON", "Invalid JSON body", 400);
    }

    const session: StoredSession = { ...payload };
    this.sessions.set(payload.sessionId, session);
    await this.persistSessions();

    console.log(
      `[UserDO] registered userId=${payload.userId} sessionId=${payload.sessionId} total=${this.sessions.size}`
    );
    return okResponse(null);
  }

  private async handleDeregister(req: Request): Promise<Response> {
    let payload: DeregisterSessionPayload;
    try {
      payload = (await req.json()) as DeregisterSessionPayload;
    } catch {
      return errResponse("BAD_JSON", "Invalid JSON body", 400);
    }

    this.sessions.delete(payload.sessionId);
    await this.persistSessions();

    console.log(
      `[UserDO] deregistered sessionId=${payload.sessionId} remaining=${this.sessions.size}`
    );
    return okResponse(null);
  }

  // ─── Emit ─────────────────────────────────────────────────────────────────

  private async handleEmit(req: Request): Promise<Response> {
    let payload: InternalSendPayload & { sessionId?: string };
    try {
      payload = (await req.json()) as InternalSendPayload & {
        sessionId?: string;
      };
    } catch {
      return errResponse("BAD_JSON", "Invalid JSON body", 400);
    }

    if (this.sessions.size === 0) {
      // No active connections — drop silently as agreed
      return okResponse({ dropped: true });
    }

    const target = payload.sessionId
      ? this.sessions.get(payload.sessionId)
      : this.getNewestSession();

    if (!target) {
      return okResponse({ dropped: true });
    }

    const sessionDoStub = this.env.SESSION_DO.get(
      this.env.SESSION_DO.idFromString(target.sessionDoId)
    );

    const sendPayload: InternalSendPayload = {
      event: payload.event,
      data: payload.data,
    };
    const res = await sessionDoStub.fetch("http://internal/internal/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sendPayload),
    });

    if (!res.ok) {
      // Session DO unreachable — clean it up and drop
      console.warn(
        `[UserDO] SessionDO unreachable for sessionId=${target.sessionId}, dropping`
      );
      this.sessions.delete(target.sessionId);
      await this.persistSessions();
      return okResponse({ dropped: true });
    }

    return okResponse({ delivered: true, sessionId: target.sessionId });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private getNewestSession(): StoredSession | null {
    let newest: StoredSession | null = null;
    for (const session of this.sessions.values()) {
      if (!newest || session.connectedAt > newest.connectedAt) {
        newest = session;
      }
    }
    return newest;
  }

  private async persistSessions(): Promise<void> {
    const arr = Array.from(this.sessions.values());
    await this.ctx.storage.put("sessions", arr);
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;
    const stored = await this.ctx.storage.get<StoredSession[]>("sessions");
    if (stored) {
      for (const s of stored) {
        this.sessions.set(s.sessionId, s);
      }
    }
    this.initialized = true;
  }
}
