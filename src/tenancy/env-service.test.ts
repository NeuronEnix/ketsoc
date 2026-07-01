import { describe, it, expect } from "vitest";

import { EnvService } from "./env-service";
import { MemoryEnvRepo } from "../db/memory-repos";

function makeService() {
  let counter = 0;
  const envs = new MemoryEnvRepo();
  const svc = new EnvService({
    envs,
    nowMs: () => 1,
    genId: (p) => `${p}_${counter++}`,
    maxEnvs: 5,
  });
  return { svc, envs };
}

describe("EnvService.seedDefaults()", () => {
  it("creates prod (live, permanent) + test", async () => {
    const { svc } = makeService();
    const [prod, test] = await svc.seedDefaults("org_1");
    expect(prod?.name).toBe("prod");
    expect(prod?.mode).toBe("live");
    expect(prod?.isPermanent).toBe(true);
    expect(test?.name).toBe("test");
    expect(test?.mode).toBe("test");
    expect(test?.isPermanent).toBe(false);
  });
});

describe("EnvService.create()", () => {
  it("creates a 4-letter test-mode env", async () => {
    const { svc } = makeService();
    const env = await svc.create("org_1", "stag");
    expect(env.name).toBe("stag");
    expect(env.mode).toBe("test");
    expect(env.isPermanent).toBe(false);
    expect(env.id.startsWith("env_")).toBe(true);
  });

  it("reserves 'prod'", async () => {
    const { svc } = makeService();
    await expect(svc.create("org_1", "prod")).rejects.toMatchObject({
      code: "RESERVED_NAME",
    });
  });

  it("rejects names that aren't exactly 4 lowercase letters", async () => {
    const { svc } = makeService();
    for (const bad of ["PROD", "ab", "abcde", "ab1c", "ab-c", "   "]) {
      await expect(svc.create("org_1", bad)).rejects.toMatchObject({
        code: "INVALID_NAME",
      });
    }
  });

  it("rejects a duplicate name within the org", async () => {
    const { svc } = makeService();
    await svc.create("org_1", "stag");
    await expect(svc.create("org_1", "stag")).rejects.toMatchObject({
      code: "NAME_TAKEN",
    });
  });

  it("enforces the 5-env cap including seeded defaults", async () => {
    const { svc } = makeService();
    await svc.seedDefaults("org_1"); // 2
    await svc.create("org_1", "aaaa");
    await svc.create("org_1", "bbbb");
    await svc.create("org_1", "cccc"); // 5 total
    await expect(svc.create("org_1", "dddd")).rejects.toMatchObject({
      code: "ENV_LIMIT",
    });
  });
});

describe("EnvService.delete()", () => {
  it("deletes a non-prod env", async () => {
    const { svc, envs } = makeService();
    const env = await svc.create("org_1", "stag");
    await svc.delete("org_1", env.id);
    expect(await envs.findById(env.id)).toBeNull();
  });

  it("protects prod (permanent)", async () => {
    const { svc } = makeService();
    const [prod] = await svc.seedDefaults("org_1");
    await expect(svc.delete("org_1", prod!.id)).rejects.toMatchObject({
      code: "PROTECTED",
    });
  });

  it("404s an env from a different org", async () => {
    const { svc } = makeService();
    const env = await svc.create("org_1", "stag");
    await expect(svc.delete("org_2", env.id)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

describe("EnvService.getForOrg()", () => {
  it("returns an env in the org and 404s otherwise", async () => {
    const { svc } = makeService();
    const env = await svc.create("org_1", "stag");
    expect((await svc.getForOrg("org_1", env.id)).id).toBe(env.id);
    await expect(svc.getForOrg("org_2", env.id)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(svc.getForOrg("org_1", "env_missing")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
