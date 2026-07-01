import { describe, it, expect } from "vitest";

import { AuthService } from "./service";
import { verifyJwt } from "./jwt";
import { MemoryUserRepo, MemorySessionRepo } from "../db/memory-repos";

const SECRET = "test-jwt-secret";

function makeService() {
  let counter = 0;
  const clock = { now: 1_000_000_000 };
  const users = new MemoryUserRepo();
  const sessions = new MemorySessionRepo();
  const svc = new AuthService({
    users,
    sessions,
    jwtSecret: SECRET,
    nowMs: () => clock.now,
    genId: (p) => `${p}_t${counter++}`,
    accessTtlSec: 900,
    refreshTtlSec: 3600,
  });
  return { svc, users, sessions, clock };
}

describe("AuthService.signup()", () => {
  it("creates a user (normalized email) and issues tokens", async () => {
    const { svc } = makeService();
    const { user, tokens } = await svc.signup("Alice@Example.com", "pw");
    expect(user.email).toBe("alice@example.com");
    expect(user.id.startsWith("usr_")).toBe(true);
    expect(tokens.refreshToken).toContain(".");
    const claims = await verifyJwt(tokens.accessToken, SECRET, 1_000_000);
    expect(claims?.sub).toBe(user.id);
  });

  it("rejects a duplicate email", async () => {
    const { svc } = makeService();
    await svc.signup("a@b.com", "pw");
    await expect(svc.signup("a@b.com", "pw2")).rejects.toMatchObject({
      code: "EMAIL_TAKEN",
    });
  });

  it("rejects an invalid email", async () => {
    const { svc } = makeService();
    await expect(svc.signup("not-an-email", "pw")).rejects.toMatchObject({
      code: "INVALID_EMAIL",
    });
  });

  it("rejects an empty password", async () => {
    const { svc } = makeService();
    await expect(svc.signup("a@b.com", "")).rejects.toMatchObject({
      code: "INVALID_PASSWORD",
    });
  });
});

describe("AuthService.login()", () => {
  it("logs in with correct credentials (case-insensitive email)", async () => {
    const { svc } = makeService();
    await svc.signup("a@b.com", "hunter2");
    const { user, tokens } = await svc.login("A@B.com", "hunter2");
    expect(user.email).toBe("a@b.com");
    expect(tokens.accessToken.split(".")).toHaveLength(3);
  });

  it("rejects a wrong password", async () => {
    const { svc } = makeService();
    await svc.signup("a@b.com", "hunter2");
    await expect(svc.login("a@b.com", "wrong")).rejects.toMatchObject({
      code: "INVALID_CREDENTIALS",
    });
  });

  it("rejects an unknown user without enumeration", async () => {
    const { svc } = makeService();
    await expect(svc.login("ghost@b.com", "x")).rejects.toMatchObject({
      code: "INVALID_CREDENTIALS",
    });
  });
});

describe("AuthService session lifecycle", () => {
  it("resolves the user from a valid access token", async () => {
    const { svc } = makeService();
    const { user, tokens } = await svc.signup("a@b.com", "pw");
    const resolved = await svc.userFromAccessToken(tokens.accessToken);
    expect(resolved?.id).toBe(user.id);
  });

  it("returns null for a garbage access token", async () => {
    const { svc } = makeService();
    expect(await svc.userFromAccessToken("garbage")).toBeNull();
  });

  it("rotates refresh tokens and invalidates the old one", async () => {
    const { svc } = makeService();
    const { tokens } = await svc.signup("a@b.com", "pw");
    const rotated = await svc.refresh(tokens.refreshToken);
    expect(rotated.refreshToken).not.toBe(tokens.refreshToken);
    await expect(svc.refresh(tokens.refreshToken)).rejects.toMatchObject({
      code: "INVALID_TOKEN",
    });
    const rotated2 = await svc.refresh(rotated.refreshToken);
    expect(rotated2.accessToken.split(".")).toHaveLength(3);
  });

  it("rejects an expired refresh token", async () => {
    const { svc, clock } = makeService();
    const { tokens } = await svc.signup("a@b.com", "pw");
    clock.now += 3600 * 1000 + 1;
    await expect(svc.refresh(tokens.refreshToken)).rejects.toMatchObject({
      code: "SESSION_EXPIRED",
    });
  });

  it("logout ends the session", async () => {
    const { svc } = makeService();
    const { tokens } = await svc.signup("a@b.com", "pw");
    await svc.logout(tokens.refreshToken);
    await expect(svc.refresh(tokens.refreshToken)).rejects.toMatchObject({
      code: "INVALID_TOKEN",
    });
  });
});
