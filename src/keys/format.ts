/**
 * API key format: `{kind}.{env}.{kid}.{secret}`
 *   kind   — kpk (public) | ksk (secret): stable, scanner-detectable prefix
 *   env    — short env ref (human hint: prod vs staging)
 *   kid    — short id → O(1) lookup + revoke without storing the secret
 *   secret — high-entropy random (base62)
 */

const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

export const KID_LEN = 12;
export const SECRET_LEN = 43;
export const ENV_REF_LEN = 6;

export type KeyKind = "kpk" | "ksk";

export interface ParsedKey {
  kind: KeyKind;
  envRef: string;
  kid: string;
  secret: string;
}

/** `len` random base62 characters (CSPRNG). */
export function randomBase62(len: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  let out = "";
  for (let i = 0; i < len; i++) {
    out += BASE62.charAt((bytes[i] ?? 0) % 62);
  }
  return out;
}

export function formatKey(
  kind: KeyKind,
  envRef: string,
  kid: string,
  secret: string
): string {
  return `${kind}.${envRef}.${kid}.${secret}`;
}

/** Parse a key string; null if malformed. */
export function parseKey(key: string): ParsedKey | null {
  const parts = key.split(".");
  if (parts.length !== 4) {
    return null;
  }
  const [kind, envRef, kid, secret] = parts;
  if ((kind !== "kpk" && kind !== "ksk") || !envRef || !kid || !secret) {
    return null;
  }
  return { kind, envRef, kid, secret };
}

/** A short env ref derived from an env id, for the human-readable key segment. */
export function envRefFromId(envId: string): string {
  const compact = envId.replace(/[^0-9a-z]/gi, "");
  return compact.slice(-ENV_REF_LEN);
}
