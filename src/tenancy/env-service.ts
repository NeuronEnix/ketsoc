import { ID_PREFIXES, typeid } from "../ids.js";
import type { Environment, EnvRepo } from "../db/repos.js";

const ENV_NAME_RE = /^[a-z]{4}$/;
const RESERVED_NAME = "prod";
const DEFAULT_MAX_ENVS = 5;

export type EnvErrorCode =
  | "INVALID_NAME"
  | "RESERVED_NAME"
  | "NAME_TAKEN"
  | "ENV_LIMIT"
  | "NOT_FOUND"
  | "PROTECTED";

export class EnvError extends Error {
  constructor(
    public readonly code: EnvErrorCode,
    message?: string
  ) {
    super(message ?? code);
    this.name = "EnvError";
  }
}

export interface EnvServiceOptions {
  envs: EnvRepo;
  nowMs?: () => number;
  genId?: (prefix: string) => string;
  maxEnvs?: number;
}

export class EnvService {
  private readonly envs: EnvRepo;
  private readonly nowMs: () => number;
  private readonly genId: (prefix: string) => string;
  private readonly maxEnvs: number;

  constructor(opts: EnvServiceOptions) {
    this.envs = opts.envs;
    this.nowMs = opts.nowMs ?? (() => Date.now());
    this.genId = opts.genId ?? ((p) => typeid(p));
    this.maxEnvs = opts.maxEnvs ?? DEFAULT_MAX_ENVS;
  }

  /** Seed the two default envs for a new org: `prod` (live, permanent) + `test`. */
  async seedDefaults(orgId: string): Promise<Environment[]> {
    const now = this.nowMs();
    const prod = await this.envs.create({
      id: this.genId(ID_PREFIXES.environment),
      orgId,
      name: "prod",
      mode: "live",
      isPermanent: true,
      createdAt: now,
    });
    const test = await this.envs.create({
      id: this.genId(ID_PREFIXES.environment),
      orgId,
      name: "test",
      mode: "test",
      isPermanent: false,
      createdAt: now,
    });
    return [prod, test];
  }

  /** Create a user env: exactly 4 lowercase letters, not `prod`, unique, ≤cap, test-mode. */
  async create(orgId: string, nameRaw: string): Promise<Environment> {
    const name = nameRaw.trim();
    if (name === RESERVED_NAME) {
      throw new EnvError("RESERVED_NAME");
    }
    if (!ENV_NAME_RE.test(name)) {
      throw new EnvError("INVALID_NAME");
    }
    if (await this.envs.findByOrgAndName(orgId, name)) {
      throw new EnvError("NAME_TAKEN");
    }
    if ((await this.envs.countByOrg(orgId)) >= this.maxEnvs) {
      throw new EnvError("ENV_LIMIT");
    }
    return this.envs.create({
      id: this.genId(ID_PREFIXES.environment),
      orgId,
      name,
      mode: "test",
      isPermanent: false,
      createdAt: this.nowMs(),
    });
  }

  async listByOrg(orgId: string): Promise<Environment[]> {
    return this.envs.listByOrg(orgId);
  }

  /** Fetch an env that belongs to the org (throws NOT_FOUND otherwise). */
  async getForOrg(orgId: string, envId: string): Promise<Environment> {
    const env = await this.envs.findById(envId);
    if (!env || env.orgId !== orgId) {
      throw new EnvError("NOT_FOUND");
    }
    return env;
  }

  /** Delete an env (never `prod`; must belong to the org). */
  async delete(orgId: string, envId: string): Promise<void> {
    const env = await this.envs.findById(envId);
    if (!env || env.orgId !== orgId) {
      throw new EnvError("NOT_FOUND");
    }
    if (env.isPermanent) {
      throw new EnvError("PROTECTED");
    }
    await this.envs.delete(envId);
  }
}
