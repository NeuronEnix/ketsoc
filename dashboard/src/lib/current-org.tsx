import { createContext, useContext, useState, type ReactNode } from "react";

import { useOrgs, type Org } from "./orgs";

interface CurrentOrgValue {
  orgs: Org[];
  isLoading: boolean;
  current: Org | null;
  select: (id: string) => void;
}

const CurrentOrgContext = createContext<CurrentOrgValue | null>(null);

export function CurrentOrgProvider({ children }: { children: ReactNode }) {
  const { data: orgs = [], isLoading } = useOrgs();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const current = orgs.find((o) => o.id === selectedId) ?? orgs[0] ?? null;

  return (
    <CurrentOrgContext.Provider
      value={{ orgs, isLoading, current, select: setSelectedId }}
    >
      {children}
    </CurrentOrgContext.Provider>
  );
}

export function useCurrentOrg(): CurrentOrgValue {
  const ctx = useContext(CurrentOrgContext);
  if (!ctx) {
    throw new Error("useCurrentOrg must be used within CurrentOrgProvider");
  }
  return ctx;
}
