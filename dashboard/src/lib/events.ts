import { useQuery } from "@tanstack/react-query";

import { api } from "./api";

export interface TailEvent {
  id: string;
  seq: number;
  t: number;
  channel: string;
  name: string;
  user: string;
  bytes: number;
  direction: "in" | "out";
}

export interface EventsTail {
  events: TailEvent[];
  ratePerSec: number;
  seeded: boolean;
  updatedAt: number;
}

export function useEvents(orgId: string | null, envId: string | null) {
  return useQuery<EventsTail>({
    queryKey: ["events", orgId, envId],
    queryFn: () =>
      api.get<EventsTail>(`/api/orgs/${orgId}/envs/${envId}/events`),
    enabled: orgId !== null && envId !== null,
    refetchInterval: 3000,
  });
}
