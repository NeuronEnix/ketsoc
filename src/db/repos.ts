/** Persistence contracts. Implemented by D1 (prod) and in-memory (tests). */

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
