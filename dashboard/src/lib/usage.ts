import { useQuery } from "@tanstack/react-query";

import { api } from "./api";

export type UsageUnit = "count" | "bytes" | "minutes";

export interface UsageMetric {
  key: string;
  label: string;
  used: number;
  quota: number;
  unit: UsageUnit;
}

export interface UsageSummary {
  plan: string;
  periodStartMs: number;
  periodEndMs: number;
  metrics: UsageMetric[];
  seeded: boolean;
  updatedAt: number;
}

export function useUsage(orgId: string | null, envId: string | null) {
  return useQuery<UsageSummary>({
    queryKey: ["usage", orgId, envId],
    queryFn: () =>
      api.get<UsageSummary>(`/api/orgs/${orgId}/envs/${envId}/usage`),
    enabled: orgId !== null && envId !== null,
    refetchInterval: 15000,
  });
}
