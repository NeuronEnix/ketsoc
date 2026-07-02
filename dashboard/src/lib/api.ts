import type { ApiResponse } from "@shared/contract";

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

// 401s from these endpoints are real answers (bad credentials, dead session),
// not a sign the short-lived access cookie expired — never refresh-retry them.
const NO_REFRESH = new Set([
  "/api/auth/login",
  "/api/auth/signup",
  "/api/auth/logout",
  "/api/auth/refresh",
]);

let refreshInFlight: Promise<boolean> | null = null;

/** Rotate the session via the refresh cookie; deduped across concurrent 401s. */
function refreshSession(): Promise<boolean> {
  refreshInFlight ??= fetch("/api/auth/refresh", {
    method: "POST",
    credentials: "include",
  })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}

/** The refresh cookie is dead too — the SPA state is unusable, start over. */
function sessionExpired(): void {
  const { pathname } = window.location;
  if (pathname !== "/login" && pathname !== "/signup") {
    try {
      window.location.assign("/login");
    } catch {
      // jsdom: navigation isn't implemented; the ApiError below still surfaces.
    }
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  isRetry = false
): Promise<T> {
  const hasBody = body !== undefined;
  const res = await fetch(path, {
    method,
    credentials: "include",
    headers: hasBody ? { "Content-Type": "application/json" } : undefined,
    body: hasBody ? JSON.stringify(body) : undefined,
  });

  // Expired access cookie? Refresh the session once and replay the request.
  if (res.status === 401 && !isRetry && !NO_REFRESH.has(path)) {
    if (await refreshSession()) {
      return request<T>(method, path, body, true);
    }
    // `/me` is the auth probe — its 401 means "signed out", which callers
    // (useMe → ProtectedShell / the landing page) handle declaratively.
    if (path !== "/api/auth/me") {
      sessionExpired();
    }
  }

  let payload: ApiResponse<T> | null = null;
  try {
    payload = (await res.json()) as ApiResponse<T>;
  } catch {
    payload = null;
  }

  if (!res.ok || !payload) {
    throw new ApiError(
      payload?.code ?? "NETWORK",
      payload?.msg || res.statusText || "Request failed",
      res.status
    );
  }
  return payload.data;
}

export const api = {
  get: <T>(path: string): Promise<T> => request<T>("GET", path),
  post: <T>(path: string, body?: unknown): Promise<T> =>
    request<T>("POST", path, body),
  patch: <T>(path: string, body?: unknown): Promise<T> =>
    request<T>("PATCH", path, body),
  del: <T>(path: string): Promise<T> => request<T>("DELETE", path),
};

/** Map an API error to a friendly, user-facing message. */
export function authErrorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    switch (e.code) {
      case "INVALID_CREDENTIALS":
        return "Wrong email or password.";
      case "EMAIL_TAKEN":
        return "That email is already registered.";
      case "INVALID_EMAIL":
        return "Enter a valid email address.";
      case "INVALID_PASSWORD":
        return "Enter a password.";
      default:
        return e.message || "Something went wrong.";
    }
  }
  return "Something went wrong. Please try again.";
}
