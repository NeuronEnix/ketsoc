import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "./api";

export type ApiKeyType = "public" | "secret";

export interface ApiKey {
  id: string;
  envId: string;
  type: ApiKeyType;
  label: string | null;
  keyPrefix: string;
  lastUsedAt: number | null;
  revokedAt: number | null;
  createdAt: number;
}

/** Create response includes the full key (revealed once). */
export interface CreatedKey extends ApiKey {
  key: string;
}

function keysPath(orgId: string | null, envId: string | null): string {
  return `/api/orgs/${orgId}/envs/${envId}/keys`;
}

export function useKeys(orgId: string | null, envId: string | null) {
  return useQuery<ApiKey[]>({
    queryKey: ["keys", orgId, envId],
    queryFn: () => api.get<ApiKey[]>(keysPath(orgId, envId)),
    enabled: orgId !== null && envId !== null,
  });
}

export function useCreateKey(orgId: string | null, envId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { type: ApiKeyType; label: string | null }) =>
      api.post<CreatedKey>(keysPath(orgId, envId), input),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["keys", orgId, envId] }),
  });
}

export function useRevokeKey(orgId: string | null, envId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (keyId: string) =>
      api.del(`${keysPath(orgId, envId)}/${keyId}`),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["keys", orgId, envId] }),
  });
}
