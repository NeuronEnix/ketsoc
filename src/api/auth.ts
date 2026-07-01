import { AuthError } from "../auth/service.js";
import type {
  AuthService,
  AuthErrorCode,
  AuthTokens,
  PublicUser,
  SessionMeta,
} from "../auth/service.js";
import { serializeCookie, parseCookies } from "../auth/cookies.js";
import { errResponse } from "../types.js";
import type { ApiResponse } from "../contract.js";

const ACCESS_COOKIE = "ks_at";
const REFRESH_COOKIE = "ks_rt";
const REFRESH_PATH = "/api/auth";

const STATUS_BY_CODE: Record<AuthErrorCode, number> = {
  INVALID_EMAIL: 400,
  INVALID_PASSWORD: 400,
  EMAIL_TAKEN: 409,
  INVALID_CREDENTIALS: 401,
  INVALID_TOKEN: 401,
  SESSION_EXPIRED: 401,
};

function jsonWithCookies<T>(
  data: T,
  status: number,
  cookies: string[]
): Response {
  const body: ApiResponse<T> = {
    code: status < 400 ? "OK" : "ERROR",
    msg: "OK",
    data,
  };
  const headers = new Headers({ "Content-Type": "application/json" });
  for (const cookie of cookies) {
    headers.append("Set-Cookie", cookie);
  }
  return new Response(JSON.stringify(body), { status, headers });
}

function sessionCookies(tokens: AuthTokens, secure: boolean): string[] {
  return [
    serializeCookie(ACCESS_COOKIE, tokens.accessToken, {
      maxAgeSec: tokens.accessExpiresInSec,
      path: "/",
      httpOnly: true,
      secure,
      sameSite: "Lax",
    }),
    serializeCookie(REFRESH_COOKIE, tokens.refreshToken, {
      maxAgeSec: tokens.refreshExpiresInSec,
      path: REFRESH_PATH,
      httpOnly: true,
      secure,
      sameSite: "Lax",
    }),
  ];
}

function clearedCookies(secure: boolean): string[] {
  const opts = {
    maxAgeSec: 0,
    httpOnly: true,
    secure,
    sameSite: "Lax" as const,
  };
  return [
    serializeCookie(ACCESS_COOKIE, "", { ...opts, path: "/" }),
    serializeCookie(REFRESH_COOKIE, "", { ...opts, path: REFRESH_PATH }),
  ];
}

function checkOrigin(req: Request, url: URL): Response | null {
  const origin = req.headers.get("Origin");
  if (!origin) {
    return null;
  }
  try {
    if (new URL(origin).host !== url.host) {
      return errResponse("FORBIDDEN", "Origin not allowed", 403);
    }
  } catch {
    return errResponse("FORBIDDEN", "Bad origin", 403);
  }
  return null;
}

async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await req.json();
    return typeof body === "object" && body !== null
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function readString(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  return typeof value === "string" ? value : "";
}

function requestMeta(req: Request): SessionMeta {
  return {
    userAgent: req.headers.get("User-Agent"),
    ip: req.headers.get("CF-Connecting-IP"),
  };
}

/** Resolve the signed-in user from the access cookie (requireAuth helper). */
export async function getAuthUser(
  req: Request,
  service: AuthService
): Promise<PublicUser | null> {
  const token = parseCookies(req.headers.get("Cookie"))[ACCESS_COOKIE];
  if (!token) {
    return null;
  }
  return service.userFromAccessToken(token);
}

/**
 * Handle `/api/auth/*`. Returns null if the path isn't an auth route so the
 * caller can continue its own routing.
 */
export async function handleAuthRequest(
  req: Request,
  service: AuthService
): Promise<Response | null> {
  const url = new URL(req.url);
  if (!url.pathname.startsWith("/api/auth/")) {
    return null;
  }
  const route = url.pathname.slice("/api/auth/".length);
  const secure = url.protocol === "https:";

  try {
    switch (route) {
      case "signup":
      case "login": {
        if (req.method !== "POST") {
          return errResponse("METHOD_NOT_ALLOWED", "Use POST", 405);
        }
        const originError = checkOrigin(req, url);
        if (originError) {
          return originError;
        }
        const body = await readJson(req);
        if (!body) {
          return errResponse("BAD_JSON", "Invalid JSON body", 400);
        }
        const email = readString(body, "email");
        const password = readString(body, "password");
        const meta = requestMeta(req);
        const result =
          route === "signup"
            ? await service.signup(email, password, meta)
            : await service.login(email, password, meta);
        return jsonWithCookies(
          result.user,
          route === "signup" ? 201 : 200,
          sessionCookies(result.tokens, secure)
        );
      }

      case "refresh": {
        if (req.method !== "POST") {
          return errResponse("METHOD_NOT_ALLOWED", "Use POST", 405);
        }
        const originError = checkOrigin(req, url);
        if (originError) {
          return originError;
        }
        const rt = parseCookies(req.headers.get("Cookie"))[REFRESH_COOKIE];
        if (!rt) {
          return errResponse("INVALID_TOKEN", "No refresh token", 401);
        }
        const tokens = await service.refresh(rt, requestMeta(req));
        return jsonWithCookies(
          { ok: true },
          200,
          sessionCookies(tokens, secure)
        );
      }

      case "logout": {
        if (req.method !== "POST") {
          return errResponse("METHOD_NOT_ALLOWED", "Use POST", 405);
        }
        const rt = parseCookies(req.headers.get("Cookie"))[REFRESH_COOKIE];
        if (rt) {
          await service.logout(rt);
        }
        return jsonWithCookies({ ok: true }, 200, clearedCookies(secure));
      }

      case "me": {
        if (req.method !== "GET") {
          return errResponse("METHOD_NOT_ALLOWED", "Use GET", 405);
        }
        const user = await getAuthUser(req, service);
        if (!user) {
          return errResponse("UNAUTHENTICATED", "Not signed in", 401);
        }
        return jsonWithCookies(user, 200, []);
      }

      default:
        return errResponse("NOT_FOUND", "Unknown auth route", 404);
    }
  } catch (e) {
    if (e instanceof AuthError) {
      return errResponse(e.code, e.message, STATUS_BY_CODE[e.code]);
    }
    throw e;
  }
}
