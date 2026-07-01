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

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("api client", () => {
  it("unwraps data on success", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch(200, { code: "OK", msg: "OK", data: { id: "usr_1" } })
    );
    const data = await api.get<{ id: string }>("/api/auth/me");
    expect(data.id).toBe("usr_1");
  });

  it("throws ApiError on a non-2xx response", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch(401, { code: "UNAUTHENTICATED", msg: "Not signed in", data: null })
    );
    await expect(api.get("/api/auth/me")).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
      status: 401,
    });
  });

  it("sends a JSON body and credentials on post", async () => {
    const f = mockFetch(201, { code: "OK", msg: "OK", data: { ok: true } });
    vi.stubGlobal("fetch", f);
    await api.post("/api/auth/signup", { email: "a@b.com", password: "pw" });
    expect(f).toHaveBeenCalledWith(
      "/api/auth/signup",
      expect.objectContaining({ method: "POST", credentials: "include" })
    );
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
