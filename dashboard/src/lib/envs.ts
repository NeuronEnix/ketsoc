import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "./api";

export interface Environment {
  id: string;
  name: string;
  mode: "live" | "test";
  isPermanent: boolean;
  createdAt: number;
}

export function useEnvs(orgId: string | null) {
  return useQuery<Environment[]>({
    queryKey: ["envs", orgId],
    queryFn: () => api.get<Environment[]>(`/api/orgs/${orgId}/envs`),
    enabled: orgId !== null,
  });
}

export function useCreateEnv(orgId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      api.post<Environment>(`/api/orgs/${orgId}/envs`, { name }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["envs", orgId] }),
  });
}

export function useDeleteEnv(orgId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (envId: string) =>
      api.del(`/api/orgs/${orgId}/envs/${envId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["envs", orgId] }),
  });
}
