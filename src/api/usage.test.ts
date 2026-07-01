import { describe, it, expect } from "vitest";

import { handleUsageRequest, type UsageHandlerDeps } from "./usage";
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

async function setup(): Promise<{
  deps: UsageHandlerDeps;
  orgId: string;
  envId: string;
}> {
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
  const env = await envService.create(org.id, "stag");
  return {
    deps: { orgService, envService, nowMs: () => Date.UTC(2026, 6, 15) },
    orgId: org.id,
    envId: env.id,
  };
}

function req(path: string, method = "GET"): Request {
  return new Request(`http://localhost${path}`, { method });
}

async function data(res: Response): Promise<Record<string, unknown>> {
  return ((await res.json()) as { data: Record<string, unknown> }).data;
}

describe("handleUsageRequest()", () => {
  it("returns a seeded usage summary (200)", async () => {
    const { deps, orgId, envId } = await setup();
    const res = await handleUsageRequest(
      req(`/api/orgs/${orgId}/envs/${envId}/usage`),
      deps,
      USER
    );
    expect(res.status).toBe(200);
    const body = await data(res);
    expect(typeof body["plan"]).toBe("string");
    expect(Array.isArray(body["metrics"])).toBe(true);
    expect((body["metrics"] as unknown[]).length).toBe(4);
  });

  it("405s a non-GET", async () => {
    const { deps, orgId, envId } = await setup();
    const res = await handleUsageRequest(
      req(`/api/orgs/${orgId}/envs/${envId}/usage`, "POST"),
      deps,
      USER
    );
    expect(res.status).toBe(405);
  });

  it("404s a non-member and another org's env", async () => {
    const { deps, orgId, envId } = await setup();
    const other: PublicUser = {
      id: "usr_2",
      email: "x@y.com",
      displayName: null,
      createdAt: 1,
    };
    expect(
      (
        await handleUsageRequest(
          req(`/api/orgs/${orgId}/envs/${envId}/usage`),
          deps,
          other
        )
      ).status
    ).toBe(404);
    expect(
      (
        await handleUsageRequest(
          req(`/api/orgs/${orgId}/envs/env_other/usage`),
          deps,
          USER
        )
      ).status
    ).toBe(404);
  });
});
