import { errResponse } from "../types.js";

/** Parse a JSON request body, or null if absent/invalid. */
export async function readJson(
  req: Request
): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await req.json();
    return typeof body === "object" && body !== null
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** Read a string field from a parsed body, defaulting to "". */
export function readString(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  return typeof value === "string" ? value : "";
}

/** Reject cross-origin mutations (defense-in-depth alongside SameSite cookies). */
export function checkOrigin(req: Request, url: URL): Response | null {
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
