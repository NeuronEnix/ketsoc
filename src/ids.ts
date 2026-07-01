/**
 * TypeID + UUIDv7 identifiers.
 *
 * UUIDv7 gives 128-bit, time-ordered ids — sortable inserts for D1 today and
 * ClickHouse later. TypeID wraps that in a human-readable, type-prefixed,
 * Crockford-base32 string: Stripe-grade DX (`org_…`, `env_…`, `key_…`) that is
 * still lexicographically sortable by creation time.
 */

// Crockford base32, lowercase (no i, l, o, u).
const BASE32 = "0123456789abcdefghjkmnpqrstvwxyz";
const BASE32_LOOKUP: Record<string, number> = {};
for (let i = 0; i < BASE32.length; i++) {
  BASE32_LOOKUP[BASE32.charAt(i)] = i;
}

// Prefix: lowercase, underscores allowed inside, never leading/trailing, 1–63 chars.
const PREFIX_RE = /^[a-z]([a-z_]{0,61}[a-z])?$/;
// Suffix: exactly 26 Crockford-base32 chars.
const SUFFIX_RE = /^[0-9a-hjkmnp-tv-z]{26}$/;

/** Canonical entity id prefixes used across ketsoc. */
export const ID_PREFIXES = {
  user: "usr",
  org: "org",
  environment: "env",
  apiKey: "key",
  membership: "mbr",
  invite: "inv",
  connection: "conn",
  event: "evt",
  session: "ses",
} as const;

export type IdPrefix = (typeof ID_PREFIXES)[keyof typeof ID_PREFIXES];

/** Build the 16 raw bytes of a UUIDv7 for the given time (defaults to now). */
export function uuidv7(timeMs: number = Date.now()): Uint8Array {
  const bytes = new Uint8Array(16);
  const ts = Math.floor(timeMs);

  // 48-bit big-endian millisecond timestamp (division/modulo — bitwise ops
  // would truncate to 32 bits and corrupt the high bytes).
  bytes[0] = Math.floor(ts / 2 ** 40) % 256;
  bytes[1] = Math.floor(ts / 2 ** 32) % 256;
  bytes[2] = Math.floor(ts / 2 ** 24) % 256;
  bytes[3] = Math.floor(ts / 2 ** 16) % 256;
  bytes[4] = Math.floor(ts / 2 ** 8) % 256;
  bytes[5] = ts % 256;

  // Fill bytes 6..15 with randomness, then set version (7) + RFC-4122 variant.
  crypto.getRandomValues(bytes.subarray(6));
  bytes[6] = 0x70 | ((bytes[6] ?? 0) & 0x0f);
  bytes[8] = 0x80 | ((bytes[8] ?? 0) & 0x3f);

  return bytes;
}

/** Encode 16 bytes → 26-char base32 suffix, MSB-first (2-bit left pad). */
function encodeSuffix(bytes: Uint8Array): string {
  let n = 0n;
  for (const b of bytes) {
    n = (n << 8n) | BigInt(b);
  }
  const chars = new Array<string>(26);
  for (let i = 25; i >= 0; i--) {
    chars[i] = BASE32.charAt(Number(n & 31n));
    n >>= 5n;
  }
  return chars.join("");
}

/** Decode a 26-char base32 suffix → 16 bytes. Throws on invalid characters. */
function decodeSuffix(suffix: string): Uint8Array {
  let n = 0n;
  for (const ch of suffix) {
    const v = BASE32_LOOKUP[ch];
    if (v === undefined) {
      throw new Error(`invalid base32 character: "${ch}"`);
    }
    n = (n << 5n) | BigInt(v);
  }
  const bytes = new Uint8Array(16);
  for (let i = 15; i >= 0; i--) {
    bytes[i] = Number(n & 0xffn);
    n >>= 8n;
  }
  return bytes;
}

/** Generate a TypeID such as `org_01j…`. `timeMs` is for deterministic tests. */
export function typeid(prefix: string, timeMs?: number): string {
  if (!PREFIX_RE.test(prefix)) {
    throw new Error(`invalid typeid prefix: "${prefix}"`);
  }
  return `${prefix}_${encodeSuffix(uuidv7(timeMs))}`;
}

/** Alias of {@link typeid} — reads well at call sites (`newId(ID_PREFIXES.org)`). */
export function newId(prefix: string, timeMs?: number): string {
  return typeid(prefix, timeMs);
}

/** Split a TypeID into its prefix + suffix, validating both. Throws if invalid. */
export function parseTypeId(id: string): { prefix: string; suffix: string } {
  const idx = id.lastIndexOf("_");
  if (idx <= 0) {
    throw new Error(`invalid typeid (missing prefix): "${id}"`);
  }
  const prefix = id.slice(0, idx);
  const suffix = id.slice(idx + 1);
  if (!PREFIX_RE.test(prefix)) {
    throw new Error(`invalid typeid prefix: "${prefix}"`);
  }
  if (!SUFFIX_RE.test(suffix)) {
    throw new Error(`invalid typeid suffix: "${suffix}"`);
  }
  return { prefix, suffix };
}

/** True if `id` is a well-formed TypeID (and matches `prefix`, when given). */
export function isValidId(id: string, prefix?: string): boolean {
  try {
    const parsed = parseTypeId(id);
    return prefix === undefined || parsed.prefix === prefix;
  } catch {
    return false;
  }
}

/** Decode the 16 UUID bytes embedded in a TypeID. */
export function uuidBytesOf(id: string): Uint8Array {
  return decodeSuffix(parseTypeId(id).suffix);
}

/** Recover the creation time (epoch ms) embedded in a TypeID's UUIDv7. */
export function timestampMs(id: string): number {
  const bytes = uuidBytesOf(id);
  return (
    (bytes[0] ?? 0) * 2 ** 40 +
    (bytes[1] ?? 0) * 2 ** 32 +
    (bytes[2] ?? 0) * 2 ** 24 +
    (bytes[3] ?? 0) * 2 ** 16 +
    (bytes[4] ?? 0) * 2 ** 8 +
    (bytes[5] ?? 0)
  );
}
