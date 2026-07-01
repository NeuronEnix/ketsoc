import { TenancyError } from "../tenancy/service.js";
import type {
  OrgService,
  OrgSummary,
  TenancyErrorCode,
} from "../tenancy/service.js";
import type { PublicUser } from "../auth/service.js";
import type { Org, OrgRole } from "../db/repos.js";
import { okResponse, errResponse } from "../types.js";
import { readJson, readString, checkOrigin } from "./http.js";

const STATUS_BY_CODE: Record<TenancyErrorCode, number> = {
  INVALID_NAME: 400,
  ORG_LIMIT: 409,
  NOT_FOUND: 404,
  FORBIDDEN: 403,
};

interface OrgDTO {
  id: string;
  displayName: string;
  handle: string | null;
  role: OrgRole;
  createdAt: number;
}

function summaryToDTO(s: OrgSummary): OrgDTO {
  return {
    id: s.org.id,
    displayName: s.org.displayName,
    handle: s.org.handle,
    role: s.role,
    createdAt: s.org.createdAt,
  };
}

function orgToDTO(org: Org, role: OrgRole): OrgDTO {
  return {
    id: org.id,
    displayName: org.displayName,
    handle: org.handle,
    role,
    createdAt: org.createdAt,
  };
}

/** Handle `/api/orgs` and `/api/orgs/:id`. Caller has already authenticated `user`. */
export async function handleOrgsRequest(
  req: Request,
  orgService: OrgService,
  user: PublicUser
): Promise<Response> {
  const url = new URL(req.url);
  const rest = url.pathname.slice("/api/orgs".length);

  try {
    if (rest === "" || rest === "/") {
      if (req.method === "GET") {
        const list = await orgService.listForUser(user.id);
        return okResponse(list.map(summaryToDTO));
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
        const created = await orgService.createOrg(
          user.id,
          readString(body, "displayName")
        );
        return okResponse(summaryToDTO(created), 201);
      }
      return errResponse("METHOD_NOT_ALLOWED", "Method not allowed", 405);
    }

    const orgId = rest.slice(1);
    if (!orgId || orgId.includes("/")) {
      return errResponse("NOT_FOUND", "Unknown route", 404);
    }

    if (req.method === "GET") {
      return okResponse(
        summaryToDTO(await orgService.getForUser(user.id, orgId))
      );
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
      const org = await orgService.rename(
        user.id,
        orgId,
        readString(body, "displayName")
      );
      return okResponse(orgToDTO(org, "owner"));
    }
    if (req.method === "DELETE") {
      const originError = checkOrigin(req, url);
      if (originError) {
        return originError;
      }
      await orgService.deleteOrg(user.id, orgId);
      return okResponse({ ok: true });
    }
    return errResponse("METHOD_NOT_ALLOWED", "Method not allowed", 405);
  } catch (e) {
    if (e instanceof TenancyError) {
      return errResponse(e.code, e.message, STATUS_BY_CODE[e.code]);
    }
    throw e;
  }
}
