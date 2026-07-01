import { describe, it, expect } from "vitest";

import { handleMetricsRequest, type MetricsHandlerDeps } from "./metrics";
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
  deps: MetricsHandlerDeps;
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

function req(path: string): Request {
  return new Request(`http://localhost${path}`, { method: "GET" });
}

async function data(res: Response): Promise<Record<string, unknown>> {
  return ((await res.json()) as { data: Record<string, unknown> }).data;
}

describe("handleMetricsRequest()", () => {
  it("returns a seeded overview (200)", async () => {
    const { deps, orgId, envId } = await setup();
    const res = await handleMetricsRequest(
      req(`/api/orgs/${orgId}/envs/${envId}/metrics/overview`),
      deps,
      USER
    );
    expect(res.status).toBe(200);
    const body = await data(res);
    expect(typeof body["connections"]).toBe("number");
    expect(body["seeded"]).toBe(true);
    expect((body["latencyMs"] as { p50: number }).p50).toBeGreaterThan(0);
  });

  it("returns a seeded time-series with a valid range (200)", async () => {
    const { deps, orgId, envId } = await setup();
    const res = await handleMetricsRequest(
      req(`/api/orgs/${orgId}/envs/${envId}/metrics/series?range=24h`),
      deps,
      USER
    );
    expect(res.status).toBe(200);
    const body = await data(res);
    expect(body["range"]).toBe("24h");
    expect(Array.isArray(body["points"])).toBe(true);
    expect((body["points"] as unknown[]).length).toBe(60);
  });

  it("falls back to the 1h range for a bogus range param", async () => {
    const { deps, orgId, envId } = await setup();
    const res = await handleMetricsRequest(
      req(`/api/orgs/${orgId}/envs/${envId}/metrics/series?range=nope`),
      deps,
      USER
    );
    expect(res.status).toBe(200);
    expect((await data(res))["range"]).toBe("1h");
  });

  it("404s a non-member, another org's env, and unknown metric", async () => {
    const { deps, orgId, envId } = await setup();
    const other: PublicUser = {
      id: "usr_2",
      email: "x@y.com",
      displayName: null,
      createdAt: 1,
    };
    expect(
      (
        await handleMetricsRequest(
          req(`/api/orgs/${orgId}/envs/${envId}/metrics/overview`),
          deps,
          other
        )
      ).status
    ).toBe(404);
    expect(
      (
        await handleMetricsRequest(
          req(`/api/orgs/${orgId}/envs/env_other/metrics/overview`),
          deps,
          USER
        )
      ).status
    ).toBe(404);
    expect(
      (
        await handleMetricsRequest(
          req(`/api/orgs/${orgId}/envs/${envId}/metrics/bogus`),
          deps,
          USER
        )
      ).status
    ).toBe(404);
  });
});
