import { hashPassword, verifyPassword } from "./password.js";
import { signJwt, verifyJwt } from "./jwt.js";
import { generateSecret, sha256Hex } from "./tokens.js";
import { ID_PREFIXES, typeid } from "../ids.js";
import type { User, AuthSession, UserRepo, SessionRepo } from "../db/repos.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEFAULT_ACCESS_TTL_SEC = 15 * 60;
const DEFAULT_REFRESH_TTL_SEC = 30 * 24 * 60 * 60;

// A valid pbkdf2 hash of nothing useful — verified against when the email is
// unknown, so login timing doesn't reveal whether an account exists.
const DUMMY_HASH =
  "pbkdf2$100000$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";

export type AuthErrorCode =
  | "INVALID_EMAIL"
  | "INVALID_PASSWORD"
  | "EMAIL_TAKEN"
  | "INVALID_CREDENTIALS"
  | "INVALID_TOKEN"
  | "SESSION_EXPIRED";

export class AuthError extends Error {
  constructor(
    public readonly code: AuthErrorCode,
    message?: string
  ) {
    super(message ?? code);
    this.name = "AuthError";
  }
}

export interface SessionMeta {
  userAgent?: string | null;
  ip?: string | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  accessExpiresInSec: number;
  refreshExpiresInSec: number;
}

export interface PublicUser {
  id: string;
  email: string;
  displayName: string | null;
  createdAt: number;
}

export interface AuthServiceOptions {
  users: UserRepo;
  sessions: SessionRepo;
  jwtSecret: string;
  nowMs?: () => number;
  genId?: (prefix: string) => string;
  accessTtlSec?: number;
  refreshTtlSec?: number;
}

export class AuthService {
  private readonly users: UserRepo;
  private readonly sessions: SessionRepo;
  private readonly jwtSecret: string;
  private readonly nowMs: () => number;
  private readonly genId: (prefix: string) => string;
  private readonly accessTtlSec: number;
  private readonly refreshTtlSec: number;

  constructor(opts: AuthServiceOptions) {
    this.users = opts.users;
    this.sessions = opts.sessions;
    this.jwtSecret = opts.jwtSecret;
    this.nowMs = opts.nowMs ?? (() => Date.now());
    this.genId = opts.genId ?? ((p) => typeid(p));
    this.accessTtlSec = opts.accessTtlSec ?? DEFAULT_ACCESS_TTL_SEC;
    this.refreshTtlSec = opts.refreshTtlSec ?? DEFAULT_REFRESH_TTL_SEC;
  }

  async signup(
    email: string,
    password: string,
    meta?: SessionMeta
  ): Promise<{ user: PublicUser; tokens: AuthTokens }> {
    const normalized = normalizeEmail(email);
    if (!EMAIL_RE.test(normalized)) {
      throw new AuthError("INVALID_EMAIL");
    }
    if (password.length === 0) {
      throw new AuthError("INVALID_PASSWORD");
    }
    if (await this.users.findByEmail(normalized)) {
      throw new AuthError("EMAIL_TAKEN");
    }

    const user = await this.users.create({
      id: this.genId(ID_PREFIXES.user),
      email: normalized,
      passwordHash: await hashPassword(password),
      displayName: null,
      createdAt: this.nowMs(),
    });
    const tokens = await this.startSession(user, meta);
    return { user: toPublicUser(user), tokens };
  }

  async login(
    email: string,
    password: string,
    meta?: SessionMeta
  ): Promise<{ user: PublicUser; tokens: AuthTokens }> {
    const user = await this.users.findByEmail(normalizeEmail(email));
    const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !ok) {
      throw new AuthError("INVALID_CREDENTIALS");
    }
    const tokens = await this.startSession(user, meta);
    return { user: toPublicUser(user), tokens };
  }

  async refresh(refreshToken: string, meta?: SessionMeta): Promise<AuthTokens> {
    const parsed = parseRefreshToken(refreshToken);
    if (!parsed) {
      throw new AuthError("INVALID_TOKEN");
    }
    const session = await this.sessions.findById(parsed.sessionId);
    if (!session) {
      throw new AuthError("INVALID_TOKEN");
    }
    if (session.expiresAt <= this.nowMs()) {
      await this.sessions.deleteById(session.id);
      throw new AuthError("SESSION_EXPIRED");
    }
    const presentedHash = await sha256Hex(parsed.secret);
    if (!timingSafeEqual(presentedHash, session.refreshTokenHash)) {
      throw new AuthError("INVALID_TOKEN");
    }
    const user = await this.users.findById(session.userId);
    if (!user) {
      throw new AuthError("INVALID_TOKEN");
    }
    return this.rotateSession(session, user, meta);
  }

  async logout(refreshToken: string): Promise<void> {
    const parsed = parseRefreshToken(refreshToken);
    if (parsed) {
      await this.sessions.deleteById(parsed.sessionId);
    }
  }

  async userFromAccessToken(accessToken: string): Promise<PublicUser | null> {
    const claims = await verifyJwt(
      accessToken,
      this.jwtSecret,
      Math.floor(this.nowMs() / 1000)
    );
    const sub = claims?.["sub"];
    if (typeof sub !== "string") {
      return null;
    }
    const user = await this.users.findById(sub);
    return user ? toPublicUser(user) : null;
  }

  private async startSession(
    user: User,
    meta?: SessionMeta
  ): Promise<AuthTokens> {
    const now = this.nowMs();
    const sessionId = this.genId(ID_PREFIXES.session);
    const secret = generateSecret();
    const session: AuthSession = {
      id: sessionId,
      userId: user.id,
      refreshTokenHash: await sha256Hex(secret),
      userAgent: meta?.userAgent ?? null,
      ip: meta?.ip ?? null,
      expiresAt: now + this.refreshTtlSec * 1000,
      createdAt: now,
    };
    await this.sessions.create(session);
    return this.issueTokens(user, sessionId, secret);
  }

  private async rotateSession(
    session: AuthSession,
    user: User,
    meta?: SessionMeta
  ): Promise<AuthTokens> {
    const secret = generateSecret();
    const updated: AuthSession = {
      ...session,
      refreshTokenHash: await sha256Hex(secret),
      userAgent: meta?.userAgent ?? session.userAgent,
      ip: meta?.ip ?? session.ip,
      expiresAt: this.nowMs() + this.refreshTtlSec * 1000,
    };
    await this.sessions.update(updated);
    return this.issueTokens(user, session.id, secret);
  }

  private async issueTokens(
    user: User,
    sessionId: string,
    secret: string
  ): Promise<AuthTokens> {
    const accessToken = await signJwt(
      { sub: user.id, sid: sessionId },
      this.jwtSecret,
      this.accessTtlSec,
      Math.floor(this.nowMs() / 1000)
    );
    return {
      accessToken,
      refreshToken: `${sessionId}.${secret}`,
      accessExpiresInSec: this.accessTtlSec,
      refreshExpiresInSec: this.refreshTtlSec,
    };
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function toPublicUser(u: User): PublicUser {
  return {
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    createdAt: u.createdAt,
  };
}

function parseRefreshToken(
  token: string
): { sessionId: string; secret: string } | null {
  const idx = token.indexOf(".");
  if (idx <= 0) {
    return null;
  }
  const sessionId = token.slice(0, idx);
  const secret = token.slice(idx + 1);
  if (!sessionId || !secret) {
    return null;
  }
  return { sessionId, secret };
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
