import { describe, it, expect } from "vitest";

import { KeyService } from "./service";
import { MemoryApiKeyRepo } from "../db/memory-repos";
import type { Environment } from "../db/repos";

const ENV: Environment = {
  id: "env_abcdef123456",
  orgId: "org_1",
  name: "prod",
  mode: "live",
  isPermanent: true,
  createdAt: 1,
};

function makeService() {
  let counter = 0;
  const keys = new MemoryApiKeyRepo();
  const svc = new KeyService({
    keys,
    nowMs: () => 1000,
    genKid: () => `kid${counter++}`,
    genSecret: () => `secret${counter++}`,
  });
  return { svc, keys };
}

describe("KeyService.create()", () => {
  it("returns the full key once and stores only the hash", async () => {
    const { svc, keys } = makeService();
    const { key, record } = await svc.create(ENV, "secret", "server");
    expect(key.startsWith("ksk.")).toBe(true);
    expect(key).toContain(record.id); // kid embedded in the key
    expect(record.keyPrefix.endsWith(".")).toBe(true);
    expect(record.type).toBe("secret");
    expect("keyHash" in record).toBe(false);

    const stored = await keys.findById(record.id);
    expect(stored?.keyHash).toHaveLength(64); // sha256 hex
  });

  it("uses kpk for public keys", async () => {
    const { svc } = makeService();
    const { key } = await svc.create(ENV, "public", null);
    expect(key.startsWith("kpk.")).toBe(true);
  });
});

describe("KeyService.resolve()", () => {
  it("resolves a valid key", async () => {
    const { svc } = makeService();
    const { key, record } = await svc.create(ENV, "secret", null);
    expect((await svc.resolve(key))?.id).toBe(record.id);
  });

  it("rejects tampered, malformed, and revoked keys", async () => {
    const { svc } = makeService();
    const { key, record } = await svc.create(ENV, "secret", null);
    expect(await svc.resolve(`${key}x`)).toBeNull();
    expect(await svc.resolve("nonsense")).toBeNull();
    await svc.revoke(ENV.id, record.id);
    expect(await svc.resolve(key)).toBeNull();
  });
});

describe("KeyService list / relabel / revoke", () => {
  it("lists without exposing hashes", async () => {
    const { svc } = makeService();
    await svc.create(ENV, "public", null);
    await svc.create(ENV, "secret", null);
    const list = await svc.listByEnv(ENV.id);
    expect(list).toHaveLength(2);
    expect(list.every((k) => !("keyHash" in k))).toBe(true);
  });

  it("relabels, revokes, and 404s on wrong env", async () => {
    const { svc } = makeService();
    const { record } = await svc.create(ENV, "secret", "old");
    expect((await svc.relabel(ENV.id, record.id, "new")).label).toBe("new");
    await svc.revoke(ENV.id, record.id);
    expect((await svc.listByEnv(ENV.id))[0]?.revokedAt).not.toBeNull();
    await expect(
      svc.relabel("env_other", record.id, "x")
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
