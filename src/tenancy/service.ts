import { ID_PREFIXES, typeid } from "../ids.js";
import type { Org, OrgRole, OrgRepo, MembershipRepo } from "../db/repos.js";

export type TenancyErrorCode =
  | "INVALID_NAME"
  | "ORG_LIMIT"
  | "NOT_FOUND"
  | "FORBIDDEN";

export class TenancyError extends Error {
  constructor(
    public readonly code: TenancyErrorCode,
    message?: string
  ) {
    super(message ?? code);
    this.name = "TenancyError";
  }
}

export interface OrgSummary {
  org: Org;
  role: OrgRole;
}

const DEFAULT_MAX_OWNED_ORGS = 5;
const NAME_MIN = 1;
const NAME_MAX = 40;

export interface OrgServiceOptions {
  orgs: OrgRepo;
  memberships: MembershipRepo;
  nowMs?: () => number;
  genId?: (prefix: string) => string;
  maxOwnedOrgs?: number;
  /**
   * Called once a new org (and its owner membership) exists, so callers can
   * seed the org's default environments. Kept as a hook to avoid coupling
   * OrgService to EnvService — the spec seeds `prod`+`test` on every org
   * creation, so this runs for onboarding and additional orgs alike.
   */
  seedEnvironments?: (orgId: string) => Promise<void>;
}

export class OrgService {
  private readonly orgs: OrgRepo;
  private readonly memberships: MembershipRepo;
  private readonly nowMs: () => number;
  private readonly genId: (prefix: string) => string;
  private readonly maxOwnedOrgs: number;
  private readonly seedEnvironments:
    | ((orgId: string) => Promise<void>)
    | undefined;

  constructor(opts: OrgServiceOptions) {
    this.orgs = opts.orgs;
    this.memberships = opts.memberships;
    this.nowMs = opts.nowMs ?? (() => Date.now());
    this.genId = opts.genId ?? ((p) => typeid(p));
    this.maxOwnedOrgs = opts.maxOwnedOrgs ?? DEFAULT_MAX_OWNED_ORGS;
    this.seedEnvironments = opts.seedEnvironments;
  }

  /** Create an org owned by `userId` (enforces the ≤N-owned limit). */
  async createOrg(userId: string, displayNameRaw: string): Promise<OrgSummary> {
    const displayName = normalizeName(displayNameRaw);
    if ((await this.orgs.countOwnedByUser(userId)) >= this.maxOwnedOrgs) {
      throw new TenancyError("ORG_LIMIT");
    }
    const now = this.nowMs();
    const org = await this.orgs.create({
      id: this.genId(ID_PREFIXES.org),
      displayName,
      ownerUserId: userId,
      createdAt: now,
    });
    await this.memberships.create({
      id: this.genId(ID_PREFIXES.membership),
      userId,
      orgId: org.id,
      role: "owner",
      createdAt: now,
    });
    if (this.seedEnvironments) {
      await this.seedEnvironments(org.id);
    }
    return { org, role: "owner" };
  }

  /** All orgs the user belongs to, with their role in each. */
  async listForUser(userId: string): Promise<OrgSummary[]> {
    const mems = await this.memberships.listByUser(userId);
    const out: OrgSummary[] = [];
    for (const m of mems) {
      const org = await this.orgs.findById(m.orgId);
      if (org) {
        out.push({ org, role: m.role });
      }
    }
    return out;
  }

  /** A single org the user belongs to (throws NOT_FOUND if they don't). */
  async getForUser(userId: string, orgId: string): Promise<OrgSummary> {
    const membership = await this.memberships.findByUserAndOrg(userId, orgId);
    if (!membership) {
      throw new TenancyError("NOT_FOUND");
    }
    const org = await this.orgs.findById(orgId);
    if (!org) {
      throw new TenancyError("NOT_FOUND");
    }
    return { org, role: membership.role };
  }

  /** Rename an org's display name (owner only). */
  async rename(
    userId: string,
    orgId: string,
    displayNameRaw: string
  ): Promise<Org> {
    const { org } = await this.requireOwner(userId, orgId);
    const displayName = normalizeName(displayNameRaw);
    const updated: Org = { ...org, displayName, updatedAt: this.nowMs() };
    await this.orgs.update(updated);
    return updated;
  }

  /** Delete an org and its memberships (owner only). */
  async deleteOrg(userId: string, orgId: string): Promise<void> {
    await this.requireOwner(userId, orgId);
    await this.memberships.deleteByOrg(orgId);
    await this.orgs.delete(orgId);
  }

  private async requireOwner(
    userId: string,
    orgId: string
  ): Promise<OrgSummary> {
    const summary = await this.getForUser(userId, orgId);
    if (summary.role !== "owner") {
      throw new TenancyError("FORBIDDEN");
    }
    return summary;
  }
}

function normalizeName(raw: string): string {
  const name = raw.trim();
  if (name.length < NAME_MIN || name.length > NAME_MAX) {
    throw new TenancyError("INVALID_NAME");
  }
  return name;
}
