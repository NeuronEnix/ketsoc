import type {
  User,
  NewUser,
  AuthSession,
  UserRepo,
  SessionRepo,
  Org,
  NewOrg,
  Membership,
  OrgRole,
  OrgRepo,
  MembershipRepo,
} from "./repos.js";

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  display_name: string | null;
  created_at: number;
  updated_at: number;
}

function toUser(r: UserRow): User {
  return {
    id: r.id,
    email: r.email,
    passwordHash: r.password_hash,
    displayName: r.display_name,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export class D1UserRepo implements UserRepo {
  constructor(private readonly db: D1Database) {}

  async create(u: NewUser): Promise<User> {
    await this.db
      .prepare(
        "INSERT INTO users (id, email, password_hash, display_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
      )
      .bind(
        u.id,
        u.email,
        u.passwordHash,
        u.displayName,
        u.createdAt,
        u.createdAt
      )
      .run();
    return { ...u, updatedAt: u.createdAt };
  }

  async findByEmail(email: string): Promise<User | null> {
    const row = await this.db
      .prepare("SELECT * FROM users WHERE email = ?")
      .bind(email)
      .first<UserRow>();
    return row ? toUser(row) : null;
  }

  async findById(id: string): Promise<User | null> {
    const row = await this.db
      .prepare("SELECT * FROM users WHERE id = ?")
      .bind(id)
      .first<UserRow>();
    return row ? toUser(row) : null;
  }
}

interface SessionRow {
  id: string;
  user_id: string;
  refresh_token_hash: string;
  user_agent: string | null;
  ip: string | null;
  expires_at: number;
  created_at: number;
}

function toSession(r: SessionRow): AuthSession {
  return {
    id: r.id,
    userId: r.user_id,
    refreshTokenHash: r.refresh_token_hash,
    userAgent: r.user_agent,
    ip: r.ip,
    expiresAt: r.expires_at,
    createdAt: r.created_at,
  };
}

export class D1SessionRepo implements SessionRepo {
  constructor(private readonly db: D1Database) {}

  async create(s: AuthSession): Promise<void> {
    await this.db
      .prepare(
        "INSERT INTO auth_sessions (id, user_id, refresh_token_hash, user_agent, ip, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
      )
      .bind(
        s.id,
        s.userId,
        s.refreshTokenHash,
        s.userAgent,
        s.ip,
        s.expiresAt,
        s.createdAt
      )
      .run();
  }

  async findById(id: string): Promise<AuthSession | null> {
    const row = await this.db
      .prepare("SELECT * FROM auth_sessions WHERE id = ?")
      .bind(id)
      .first<SessionRow>();
    return row ? toSession(row) : null;
  }

  async update(s: AuthSession): Promise<void> {
    await this.db
      .prepare(
        "UPDATE auth_sessions SET refresh_token_hash = ?, user_agent = ?, ip = ?, expires_at = ? WHERE id = ?"
      )
      .bind(s.refreshTokenHash, s.userAgent, s.ip, s.expiresAt, s.id)
      .run();
  }

  async deleteById(id: string): Promise<void> {
    await this.db
      .prepare("DELETE FROM auth_sessions WHERE id = ?")
      .bind(id)
      .run();
  }

  async deleteByUser(userId: string): Promise<void> {
    await this.db
      .prepare("DELETE FROM auth_sessions WHERE user_id = ?")
      .bind(userId)
      .run();
  }
}

interface OrgRow {
  id: string;
  display_name: string;
  handle: string | null;
  owner_user_id: string;
  created_at: number;
  updated_at: number;
}

function toOrg(r: OrgRow): Org {
  return {
    id: r.id,
    displayName: r.display_name,
    handle: r.handle,
    ownerUserId: r.owner_user_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export class D1OrgRepo implements OrgRepo {
  constructor(private readonly db: D1Database) {}

  async create(o: NewOrg): Promise<Org> {
    await this.db
      .prepare(
        "INSERT INTO orgs (id, display_name, handle, owner_user_id, created_at, updated_at) VALUES (?, ?, NULL, ?, ?, ?)"
      )
      .bind(o.id, o.displayName, o.ownerUserId, o.createdAt, o.createdAt)
      .run();
    return { ...o, handle: null, updatedAt: o.createdAt };
  }

  async findById(id: string): Promise<Org | null> {
    const row = await this.db
      .prepare("SELECT * FROM orgs WHERE id = ?")
      .bind(id)
      .first<OrgRow>();
    return row ? toOrg(row) : null;
  }

  async update(o: Org): Promise<void> {
    await this.db
      .prepare(
        "UPDATE orgs SET display_name = ?, handle = ?, updated_at = ? WHERE id = ?"
      )
      .bind(o.displayName, o.handle, o.updatedAt, o.id)
      .run();
  }

  async delete(id: string): Promise<void> {
    await this.db.prepare("DELETE FROM orgs WHERE id = ?").bind(id).run();
  }

  async countOwnedByUser(userId: string): Promise<number> {
    const row = await this.db
      .prepare("SELECT COUNT(*) AS n FROM orgs WHERE owner_user_id = ?")
      .bind(userId)
      .first<{ n: number }>();
    return row?.n ?? 0;
  }
}

interface MembershipRow {
  id: string;
  user_id: string;
  org_id: string;
  role: string;
  created_at: number;
}

function toMembership(r: MembershipRow): Membership {
  return {
    id: r.id,
    userId: r.user_id,
    orgId: r.org_id,
    role: r.role as OrgRole,
    createdAt: r.created_at,
  };
}

export class D1MembershipRepo implements MembershipRepo {
  constructor(private readonly db: D1Database) {}

  async create(m: Membership): Promise<Membership> {
    await this.db
      .prepare(
        "INSERT INTO memberships (id, user_id, org_id, role, created_at) VALUES (?, ?, ?, ?, ?)"
      )
      .bind(m.id, m.userId, m.orgId, m.role, m.createdAt)
      .run();
    return m;
  }

  async findByUserAndOrg(
    userId: string,
    orgId: string
  ): Promise<Membership | null> {
    const row = await this.db
      .prepare("SELECT * FROM memberships WHERE user_id = ? AND org_id = ?")
      .bind(userId, orgId)
      .first<MembershipRow>();
    return row ? toMembership(row) : null;
  }

  async listByUser(userId: string): Promise<Membership[]> {
    const { results } = await this.db
      .prepare("SELECT * FROM memberships WHERE user_id = ?")
      .bind(userId)
      .all<MembershipRow>();
    return results.map(toMembership);
  }

  async listByOrg(orgId: string): Promise<Membership[]> {
    const { results } = await this.db
      .prepare("SELECT * FROM memberships WHERE org_id = ?")
      .bind(orgId)
      .all<MembershipRow>();
    return results.map(toMembership);
  }

  async delete(id: string): Promise<void> {
    await this.db
      .prepare("DELETE FROM memberships WHERE id = ?")
      .bind(id)
      .run();
  }

  async deleteByOrg(orgId: string): Promise<void> {
    await this.db
      .prepare("DELETE FROM memberships WHERE org_id = ?")
      .bind(orgId)
      .run();
  }
}
