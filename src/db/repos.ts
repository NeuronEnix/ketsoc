/** Persistence contracts. Implemented by D1 (prod) and in-memory (tests). */

// ─── Auth ────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface NewUser {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string | null;
  createdAt: number;
}

export interface AuthSession {
  id: string;
  userId: string;
  refreshTokenHash: string;
  userAgent: string | null;
  ip: string | null;
  expiresAt: number;
  createdAt: number;
}

export interface UserRepo {
  create(user: NewUser): Promise<User>;
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
}

export interface SessionRepo {
  create(session: AuthSession): Promise<void>;
  findById(id: string): Promise<AuthSession | null>;
  update(session: AuthSession): Promise<void>;
  deleteById(id: string): Promise<void>;
  deleteByUser(userId: string): Promise<void>;
}

// ─── Tenancy ─────────────────────────────────────────────────────────────────

export type OrgRole = "owner" | "member";
export type InviteStatus = "pending" | "accepted" | "revoked";

export interface Org {
  id: string;
  displayName: string;
  /** Reserved for future subdomains; unused in Phase 1. */
  handle: string | null;
  ownerUserId: string;
  createdAt: number;
  updatedAt: number;
}

export interface NewOrg {
  id: string;
  displayName: string;
  ownerUserId: string;
  createdAt: number;
}

export interface Membership {
  id: string;
  userId: string;
  orgId: string;
  role: OrgRole;
  createdAt: number;
}

export interface Invite {
  id: string;
  orgId: string;
  token: string;
  email: string | null;
  role: OrgRole;
  status: InviteStatus;
  invitedBy: string;
  expiresAt: number;
  createdAt: number;
}

export interface OrgRepo {
  create(org: NewOrg): Promise<Org>;
  findById(id: string): Promise<Org | null>;
  update(org: Org): Promise<void>;
  delete(id: string): Promise<void>;
  countOwnedByUser(userId: string): Promise<number>;
}

export interface MembershipRepo {
  create(membership: Membership): Promise<Membership>;
  findByUserAndOrg(userId: string, orgId: string): Promise<Membership | null>;
  listByUser(userId: string): Promise<Membership[]>;
  listByOrg(orgId: string): Promise<Membership[]>;
  delete(id: string): Promise<void>;
  deleteByOrg(orgId: string): Promise<void>;
}

export interface InviteRepo {
  create(invite: Invite): Promise<Invite>;
  findByToken(token: string): Promise<Invite | null>;
  listByOrg(orgId: string): Promise<Invite[]>;
  update(invite: Invite): Promise<void>;
  delete(id: string): Promise<void>;
}

// ─── Environments ────────────────────────────────────────────────────────────

export type EnvMode = "live" | "test";

export interface Environment {
  id: string;
  orgId: string;
  name: string;
  mode: EnvMode;
  isPermanent: boolean;
  createdAt: number;
}

export interface EnvRepo {
  create(env: Environment): Promise<Environment>;
  findById(id: string): Promise<Environment | null>;
  findByOrgAndName(orgId: string, name: string): Promise<Environment | null>;
  listByOrg(orgId: string): Promise<Environment[]>;
  countByOrg(orgId: string): Promise<number>;
  delete(id: string): Promise<void>;
}

// ─── API keys ────────────────────────────────────────────────────────────────

export type ApiKeyType = "public" | "secret";

export interface ApiKey {
  id: string; // kid
  envId: string;
  type: ApiKeyType;
  label: string | null;
  keyHash: string;
  keyPrefix: string;
  lastUsedAt: number | null;
  revokedAt: number | null;
  createdAt: number;
}

export interface ApiKeyRepo {
  create(key: ApiKey): Promise<ApiKey>;
  listByEnv(envId: string): Promise<ApiKey[]>;
  findById(id: string): Promise<ApiKey | null>;
  update(key: ApiKey): Promise<void>;
}
