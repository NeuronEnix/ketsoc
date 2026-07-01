/** Opaque token helpers (refresh-token secrets + hashing). */

function bytesToBase64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) {
    bin += String.fromCharCode(b);
  }
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** A high-entropy, URL-safe random secret (default 256 bits). */
export function generateSecret(numBytes = 32): string {
  return bytesToBase64url(crypto.getRandomValues(new Uint8Array(numBytes)));
}

/** Lowercase hex SHA-256 of a string (for hashing refresh-token secrets at rest). */
export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input)
  );
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
