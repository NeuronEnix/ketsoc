import { TenancyError } from "../tenancy/service.js";
import type { OrgService, TenancyErrorCode } from "../tenancy/service.js";
import { EnvError } from "../tenancy/env-service.js";
import type { EnvService, EnvErrorCode } from "../tenancy/env-service.js";
import type { PublicUser } from "../auth/service.js";
import { okResponse, errResponse } from "../types.js";
import { seededUsage } from "../telemetry/usage.js";

const TENANCY_STATUS: Record<TenancyErrorCode, number> = {
  INVALID_NAME: 400,
  ORG_LIMIT: 409,
  NOT_FOUND: 404,
  FORBIDDEN: 403,
};
const ENV_STATUS: Record<EnvErrorCode, number> = {
  INVALID_NAME: 400,
  RESERVED_NAME: 409,
  NAME_TAKEN: 409,
  ENV_LIMIT: 409,
  NOT_FOUND: 404,
  PROTECTED: 409,
};

export interface UsageHandlerDeps {
  orgService: OrgService;
  envService: EnvService;
  nowMs?: () => number;
}

/** Handle `/api/orgs/:orgId/envs/:envId/usage`. Caller has authenticated `user`. */
export async function handleUsageRequest(
  req: Request,
  deps: UsageHandlerDeps,
  user: PublicUser
): Promise<Response> {
  const url = new URL(req.url);
  const segs = url.pathname
    .slice("/api/orgs/".length)
    .split("/")
    .filter(Boolean);
  const orgId = segs[0];
  const envId = segs[2];
  if (!orgId || segs[1] !== "envs" || !envId || segs[3] !== "usage") {
    return errResponse("NOT_FOUND", "Unknown route", 404);
  }
  if (req.method !== "GET") {
    return errResponse("METHOD_NOT_ALLOWED", "Use GET", 405);
  }

  try {
    await deps.orgService.getForUser(user.id, orgId);
    const env = await deps.envService.getForOrg(orgId, envId);
    const now = (deps.nowMs ?? (() => Date.now()))();
    return okResponse(seededUsage(env.id, env.mode, now));
  } catch (e) {
    if (e instanceof TenancyError) {
      return errResponse(e.code, e.message, TENANCY_STATUS[e.code]);
    }
    if (e instanceof EnvError) {
      return errResponse(e.code, e.message, ENV_STATUS[e.code]);
    }
    throw e;
  }
}
