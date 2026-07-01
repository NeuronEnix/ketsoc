import { describe, it, expect } from "vitest";

import { handleOrgsRequest } from "./orgs";
import { OrgService } from "../tenancy/service";
import { MemoryOrgRepo, MemoryMembershipRepo } from "../db/memory-repos";
import type { PublicUser } from "../auth/service";

const USER: PublicUser = {
  id: "usr_1",
  email: "a@b.com",
  displayName: null,
  createdAt: 1,
};

function setup() {
  let counter = 0;
  return new OrgService({
    orgs: new MemoryOrgRepo(),
    memberships: new MemoryMembershipRepo(),
    genId: (p) => `${p}_${counter++}`,
    nowMs: () => 1,
  });
}

function req(method: string, path: string, body?: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method,
    headers: { "Content-Type": "application/json", Origin: "http://localhost" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

async function jsonOf(
  res: Response
): Promise<{ data: Record<string, unknown> }> {
  return (await res.json()) as { data: Record<string, unknown> };
}

describe("handleOrgsRequest()", () => {
  it("creates then lists orgs", async () => {
    const svc = setup();
    const created = await handleOrgsRequest(
      req("POST", "/api/orgs", { displayName: "Acme" }),
      svc,
      USER
    );
    expect(created.status).toBe(201);
    const body = await jsonOf(created);
    expect(body.data.displayName).toBe("Acme");
    expect(body.data.role).toBe("owner");

    const listed = await handleOrgsRequest(req("GET", "/api/orgs"), svc, USER);
    expect((await jsonOf(listed)).data).toHaveLength(1);
  });

  it("enforces the org limit (409) and rejects an empty name (400)", async () => {
    const svc = setup();
    for (let i = 0; i < 5; i++) {
      await handleOrgsRequest(
        req("POST", "/api/orgs", { displayName: `O${i}` }),
        svc,
        USER
      );
    }
    expect(
      (
        await handleOrgsRequest(
          req("POST", "/api/orgs", { displayName: "6th" }),
          svc,
          USER
        )
      ).status
    ).toBe(409);
    const svc2 = setup();
    expect(
      (
        await handleOrgsRequest(
          req("POST", "/api/orgs", { displayName: "  " }),
          svc2,
          USER
        )
      ).status
    ).toBe(400);
  });

  it("gets, renames, and deletes an org", async () => {
    const svc = setup();
    const id = (
      await jsonOf(
        await handleOrgsRequest(
          req("POST", "/api/orgs", { displayName: "Acme" }),
          svc,
          USER
        )
      )
    ).data.id as string;

    expect(
      (await handleOrgsRequest(req("GET", `/api/orgs/${id}`), svc, USER)).status
    ).toBe(200);

    const renamed = await handleOrgsRequest(
      req("PATCH", `/api/orgs/${id}`, { displayName: "Acme2" }),
      svc,
      USER
    );
    expect((await jsonOf(renamed)).data.displayName).toBe("Acme2");

    expect(
      (await handleOrgsRequest(req("DELETE", `/api/orgs/${id}`), svc, USER))
        .status
    ).toBe(200);
    expect(
      (await handleOrgsRequest(req("GET", `/api/orgs/${id}`), svc, USER)).status
    ).toBe(404);
  });

  it("404s another user's org (non-member)", async () => {
    const svc = setup();
    const id = (
      await jsonOf(
        await handleOrgsRequest(
          req("POST", "/api/orgs", { displayName: "Acme" }),
          svc,
          USER
        )
      )
    ).data.id as string;
    const other: PublicUser = {
      id: "usr_2",
      email: "x@y.com",
      displayName: null,
      createdAt: 1,
    };
    expect(
      (await handleOrgsRequest(req("GET", `/api/orgs/${id}`), svc, other))
        .status
    ).toBe(404);
  });
});
