import { describe, it, expect, vi, afterEach } from "vitest";

import { api, ApiError, authErrorMessage } from "./api";

function mockFetch(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: "",
    json: async () => body,
  });
}

function res(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: "",
    json: async () => body,
  };
}

const ok = (data: unknown) => ({ code: "OK", msg: "OK", data });
const unauth = { code: "UNAUTHENTICATED", msg: "Not signed in", data: null };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("api client", () => {
  it("unwraps data on success", async () => {
    vi.stubGlobal("fetch", mockFetch(200, ok({ id: "usr_1" })));
    const data = await api.get<{ id: string }>("/api/auth/me");
    expect(data.id).toBe("usr_1");
  });

  it("throws ApiError on a non-2xx response", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch(401, { code: "INVALID_CREDENTIALS", msg: "Nope", data: null })
    );
    await expect(
      api.post("/api/auth/login", { email: "a@b.com", password: "x" })
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS", status: 401 });
  });

  it("sends a JSON body and credentials on post", async () => {
    const f = mockFetch(201, ok({ ok: true }));
    vi.stubGlobal("fetch", f);
    await api.post("/api/auth/signup", { email: "a@b.com", password: "pw" });
    expect(f).toHaveBeenCalledWith(
      "/api/auth/signup",
      expect.objectContaining({ method: "POST", credentials: "include" })
    );
  });
});

describe("api client — session refresh on 401", () => {
  it("refreshes once and retries the original request", async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(res(401, unauth))
      .mockResolvedValueOnce(res(200, ok({ ok: true }))) // refresh
      .mockResolvedValueOnce(res(200, ok([{ id: "org_1" }])));
    vi.stubGlobal("fetch", f);

    const data = await api.get<Array<{ id: string }>>("/api/orgs");

    expect(data[0]?.id).toBe("org_1");
    expect(f.mock.calls.map((c) => c[0])).toEqual([
      "/api/orgs",
      "/api/auth/refresh",
      "/api/orgs",
    ]);
  });

  it("throws the original 401 when the refresh fails", async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(res(401, unauth))
      .mockResolvedValueOnce(res(401, unauth)); // refresh rejected
    vi.stubGlobal("fetch", f);

    await expect(api.get("/api/orgs")).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
      status: 401,
    });
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("dedupes concurrent refreshes", async () => {
    const f = vi.fn(async (url: string) => {
      if (url === "/api/auth/refresh") {
        return res(200, ok({ ok: true }));
      }
      // First hit per path is a 401; the retry succeeds.
      const firstHit = !f.mock.calls
        .slice(0, -1)
        .some((c) => c[0] === url);
      return firstHit ? res(401, unauth) : res(200, ok({ from: url }));
    });
    vi.stubGlobal("fetch", f);

    const [a, b] = await Promise.all([
      api.get<{ from: string }>("/api/orgs"),
      api.get<{ from: string }>("/api/orgs/o1/envs"),
    ]);

    expect(a.from).toBe("/api/orgs");
    expect(b.from).toBe("/api/orgs/o1/envs");
    const refreshes = f.mock.calls.filter(
      (c) => c[0] === "/api/auth/refresh"
    );
    expect(refreshes).toHaveLength(1);
  });

  it("does not attempt a refresh for auth endpoints", async () => {
    const f = mockFetch(401, { code: "INVALID_CREDENTIALS", msg: "x", data: null });
    vi.stubGlobal("fetch", f);
    await expect(
      api.post("/api/auth/login", { email: "a@b.com", password: "x" })
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    expect(f).toHaveBeenCalledTimes(1);
  });
});

describe("authErrorMessage()", () => {
  it("maps known codes to friendly copy", () => {
    expect(authErrorMessage(new ApiError("INVALID_CREDENTIALS", "x", 401))).toBe(
      "Wrong email or password."
    );
    expect(authErrorMessage(new ApiError("EMAIL_TAKEN", "x", 409))).toBe(
      "That email is already registered."
    );
    expect(authErrorMessage("boom")).toContain("Something went wrong");
  });
});
