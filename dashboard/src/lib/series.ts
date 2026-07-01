import { useQuery } from "@tanstack/react-query";

import { api } from "./api";

export type SeriesRange = "1h" | "24h" | "7d";

export interface SeriesPoint {
  t: number;
  connections: number;
  msgsIn: number;
  msgsOut: number;
  p50: number;
  p95: number;
  p99: number;
}

export interface MetricsSeries {
  range: SeriesRange;
  stepMs: number;
  points: SeriesPoint[];
  seeded: boolean;
  updatedAt: number;
}

export function useSeries(
  orgId: string | null,
  envId: string | null,
  range: SeriesRange
) {
  return useQuery<MetricsSeries>({
    queryKey: ["series", orgId, envId, range],
    queryFn: () =>
      api.get<MetricsSeries>(
        `/api/orgs/${orgId}/envs/${envId}/metrics/series?range=${range}`
      ),
    enabled: orgId !== null && envId !== null,
    refetchInterval: 5000,
  });
}
