import { useQuery } from "@tanstack/react-query";

import { api } from "./api";

export interface MetricsOverview {
  connections: number;
  connectionsPeak: number;
  msgsInPerSec: number;
  msgsOutPerSec: number;
  activeUsers: number;
  latencyMs: { p50: number; p95: number; p99: number; p999: number };
  rttMs: { p50: number; p95: number; p99: number };
  errorsPerMin: number;
  byRegion: { region: string; connections: number }[];
  seeded: boolean;
  updatedAt: number;
}

export function useOverview(orgId: string | null, envId: string | null) {
  return useQuery<MetricsOverview>({
    queryKey: ["overview", orgId, envId],
    queryFn: () =>
      api.get<MetricsOverview>(
        `/api/orgs/${orgId}/envs/${envId}/metrics/overview`
      ),
    enabled: orgId !== null && envId !== null,
    refetchInterval: 3000,
  });
}
