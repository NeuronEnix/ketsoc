import { describe, it, expect } from "vitest";

import { handleEventsRequest, type EventsHandlerDeps } from "./events";
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
  deps: EventsHandlerDeps;
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
    deps: { orgService, envService, nowMs: () => 1_700_000_000_000 },
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

describe("handleEventsRequest()", () => {
  it("returns a seeded event tail (200)", async () => {
    const { deps, orgId, envId } = await setup();
    const res = await handleEventsRequest(
      req(`/api/orgs/${orgId}/envs/${envId}/events`),
      deps,
      USER
    );
    expect(res.status).toBe(200);
    const body = await data(res);
    expect(Array.isArray(body["events"])).toBe(true);
    expect(typeof body["ratePerSec"]).toBe("number");
    expect(body["seeded"]).toBe(true);
  });

  it("405s a non-GET", async () => {
    const { deps, orgId, envId } = await setup();
    const res = await handleEventsRequest(
      req(`/api/orgs/${orgId}/envs/${envId}/events`, "DELETE"),
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
        await handleEventsRequest(
          req(`/api/orgs/${orgId}/envs/${envId}/events`),
          deps,
          other
        )
      ).status
    ).toBe(404);
    expect(
      (
        await handleEventsRequest(
          req(`/api/orgs/${orgId}/envs/env_other/events`),
          deps,
          USER
        )
      ).status
    ).toBe(404);
  });
});
