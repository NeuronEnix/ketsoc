import { describe, it, expect } from "vitest";

import { handleAuthRequest } from "./auth";
import { AuthService } from "../auth/service";
import { MemoryUserRepo, MemorySessionRepo } from "../db/memory-repos";

function makeService(): AuthService {
  let counter = 0;
  return new AuthService({
    users: new MemoryUserRepo(),
    sessions: new MemorySessionRepo(),
    jwtSecret: "test-secret",
    genId: (p) => `${p}_${counter++}`,
  });
}

function post(path: string, body: unknown, cookie?: string): Request {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Origin: "http://localhost",
  };
  if (cookie) {
    headers["Cookie"] = cookie;
  }
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

function cookieHeaderFrom(res: Response): string {
  return res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
}

describe("handleAuthRequest()", () => {
  it("returns null for non-auth paths", async () => {
    const res = await handleAuthRequest(
      new Request("http://localhost/connect"),
      makeService()
    );
    expect(res).toBeNull();
  });

  it("signs up, sets both cookies, and resolves /me", async () => {
    const svc = makeService();
    const signup = await handleAuthRequest(
      post("/api/auth/signup", { email: "a@b.com", password: "pw" }),
      svc
    );
    expect(signup?.status).toBe(201);
    const setCookies = signup?.headers.getSetCookie() ?? [];
    expect(setCookies.some((c) => c.startsWith("ks_at="))).toBe(true);
    expect(setCookies.some((c) => c.startsWith("ks_rt="))).toBe(true);

    const meReq = new Request("http://localhost/api/auth/me", {
      headers: { Cookie: cookieHeaderFrom(signup as Response) },
    });
    const me = await handleAuthRequest(meReq, svc);
    expect(me?.status).toBe(200);
    const body = (await (me as Response).json()) as {
      data: { email: string };
    };
    expect(body.data.email).toBe("a@b.com");
  });

  it("rejects a duplicate signup with 409", async () => {
    const svc = makeService();
    await handleAuthRequest(
      post("/api/auth/signup", { email: "a@b.com", password: "pw" }),
      svc
    );
    const dup = await handleAuthRequest(
      post("/api/auth/signup", { email: "a@b.com", password: "pw" }),
      svc
    );
    expect(dup?.status).toBe(409);
  });

  it("rejects login with a wrong password (401)", async () => {
    const svc = makeService();
    await handleAuthRequest(
      post("/api/auth/signup", { email: "a@b.com", password: "pw" }),
      svc
    );
    const bad = await handleAuthRequest(
      post("/api/auth/login", { email: "a@b.com", password: "nope" }),
      svc
    );
    expect(bad?.status).toBe(401);
  });

  it("returns 401 from /me without a cookie", async () => {
    const me = await handleAuthRequest(
      new Request("http://localhost/api/auth/me"),
      makeService()
    );
    expect(me?.status).toBe(401);
  });

  it("logs out and clears cookies (Max-Age=0)", async () => {
    const svc = makeService();
    const signup = await handleAuthRequest(
      post("/api/auth/signup", { email: "a@b.com", password: "pw" }),
      svc
    );
    const logout = await handleAuthRequest(
      post("/api/auth/logout", {}, cookieHeaderFrom(signup as Response)),
      svc
    );
    expect(logout?.status).toBe(200);
    const cleared = logout?.headers.getSetCookie() ?? [];
    expect(cleared.every((c) => c.includes("Max-Age=0"))).toBe(true);
  });

  it("blocks a cross-origin mutation (403)", async () => {
    const req = new Request("http://localhost/api/auth/signup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://evil.example",
      },
      body: JSON.stringify({ email: "a@b.com", password: "pw" }),
    });
    const res = await handleAuthRequest(req, makeService());
    expect(res?.status).toBe(403);
  });
});
