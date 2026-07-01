import type {
  User,
  NewUser,
  AuthSession,
  UserRepo,
  SessionRepo,
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
