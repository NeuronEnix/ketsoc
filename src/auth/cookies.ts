/** Cookie serialization + parsing (no external deps). */

export interface CookieOptions {
  maxAgeSec?: number;
  path?: string;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "Lax" | "Strict" | "None";
}

/** Build a `Set-Cookie` header value. The value is URL-encoded. */
export function serializeCookie(
  name: string,
  value: string,
  opts: CookieOptions = {}
): string {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  parts.push(`Path=${opts.path ?? "/"}`);
  if (opts.maxAgeSec !== undefined) {
    parts.push(`Max-Age=${Math.floor(opts.maxAgeSec)}`);
  }
  if (opts.httpOnly) {
    parts.push("HttpOnly");
  }
  if (opts.secure) {
    parts.push("Secure");
  }
  if (opts.sameSite) {
    parts.push(`SameSite=${opts.sameSite}`);
  }
  return parts.join("; ");
}

/** Parse a `Cookie` request header into a name→value map (values URL-decoded). */
export function parseCookies(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) {
    return out;
  }
  for (const pair of header.split(";")) {
    const idx = pair.indexOf("=");
    if (idx < 0) {
      continue;
    }
    const name = pair.slice(0, idx).trim();
    if (!name) {
      continue;
    }
    try {
      out[name] = decodeURIComponent(pair.slice(idx + 1).trim());
    } catch {
      out[name] = pair.slice(idx + 1).trim();
    }
  }
  return out;
}
