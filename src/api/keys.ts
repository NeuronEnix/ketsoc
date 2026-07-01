import { TenancyError } from "../tenancy/service.js";
import type { OrgService, TenancyErrorCode } from "../tenancy/service.js";
import { EnvError } from "../tenancy/env-service.js";
import type { EnvService, EnvErrorCode } from "../tenancy/env-service.js";
import { KeyError } from "../keys/service.js";
import type { KeyService, KeyErrorCode } from "../keys/service.js";
import type { PublicUser } from "../auth/service.js";
import type { ApiKeyType } from "../db/repos.js";
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
const KEY_STATUS: Record<KeyErrorCode, number> = { NOT_FOUND: 404 };

export interface KeyHandlerDeps {
  orgService: OrgService;
  envService: EnvService;
  keyService: KeyService;
}

function parseType(raw: string): ApiKeyType | null {
  return raw === "public" || raw === "secret" ? raw : null;
}

function optionalLabel(body: Record<string, unknown>): string | null {
  const label = readString(body, "label");
  return label.length > 0 ? label : null;
}

/** Handle `/api/orgs/:orgId/envs/:envId/keys[...]`. Caller has authenticated `user`. */
export async function handleKeysRequest(
  req: Request,
  deps: KeyHandlerDeps,
  user: PublicUser
): Promise<Response> {
  const url = new URL(req.url);
  const segs = url.pathname
    .slice("/api/orgs/".length)
    .split("/")
    .filter(Boolean);
  const orgId = segs[0];
  const envId = segs[2];
  if (!orgId || segs[1] !== "envs" || !envId || segs[3] !== "keys") {
    return errResponse("NOT_FOUND", "Unknown route", 404);
  }

  try {
    await deps.orgService.getForUser(user.id, orgId); // membership
    const env = await deps.envService.getForOrg(orgId, envId); // env-in-org

    if (segs.length === 4) {
      if (req.method === "GET") {
        return okResponse(await deps.keyService.listByEnv(envId));
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
        const type = parseType(readString(body, "type"));
        if (!type) {
          return errResponse(
            "INVALID_TYPE",
            "type must be 'public' or 'secret'",
            400
          );
        }
        const { key, record } = await deps.keyService.create(
          env,
          type,
          optionalLabel(body)
        );
        // Reveal the full key ONCE (only its hash is stored).
        return okResponse({ ...record, key }, 201);
      }
      return errResponse("METHOD_NOT_ALLOWED", "Method not allowed", 405);
    }

    if (segs.length === 5) {
      const keyId = segs[4];
      if (!keyId) {
        return errResponse("NOT_FOUND", "Unknown route", 404);
      }
      if (req.method === "PATCH") {
        const originError = checkOrigin(req, url);
        if (originError) {
          return originError;
        }
        const body = await readJson(req);
        if (!body) {
          return errResponse("BAD_JSON", "Invalid JSON body", 400);
        }
        return okResponse(
          await deps.keyService.relabel(envId, keyId, optionalLabel(body))
        );
      }
      if (req.method === "DELETE") {
        const originError = checkOrigin(req, url);
        if (originError) {
          return originError;
        }
        await deps.keyService.revoke(envId, keyId);
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
    if (e instanceof KeyError) {
      return errResponse(e.code, e.message, KEY_STATUS[e.code]);
    }
    throw e;
  }
}
