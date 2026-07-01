import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "./api";

export interface Org {
  id: string;
  displayName: string;
  handle: string | null;
  role: "owner" | "member";
  createdAt: number;
}

export function useOrgs() {
  return useQuery<Org[]>({
    queryKey: ["orgs"],
    queryFn: () => api.get<Org[]>("/api/orgs"),
  });
}

/** Create an org (auto-seeds prod + test on the backend) and refresh the list. */
export function useCreateOrg() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (displayName: string) =>
      api.post<Org>("/api/orgs", { displayName }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orgs"] }),
  });
}

/** Rename an org (owner only, enforced server-side) and refresh the list. */
export function useUpdateOrg(orgId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (displayName: string) =>
      api.patch<Org>(`/api/orgs/${orgId}`, { displayName }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orgs"] }),
  });
}
