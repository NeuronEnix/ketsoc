import { describe, it, expect } from "vitest";

import { handleEnvsRequest, type EnvHandlerDeps } from "./envs";
import { OrgService } from "../tenancy/service";
import { EnvService } from "../tenancy/env-service";
import {
  MemoryOrgRepo,
  MemoryMembershipRepo,
  MemoryEnvRepo,
} from "../db/memory-repos";
import type { PublicUser } from "../auth/service";

const USER: PublicUser = {
  id: "usr_1",
  email: "a@b.com",
  displayName: null,
  createdAt: 1,
};

type EnvJson = { id: string; name: string; mode: string; isPermanent: boolean };

async function setup(): Promise<{ deps: EnvHandlerDeps; orgId: string }> {
  let counter = 0;
  const orgService = new OrgService({
    orgs: new MemoryOrgRepo(),
    memberships: new MemoryMembershipRepo(),
    genId: (p) => `${p}_${counter++}`,
    nowMs: () => 1,
  });
  const envService = new EnvService({
    envs: new MemoryEnvRepo(),
    genId: (p) => `${p}_${counter++}`,
    nowMs: () => 1,
    maxEnvs: 5,
  });
  const { org } = await orgService.createOrg(USER.id, "Acme");
  await envService.seedDefaults(org.id);
  return { deps: { orgService, envService }, orgId: org.id };
}

function req(method: string, path: string, body?: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method,
    headers: { "Content-Type": "application/json", Origin: "http://localhost" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

async function data(res: Response): Promise<unknown> {
  return ((await res.json()) as { data: unknown }).data;
}

describe("handleEnvsRequest()", () => {
  it("lists the seeded prod + test envs", async () => {
    const { deps, orgId } = await setup();
    const res = await handleEnvsRequest(
      req("GET", `/api/orgs/${orgId}/envs`),
      deps,
      USER
    );
    expect(res.status).toBe(200);
    const list = (await data(res)) as EnvJson[];
    expect(list.map((e) => e.name).sort()).toEqual(["prod", "test"]);
  });

  it("creates a 4-letter test-mode env (201)", async () => {
    const { deps, orgId } = await setup();
    const res = await handleEnvsRequest(
      req("POST", `/api/orgs/${orgId}/envs`, { name: "stag" }),
      deps,
      USER
    );
    expect(res.status).toBe(201);
    expect(((await data(res)) as EnvJson).mode).toBe("test");
  });

  it("rejects prod (409) and non-4-letter names (400)", async () => {
    const { deps, orgId } = await setup();
    expect(
      (
        await handleEnvsRequest(
          req("POST", `/api/orgs/${orgId}/envs`, { name: "prod" }),
          deps,
          USER
        )
      ).status
    ).toBe(409);
    expect(
      (
        await handleEnvsRequest(
          req("POST", `/api/orgs/${orgId}/envs`, { name: "PROD" }),
          deps,
          USER
        )
      ).status
    ).toBe(400);
  });

  it("404s for a non-member", async () => {
    const { deps, orgId } = await setup();
    const other: PublicUser = {
      id: "usr_2",
      email: "x@y.com",
      displayName: null,
      createdAt: 1,
    };
    expect(
      (
        await handleEnvsRequest(
          req("GET", `/api/orgs/${orgId}/envs`),
          deps,
          other
        )
      ).status
    ).toBe(404);
  });

  it("deletes a non-prod env (200) and protects prod (409)", async () => {
    const { deps, orgId } = await setup();
    const created = (await data(
      await handleEnvsRequest(
        req("POST", `/api/orgs/${orgId}/envs`, { name: "stag" }),
        deps,
        USER
      )
    )) as EnvJson;
    expect(
      (
        await handleEnvsRequest(
          req("DELETE", `/api/orgs/${orgId}/envs/${created.id}`),
          deps,
          USER
        )
      ).status
    ).toBe(200);

    const list = (await data(
      await handleEnvsRequest(req("GET", `/api/orgs/${orgId}/envs`), deps, USER)
    )) as EnvJson[];
    const prod = list.find((e) => e.name === "prod");
    expect(
      (
        await handleEnvsRequest(
          req("DELETE", `/api/orgs/${orgId}/envs/${prod?.id}`),
          deps,
          USER
        )
      ).status
    ).toBe(409);
  });
});
