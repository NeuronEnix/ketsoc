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

async function request<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const hasBody = body !== undefined;
  const res = await fetch(path, {
    method,
    credentials: "include",
    headers: hasBody ? { "Content-Type": "application/json" } : undefined,
    body: hasBody ? JSON.stringify(body) : undefined,
  });

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
