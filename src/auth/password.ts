/**
 * Password hashing via WebCrypto PBKDF2-HMAC-SHA-256.
 *
 * Runs natively on Workers and Node (no external deps). Stored format is
 * self-describing so parameters can evolve without a migration:
 *
 *   pbkdf2$<iterations>$<saltBase64>$<hashBase64>
 *
 * No password complexity rules are enforced here (per product decision) — any
 * string, including empty, hashes and verifies. Non-empty checks live at the
 * API layer.
 */

// Cloudflare Workers caps PBKDF2 at 100k iterations in production (local
// workerd does not enforce it) — deriveBits throws above this on deploy.
const DEFAULT_ITERATIONS = 100_000;
const SALT_BYTES = 16;
const KEY_BITS = 256;

function toB64(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) {
    bin += String.fromCharCode(b);
  }
  return btoa(bin);
}

function fromB64(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}

async function deriveBits(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number
): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    keyMaterial,
    KEY_BITS
  );
  return new Uint8Array(bits);
}

/** Constant-time byte comparison. */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }
  return diff === 0;
}

/** Hash a password into a self-describing `pbkdf2$…` string. */
export async function hashPassword(
  password: string,
  iterations: number = DEFAULT_ITERATIONS
): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await deriveBits(password, salt, iterations);
  return `pbkdf2$${iterations}$${toB64(salt)}$${toB64(hash)}`;
}

/** Verify a password against a stored `pbkdf2$…` string. False on any mismatch. */
export async function verifyPassword(
  password: string,
  stored: string
): Promise<boolean> {
  const [algo, iterStr, saltB64, hashB64] = stored.split("$");
  if (
    algo !== "pbkdf2" ||
    iterStr === undefined ||
    saltB64 === undefined ||
    hashB64 === undefined
  ) {
    return false;
  }
  const iterations = Number(iterStr);
  if (!Number.isInteger(iterations) || iterations <= 0) {
    return false;
  }

  let expected: Uint8Array;
  let salt: Uint8Array<ArrayBuffer>;
  try {
    salt = fromB64(saltB64);
    expected = fromB64(hashB64);
  } catch {
    return false;
  }

  const actual = await deriveBits(password, salt, iterations);
  return timingSafeEqual(actual, expected);
}
