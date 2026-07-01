import { useQuery } from "@tanstack/react-query";

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
