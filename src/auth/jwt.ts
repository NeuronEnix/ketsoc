/**
 * Minimal HS256 JWTs via WebCrypto HMAC (Workers + Node, no deps).
 *
 * Guards against the classic pitfalls: signature is verified with a
 * constant-time compare before the payload is trusted, the `alg` header must be
 * exactly `HS256` (no alg-confusion / `none`), and expiry is enforced.
 */

export type JwtClaims = Record<string, unknown>;

interface StandardClaims {
  iat: number;
  exp: number;
}

const HEADER = { alg: "HS256", typ: "JWT" };
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function b64urlFromBytes(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) {
    bin += String.fromCharCode(b);
  }
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlFromString(s: string): string {
  return b64urlFromBytes(encoder.encode(s));
}

function b64urlToString(s: string): string {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return decoder.decode(bytes);
}

async function hmacB64url(data: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return b64urlFromBytes(new Uint8Array(sig));
}

/** Constant-time string comparison. */
function ctEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/** Sign claims into an HS256 JWT. `nowSec` is injectable for deterministic tests. */
export async function signJwt(
  claims: JwtClaims,
  secret: string,
  expiresInSec: number,
  nowSec?: number
): Promise<string> {
  const iat = nowSec ?? Math.floor(Date.now() / 1000);
  const payload = { ...claims, iat, exp: iat + expiresInSec };
  const encoded = `${b64urlFromString(JSON.stringify(HEADER))}.${b64urlFromString(
    JSON.stringify(payload)
  )}`;
  const sig = await hmacB64url(encoded, secret);
  return `${encoded}.${sig}`;
}

/** Verify + decode an HS256 JWT. Returns null on any failure (bad sig, alg, expiry, shape). */
export async function verifyJwt<T extends JwtClaims = JwtClaims>(
  token: string,
  secret: string,
  nowSec?: number
): Promise<(T & StandardClaims) | null> {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }
  const [headerB64, payloadB64, sig] = parts;
  if (
    headerB64 === undefined ||
    payloadB64 === undefined ||
    sig === undefined
  ) {
    return null;
  }

  const expectedSig = await hmacB64url(`${headerB64}.${payloadB64}`, secret);
  if (!ctEqual(sig, expectedSig)) {
    return null;
  }

  let header: unknown;
  let payload: unknown;
  try {
    header = JSON.parse(b64urlToString(headerB64));
    payload = JSON.parse(b64urlToString(payloadB64));
  } catch {
    return null;
  }

  if (
    typeof header !== "object" ||
    header === null ||
    (header as { alg?: unknown }).alg !== "HS256"
  ) {
    return null;
  }
  if (typeof payload !== "object" || payload === null) {
    return null;
  }

  const exp = (payload as { exp?: unknown }).exp;
  if (typeof exp !== "number") {
    return null;
  }
  const now = nowSec ?? Math.floor(Date.now() / 1000);
  if (now >= exp) {
    return null;
  }

  return payload as T & StandardClaims;
}
