import { describe, it, expect } from "vitest";

import { OrgService } from "./service";
import { MemoryOrgRepo, MemoryMembershipRepo } from "../db/memory-repos";

function makeService() {
  let counter = 0;
  const orgs = new MemoryOrgRepo();
  const memberships = new MemoryMembershipRepo();
  const svc = new OrgService({
    orgs,
    memberships,
    nowMs: () => 1_000,
    genId: (p) => `${p}_${counter++}`,
    maxOwnedOrgs: 5,
  });
  return { svc, orgs, memberships };
}

describe("OrgService.createOrg()", () => {
  it("creates an org, an owner membership, and normalizes the name", async () => {
    const { svc, memberships } = makeService();
    const { org, role } = await svc.createOrg("usr_1", "  Acme Inc  ");
    expect(org.displayName).toBe("Acme Inc");
    expect(org.id.startsWith("org_")).toBe(true);
    expect(org.ownerUserId).toBe("usr_1");
    expect(role).toBe("owner");
    const m = await memberships.findByUserAndOrg("usr_1", org.id);
    expect(m?.role).toBe("owner");
  });

  it("rejects an empty or too-long name", async () => {
    const { svc } = makeService();
    await expect(svc.createOrg("usr_1", "   ")).rejects.toMatchObject({
      code: "INVALID_NAME",
    });
    await expect(svc.createOrg("usr_1", "x".repeat(41))).rejects.toMatchObject({
      code: "INVALID_NAME",
    });
  });

  it("enforces the ≤5 owned-orgs limit", async () => {
    const { svc } = makeService();
    for (let i = 0; i < 5; i++) {
      await svc.createOrg("usr_1", `Org ${i}`);
    }
    await expect(svc.createOrg("usr_1", "Sixth")).rejects.toMatchObject({
      code: "ORG_LIMIT",
    });
    // A different user is unaffected.
    await expect(svc.createOrg("usr_2", "Fine")).resolves.toBeTruthy();
  });
});

describe("OrgService.listForUser / getForUser", () => {
  it("lists every org the user belongs to with their role", async () => {
    const { svc } = makeService();
    await svc.createOrg("usr_1", "A");
    await svc.createOrg("usr_1", "B");
    const list = await svc.listForUser("usr_1");
    expect(list).toHaveLength(2);
    expect(list.every((s) => s.role === "owner")).toBe(true);
  });

  it("throws NOT_FOUND for a non-member", async () => {
    const { svc } = makeService();
    const { org } = await svc.createOrg("usr_1", "A");
    await expect(svc.getForUser("usr_2", org.id)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("resolves the role for a member", async () => {
    const { svc, memberships } = makeService();
    const { org } = await svc.createOrg("usr_1", "A");
    await memberships.create({
      id: "mbr_x",
      userId: "usr_2",
      orgId: org.id,
      role: "member",
      createdAt: 1,
    });
    const summary = await svc.getForUser("usr_2", org.id);
    expect(summary.role).toBe("member");
  });
});

describe("OrgService.rename / deleteOrg", () => {
  it("lets an owner rename", async () => {
    const { svc } = makeService();
    const { org } = await svc.createOrg("usr_1", "A");
    const renamed = await svc.rename("usr_1", org.id, "A2");
    expect(renamed.displayName).toBe("A2");
  });

  it("forbids a member from renaming or deleting", async () => {
    const { svc, memberships } = makeService();
    const { org } = await svc.createOrg("usr_1", "A");
    await memberships.create({
      id: "mbr_x",
      userId: "usr_2",
      orgId: org.id,
      role: "member",
      createdAt: 1,
    });
    await expect(svc.rename("usr_2", org.id, "A2")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(svc.deleteOrg("usr_2", org.id)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("lets an owner delete, removing memberships", async () => {
    const { svc, orgs, memberships } = makeService();
    const { org } = await svc.createOrg("usr_1", "A");
    await svc.deleteOrg("usr_1", org.id);
    expect(await orgs.findById(org.id)).toBeNull();
    expect(await memberships.listByOrg(org.id)).toHaveLength(0);
  });
});
