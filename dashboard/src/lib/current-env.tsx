import { createContext, useContext, useState, type ReactNode } from "react";

import { useCurrentOrg } from "./current-org";
import { useEnvs, type Environment } from "./envs";

interface CurrentEnvValue {
  envs: Environment[];
  isLoading: boolean;
  current: Environment | null;
  select: (id: string) => void;
}

const CurrentEnvContext = createContext<CurrentEnvValue | null>(null);

/** Pick the default env for an org: prefer `prod`, else the first one. */
function defaultEnv(envs: Environment[]): Environment | null {
  return envs.find((e) => e.name === "prod") ?? envs[0] ?? null;
}

export function CurrentEnvProvider({ children }: { children: ReactNode }) {
  const { current: org } = useCurrentOrg();
  const orgId = org?.id ?? null;
  const { data: envs = [], isLoading } = useEnvs(orgId);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // A selection from a previously-active org won't match this org's envs, so
  // fall back to prod/first — no explicit reset needed on org switch.
  const current =
    envs.find((e) => e.id === selectedId) ?? defaultEnv(envs);

  return (
    <CurrentEnvContext.Provider
      value={{ envs, isLoading, current, select: setSelectedId }}
    >
      {children}
    </CurrentEnvContext.Provider>
  );
}

export function useCurrentEnv(): CurrentEnvValue {
  const ctx = useContext(CurrentEnvContext);
  if (!ctx) {
    throw new Error("useCurrentEnv must be used within CurrentEnvProvider");
  }
  return ctx;
}
