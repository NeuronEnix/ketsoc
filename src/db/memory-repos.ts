import type {
  User,
  NewUser,
  AuthSession,
  UserRepo,
  SessionRepo,
  Org,
  NewOrg,
  Membership,
  OrgRepo,
  MembershipRepo,
  Environment,
  EnvRepo,
  ApiKey,
  ApiKeyRepo,
} from "./repos.js";

/** In-memory UserRepo for unit tests. */
export class MemoryUserRepo implements UserRepo {
  private byId = new Map<string, User>();
  private idByEmail = new Map<string, string>();

  async create(user: NewUser): Promise<User> {
    const full: User = { ...user, updatedAt: user.createdAt };
    this.byId.set(full.id, full);
    this.idByEmail.set(full.email, full.id);
    return full;
  }

  async findByEmail(email: string): Promise<User | null> {
    const id = this.idByEmail.get(email);
    return id ? (this.byId.get(id) ?? null) : null;
  }

  async findById(id: string): Promise<User | null> {
    return this.byId.get(id) ?? null;
  }
}

/** In-memory SessionRepo for unit tests. */
export class MemorySessionRepo implements SessionRepo {
  private byId = new Map<string, AuthSession>();

  async create(session: AuthSession): Promise<void> {
    this.byId.set(session.id, { ...session });
  }

  async findById(id: string): Promise<AuthSession | null> {
    const s = this.byId.get(id);
    return s ? { ...s } : null;
  }

  async update(session: AuthSession): Promise<void> {
    this.byId.set(session.id, { ...session });
  }

  async deleteById(id: string): Promise<void> {
    this.byId.delete(id);
  }

  async deleteByUser(userId: string): Promise<void> {
    for (const [id, s] of this.byId) {
      if (s.userId === userId) {
        this.byId.delete(id);
      }
    }
  }
}

/** In-memory OrgRepo for unit tests. */
export class MemoryOrgRepo implements OrgRepo {
  private byId = new Map<string, Org>();

  async create(org: NewOrg): Promise<Org> {
    const full: Org = { ...org, handle: null, updatedAt: org.createdAt };
    this.byId.set(full.id, full);
    return { ...full };
  }

  async findById(id: string): Promise<Org | null> {
    const org = this.byId.get(id);
    return org ? { ...org } : null;
  }

  async update(org: Org): Promise<void> {
    this.byId.set(org.id, { ...org });
  }

  async delete(id: string): Promise<void> {
    this.byId.delete(id);
  }

  async countOwnedByUser(userId: string): Promise<number> {
    let n = 0;
    for (const org of this.byId.values()) {
      if (org.ownerUserId === userId) {
        n++;
      }
    }
    return n;
  }
}

/** In-memory MembershipRepo for unit tests. */
export class MemoryMembershipRepo implements MembershipRepo {
  private byId = new Map<string, Membership>();

  async create(membership: Membership): Promise<Membership> {
    this.byId.set(membership.id, { ...membership });
    return { ...membership };
  }

  async findByUserAndOrg(
    userId: string,
    orgId: string
  ): Promise<Membership | null> {
    for (const m of this.byId.values()) {
      if (m.userId === userId && m.orgId === orgId) {
        return { ...m };
      }
    }
    return null;
  }

  async listByUser(userId: string): Promise<Membership[]> {
    return [...this.byId.values()]
      .filter((m) => m.userId === userId)
      .map((m) => ({ ...m }));
  }

  async listByOrg(orgId: string): Promise<Membership[]> {
    return [...this.byId.values()]
      .filter((m) => m.orgId === orgId)
      .map((m) => ({ ...m }));
  }

  async delete(id: string): Promise<void> {
    this.byId.delete(id);
  }

  async deleteByOrg(orgId: string): Promise<void> {
    for (const [id, m] of this.byId) {
      if (m.orgId === orgId) {
        this.byId.delete(id);
      }
    }
  }
}

/** In-memory EnvRepo for unit tests. */
export class MemoryEnvRepo implements EnvRepo {
  private byId = new Map<string, Environment>();

  async create(env: Environment): Promise<Environment> {
    this.byId.set(env.id, { ...env });
    return { ...env };
  }

  async findById(id: string): Promise<Environment | null> {
    const e = this.byId.get(id);
    return e ? { ...e } : null;
  }

  async findByOrgAndName(
    orgId: string,
    name: string
  ): Promise<Environment | null> {
    for (const e of this.byId.values()) {
      if (e.orgId === orgId && e.name === name) {
        return { ...e };
      }
    }
    return null;
  }

  async listByOrg(orgId: string): Promise<Environment[]> {
    return [...this.byId.values()]
      .filter((e) => e.orgId === orgId)
      .map((e) => ({ ...e }));
  }

  async countByOrg(orgId: string): Promise<number> {
    let n = 0;
    for (const e of this.byId.values()) {
      if (e.orgId === orgId) {
        n++;
      }
    }
    return n;
  }

  async delete(id: string): Promise<void> {
    this.byId.delete(id);
  }
}

/** In-memory ApiKeyRepo for unit tests. */
export class MemoryApiKeyRepo implements ApiKeyRepo {
  private byId = new Map<string, ApiKey>();

  async create(key: ApiKey): Promise<ApiKey> {
    this.byId.set(key.id, { ...key });
    return { ...key };
  }

  async listByEnv(envId: string): Promise<ApiKey[]> {
    return [...this.byId.values()]
      .filter((k) => k.envId === envId)
      .map((k) => ({ ...k }));
  }

  async findById(id: string): Promise<ApiKey | null> {
    const k = this.byId.get(id);
    return k ? { ...k } : null;
  }

  async update(key: ApiKey): Promise<void> {
    this.byId.set(key.id, { ...key });
  }
}
