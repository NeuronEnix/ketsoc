import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { OverviewRoute } from "./overview";
import { CurrentOrgProvider } from "@/lib/current-org";

function renderScreen() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  qc.setQueryData(
    ["orgs"],
    [{ id: "org_1", displayName: "Acme", handle: null, role: "owner", createdAt: 1 }]
  );
  qc.setQueryData(
    ["envs", "org_1"],
    [{ id: "env_prod", name: "prod", mode: "live", isPermanent: true, createdAt: 1 }]
  );
  qc.setQueryData(["overview", "org_1", "env_prod"], {
    connections: 12480,
    connectionsPeak: 16000,
    msgsInPerSec: 4000,
    msgsOutPerSec: 8000,
    activeUsers: 9000,
    latencyMs: { p50: 12, p95: 30, p99: 55, p999: 88 },
    rttMs: { p50: 24, p95: 60, p99: 90 },
    errorsPerMin: 1.2,
    byRegion: [
      { region: "iad", connections: 5000 },
      { region: "sjc", connections: 3000 },
    ],
    seeded: true,
    updatedAt: 1,
  });
  render(
    <QueryClientProvider client={qc}>
      <CurrentOrgProvider>
        <OverviewRoute />
      </CurrentOrgProvider>
    </QueryClientProvider>
  );
}

describe("OverviewRoute", () => {
  it("renders live metrics for the default (prod) env", () => {
    renderScreen();
    expect(screen.getByText("Connections")).toBeInTheDocument();
    expect(screen.getByText("12,480")).toBeInTheDocument();
    expect(screen.getByText("p99.9 tail")).toBeInTheDocument();
    expect(screen.getByText("88")).toBeInTheDocument();
    expect(screen.getByText("iad")).toBeInTheDocument();
  });
});
