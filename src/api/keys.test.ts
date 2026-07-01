import { describe, it, expect } from "vitest";

import { handleKeysRequest, type KeyHandlerDeps } from "./keys";
import { OrgService } from "../tenancy/service";
import { EnvService } from "../tenancy/env-service";
import { KeyService } from "../keys/service";
import {
  MemoryOrgRepo,
  MemoryMembershipRepo,
  MemoryEnvRepo,
  MemoryApiKeyRepo,
} from "../db/memory-repos";
import type { PublicUser } from "../auth/service";

const USER: PublicUser = {
  id: "usr_1",
  email: "a@b.com",
  displayName: null,
  createdAt: 1,
};

type KeyJson = {
  id: string;
  type: string;
  label: string | null;
  keyPrefix: string;
  revokedAt: number | null;
  key?: string;
};

async function setup(): Promise<{
  deps: KeyHandlerDeps;
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
  const keyService = new KeyService({
    keys: new MemoryApiKeyRepo(),
    nowMs: () => 1,
    genKid: () => `kid${counter++}`,
    genSecret: () => `secret${counter++}`,
  });
  const { org } = await orgService.createOrg(USER.id, "Acme");
  const env = await envService.create(org.id, "stag");
  return {
    deps: { orgService, envService, keyService },
    orgId: org.id,
    envId: env.id,
  };
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

const base = (orgId: string, envId: string): string =>
  `/api/orgs/${orgId}/envs/${envId}/keys`;

describe("handleKeysRequest()", () => {
  it("creates a key and reveals the full value once (201)", async () => {
    const { deps, orgId, envId } = await setup();
    const res = await handleKeysRequest(
      req("POST", base(orgId, envId), { type: "secret", label: "server" }),
      deps,
      USER
    );
    expect(res.status).toBe(201);
    const k = (await data(res)) as KeyJson;
    expect(k.key?.startsWith("ksk.")).toBe(true);
    expect(k.type).toBe("secret");
    expect(k.label).toBe("server");
  });

  it("lists keys without exposing the secret", async () => {
    const { deps, orgId, envId } = await setup();
    await handleKeysRequest(
      req("POST", base(orgId, envId), { type: "public" }),
      deps,
      USER
    );
    const list = (await data(
      await handleKeysRequest(req("GET", base(orgId, envId)), deps, USER)
    )) as KeyJson[];
    expect(list).toHaveLength(1);
    expect(list[0]?.key).toBeUndefined();
  });

  it("rejects an invalid key type (400)", async () => {
    const { deps, orgId, envId } = await setup();
    expect(
      (
        await handleKeysRequest(
          req("POST", base(orgId, envId), { type: "nope" }),
          deps,
          USER
        )
      ).status
    ).toBe(400);
  });

  it("relabels and revokes", async () => {
    const { deps, orgId, envId } = await setup();
    const created = (await data(
      await handleKeysRequest(
        req("POST", base(orgId, envId), { type: "secret", label: "old" }),
        deps,
        USER
      )
    )) as KeyJson;
    const relabeled = (await data(
      await handleKeysRequest(
        req("PATCH", `${base(orgId, envId)}/${created.id}`, { label: "new" }),
        deps,
        USER
      )
    )) as KeyJson;
    expect(relabeled.label).toBe("new");
    expect(
      (
        await handleKeysRequest(
          req("DELETE", `${base(orgId, envId)}/${created.id}`),
          deps,
          USER
        )
      ).status
    ).toBe(200);
    const list = (await data(
      await handleKeysRequest(req("GET", base(orgId, envId)), deps, USER)
    )) as KeyJson[];
    expect(list[0]?.revokedAt).not.toBeNull();
  });

  it("404s a non-member and an env from another org", async () => {
    const { deps, orgId, envId } = await setup();
    const other: PublicUser = {
      id: "usr_2",
      email: "x@y.com",
      displayName: null,
      createdAt: 1,
    };
    expect(
      (await handleKeysRequest(req("GET", base(orgId, envId)), deps, other))
        .status
    ).toBe(404);
    expect(
      (
        await handleKeysRequest(
          req("GET", base(orgId, "env_other")),
          deps,
          USER
        )
      ).status
    ).toBe(404);
  });
});
