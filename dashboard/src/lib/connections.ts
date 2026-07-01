import { useQuery } from "@tanstack/react-query";

import { api } from "./api";

export interface ConnectionRow {
  id: string;
  user: string;
  region: string;
  transport: "websocket" | "sse";
  connectedForSec: number;
  msgs: number;
  lastSeenSec: number;
}

export interface ConnectionsPage {
  total: number;
  sampled: number;
  connections: ConnectionRow[];
  seeded: boolean;
  updatedAt: number;
}

export function useConnections(orgId: string | null, envId: string | null) {
  return useQuery<ConnectionsPage>({
    queryKey: ["connections", orgId, envId],
    queryFn: () =>
      api.get<ConnectionsPage>(
        `/api/orgs/${orgId}/envs/${envId}/connections`
      ),
    enabled: orgId !== null && envId !== null,
    refetchInterval: 4000,
  });
}
