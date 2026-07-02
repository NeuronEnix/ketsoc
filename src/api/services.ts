import type { Env } from "../types.js";
import { errResponse } from "../types.js";
import { AuthService } from "../auth/service.js";
import type { PublicUser } from "../auth/service.js";
import { OrgService } from "../tenancy/service.js";
import { EnvService } from "../tenancy/env-service.js";
import { KeyService } from "../keys/service.js";
import {
  D1UserRepo,
  D1SessionRepo,
  D1OrgRepo,
  D1MembershipRepo,
  D1EnvRepo,
  D1ApiKeyRepo,
} from "../db/d1-repos.js";
import { getAuthUser } from "./auth.js";

/** Construct the D1-backed services the HTTP handlers depend on. */
export function buildAuthService(env: Env): AuthService {
  return new AuthService({
    users: new D1UserRepo(env.DB),
    sessions: new D1SessionRepo(env.DB),
    jwtSecret: env.JWT_SECRET,
  });
}

export function buildEnvService(env: Env): EnvService {
  return new EnvService({ envs: new D1EnvRepo(env.DB) });
}

export function buildKeyService(env: Env): KeyService {
  return new KeyService({ keys: new D1ApiKeyRepo(env.DB) });
}

export function buildOrgService(
  env: Env,
  seedEnvironments?: (orgId: string) => Promise<void>
): OrgService {
  return new OrgService({
    orgs: new D1OrgRepo(env.DB),
    memberships: new D1MembershipRepo(env.DB),
    ...(seedEnvironments ? { seedEnvironments } : {}),
  });
}

/**
 * Resolve the signed-in user from the request cookies, or a 401 Response to
 * short-circuit the route. Callers do: `const u = await requireAuth(req, env);
 * if (u instanceof Response) return u;`.
 */
export async function requireAuth(
  req: Request,
  env: Env
): Promise<PublicUser | Response> {
  const user = await getAuthUser(req, buildAuthService(env));
  return user ?? errResponse("UNAUTHENTICATED", "Not signed in", 401);
}
