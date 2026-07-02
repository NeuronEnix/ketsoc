import { describe, it, expect } from "vitest";

import { requireAuth } from "./services";
import type { Env } from "../types";

// The D1 repo constructors only stash the binding; requireAuth short-circuits
// on a missing cookie before any DB access, so a stub env is enough here.
const ENV = { DB: {}, JWT_SECRET: "test-secret" } as unknown as Env;

describe("requireAuth()", () => {
  it("returns a 401 Response when there is no session cookie", async () => {
    const result = await requireAuth(
      new Request("http://localhost/api/orgs"),
      ENV
    );
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(401);
    const body = (await (result as Response).json()) as { code: string };
    expect(body.code).toBe("UNAUTHENTICATED");
  });

  it("returns a 401 Response for an unparseable cookie", async () => {
    const req = new Request("http://localhost/api/orgs", {
      headers: { Cookie: "garbage=nonsense" },
    });
    const result = await requireAuth(req, ENV);
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(401);
  });
});
