import { sha256Hex } from "../auth/tokens.js";
import {
  randomBase62,
  formatKey,
  parseKey,
  envRefFromId,
  KID_LEN,
  SECRET_LEN,
} from "./format.js";
import type {
  ApiKey,
  ApiKeyType,
  ApiKeyRepo,
  Environment,
} from "../db/repos.js";

export type KeyErrorCode = "NOT_FOUND";

export class KeyError extends Error {
  constructor(
    public readonly code: KeyErrorCode,
    message?: string
  ) {
    super(message ?? code);
    this.name = "KeyError";
  }
}

/** Safe key representation (never includes the secret or hash). */
export interface ApiKeyDTO {
  id: string;
  envId: string;
  type: ApiKeyType;
  label: string | null;
  keyPrefix: string;
  lastUsedAt: number | null;
  revokedAt: number | null;
  createdAt: number;
}

function toDTO(k: ApiKey): ApiKeyDTO {
  return {
    id: k.id,
    envId: k.envId,
    type: k.type,
    label: k.label,
    keyPrefix: k.keyPrefix,
    lastUsedAt: k.lastUsedAt,
    revokedAt: k.revokedAt,
    createdAt: k.createdAt,
  };
}

const KIND_BY_TYPE = { public: "kpk", secret: "ksk" } as const;

export interface KeyServiceOptions {
  keys: ApiKeyRepo;
  nowMs?: () => number;
  genKid?: () => string;
  genSecret?: () => string;
}

export class KeyService {
  private readonly keys: ApiKeyRepo;
  private readonly nowMs: () => number;
  private readonly genKid: () => string;
  private readonly genSecret: () => string;

  constructor(opts: KeyServiceOptions) {
    this.keys = opts.keys;
    this.nowMs = opts.nowMs ?? (() => Date.now());
    this.genKid = opts.genKid ?? (() => randomBase62(KID_LEN));
    this.genSecret = opts.genSecret ?? (() => randomBase62(SECRET_LEN));
  }

  /** Create a key. The full key is returned ONCE; only its SHA-256 is stored. */
  async create(
    env: Environment,
    type: ApiKeyType,
    label: string | null
  ): Promise<{ key: string; record: ApiKeyDTO }> {
    const kid = this.genKid();
    const secret = this.genSecret();
    const kind = KIND_BY_TYPE[type];
    const envRef = envRefFromId(env.id);
    const prefix = `${kind}.${envRef}.${kid}.`;
    const full = formatKey(kind, envRef, kid, secret);
    const record: ApiKey = {
      id: kid,
      envId: env.id,
      type,
      label,
      keyHash: await sha256Hex(full),
      keyPrefix: prefix,
      lastUsedAt: null,
      revokedAt: null,
      createdAt: this.nowMs(),
    };
    await this.keys.create(record);
    return { key: full, record: toDTO(record) };
  }

  async listByEnv(envId: string): Promise<ApiKeyDTO[]> {
    return (await this.keys.listByEnv(envId)).map(toDTO);
  }

  async relabel(
    envId: string,
    keyId: string,
    label: string | null
  ): Promise<ApiKeyDTO> {
    const key = await this.requireKey(envId, keyId);
    const updated: ApiKey = { ...key, label };
    await this.keys.update(updated);
    return toDTO(updated);
  }

  async revoke(envId: string, keyId: string): Promise<void> {
    const key = await this.requireKey(envId, keyId);
    if (key.revokedAt !== null) {
      return;
    }
    await this.keys.update({ ...key, revokedAt: this.nowMs() });
  }

  /** Resolve a presented key to its active record, or null (bad/tampered/revoked). */
  async resolve(presented: string): Promise<ApiKey | null> {
    const parsed = parseKey(presented);
    if (!parsed) {
      return null;
    }
    const key = await this.keys.findById(parsed.kid);
    if (!key || key.revokedAt !== null) {
      return null;
    }
    const hash = await sha256Hex(presented);
    if (!timingSafeEqual(hash, key.keyHash)) {
      return null;
    }
    return key;
  }

  private async requireKey(envId: string, keyId: string): Promise<ApiKey> {
    const key = await this.keys.findById(keyId);
    if (!key || key.envId !== envId) {
      throw new KeyError("NOT_FOUND");
    }
    return key;
  }
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
