import { TenancyError } from "../tenancy/service.js";
import type { OrgService, TenancyErrorCode } from "../tenancy/service.js";
import { EnvError } from "../tenancy/env-service.js";
import type { EnvService, EnvErrorCode } from "../tenancy/env-service.js";
import type { PublicUser } from "../auth/service.js";
import type { Environment } from "../db/repos.js";
import { okResponse, errResponse } from "../types.js";
import { readJson, readString, checkOrigin } from "./http.js";

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

interface EnvDTO {
  id: string;
  name: string;
  mode: "live" | "test";
  isPermanent: boolean;
  createdAt: number;
}

function envDTO(e: Environment): EnvDTO {
  return {
    id: e.id,
    name: e.name,
    mode: e.mode,
    isPermanent: e.isPermanent,
    createdAt: e.createdAt,
  };
}

export interface EnvHandlerDeps {
  orgService: OrgService;
  envService: EnvService;
}

/** Handle `/api/orgs/:orgId/envs[...]`. Caller has authenticated `user`. */
export async function handleEnvsRequest(
  req: Request,
  deps: EnvHandlerDeps,
  user: PublicUser
): Promise<Response> {
  const url = new URL(req.url);
  const segs = url.pathname
    .slice("/api/orgs/".length)
    .split("/")
    .filter(Boolean);
  const orgId = segs[0];
  if (!orgId || segs[1] !== "envs") {
    return errResponse("NOT_FOUND", "Unknown route", 404);
  }

  try {
    // Membership check (throws TenancyError NOT_FOUND if the user isn't a member).
    await deps.orgService.getForUser(user.id, orgId);

    if (segs.length === 2) {
      if (req.method === "GET") {
        const list = await deps.envService.listByOrg(orgId);
        return okResponse(list.map(envDTO));
      }
      if (req.method === "POST") {
        const originError = checkOrigin(req, url);
        if (originError) {
          return originError;
        }
        const body = await readJson(req);
        if (!body) {
          return errResponse("BAD_JSON", "Invalid JSON body", 400);
        }
        const env = await deps.envService.create(
          orgId,
          readString(body, "name")
        );
        return okResponse(envDTO(env), 201);
      }
      return errResponse("METHOD_NOT_ALLOWED", "Method not allowed", 405);
    }

    if (segs.length === 3) {
      const envId = segs[2];
      if (!envId) {
        return errResponse("NOT_FOUND", "Unknown route", 404);
      }
      if (req.method === "DELETE") {
        const originError = checkOrigin(req, url);
        if (originError) {
          return originError;
        }
        await deps.envService.delete(orgId, envId);
        return okResponse({ ok: true });
      }
      return errResponse("METHOD_NOT_ALLOWED", "Method not allowed", 405);
    }

    return errResponse("NOT_FOUND", "Unknown route", 404);
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
