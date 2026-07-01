import { describe, it, expect } from "vitest";

import { signJwt, verifyJwt } from "./jwt";

const secret = "test-secret-please-change";

function b64url(obj: unknown): string {
  return btoa(JSON.stringify(obj))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

describe("JWT", () => {
  it("signs and verifies a round-trip", async () => {
    const token = await signJwt(
      { sub: "usr_123", role: "owner" },
      secret,
      3600,
      1000
    );
    expect(token.split(".")).toHaveLength(3);

    const payload = await verifyJwt(token, secret, 1000);
    expect(payload).not.toBeNull();
    expect(payload?.sub).toBe("usr_123");
    expect(payload?.role).toBe("owner");
    expect(payload?.iat).toBe(1000);
    expect(payload?.exp).toBe(4600);
  });

  it("rejects a tampered payload (signature mismatch)", async () => {
    const token = await signJwt({ sub: "usr_1" }, secret, 3600, 1000);
    const [h, , s] = token.split(".");
    const forged = b64url({ sub: "usr_admin", iat: 1000, exp: 4600 });
    expect(await verifyJwt(`${h}.${forged}.${s}`, secret, 1000)).toBeNull();
  });

  it("rejects a wrong secret", async () => {
    const token = await signJwt({ sub: "usr_1" }, secret, 3600, 1000);
    expect(await verifyJwt(token, "other-secret", 1000)).toBeNull();
  });

  it("rejects an expired token", async () => {
    const token = await signJwt({ sub: "usr_1" }, secret, 3600, 1000);
    expect(await verifyJwt(token, secret, 1000 + 3601)).toBeNull();
  });

  it("rejects malformed tokens", async () => {
    expect(await verifyJwt("", secret)).toBeNull();
    expect(await verifyJwt("a.b", secret)).toBeNull();
    expect(await verifyJwt("a.b.c.d", secret)).toBeNull();
    expect(await verifyJwt("a.b.c", secret)).toBeNull();
  });

  it("rejects alg-confusion (alg=none)", async () => {
    const header = b64url({ alg: "none", typ: "JWT" });
    const payload = b64url({ sub: "x", iat: 1, exp: 9_999_999_999 });
    expect(await verifyJwt(`${header}.${payload}.`, secret)).toBeNull();
  });
});
