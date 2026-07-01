import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ConnectionsRoute } from "./connections";
import { CurrentOrgProvider } from "@/lib/current-org";
import { CurrentEnvProvider } from "@/lib/current-env";

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
  qc.setQueryData(["connections", "org_1", "env_prod"], {
    total: 12480,
    sampled: 2,
    connections: [
      {
        id: "conn_abc123abc123",
        user: "usr_deadbeef",
        region: "iad",
        transport: "websocket",
        connectedForSec: 3725,
        msgs: 4200,
        lastSeenSec: 2,
      },
      {
        id: "conn_def456def456",
        user: "usr_cafef00d",
        region: "sjc",
        transport: "sse",
        connectedForSec: 42,
        msgs: 12,
        lastSeenSec: 1,
      },
    ],
    seeded: true,
    updatedAt: 1,
  });
  render(
    <QueryClientProvider client={qc}>
      <CurrentOrgProvider>
        <CurrentEnvProvider>
          <ConnectionsRoute />
        </CurrentEnvProvider>
      </CurrentOrgProvider>
    </QueryClientProvider>
  );
}

describe("ConnectionsRoute", () => {
  it("renders the total, sample size, and connection rows", () => {
    renderScreen();
    expect(screen.getByText("Connections")).toBeInTheDocument();
    expect(screen.getByText("12,480")).toBeInTheDocument();
    expect(screen.getByText("conn_abc123abc123")).toBeInTheDocument();
    expect(screen.getByText("websocket")).toBeInTheDocument();
    expect(screen.getByText("sse")).toBeInTheDocument();
    // 3725s → 1h 2m
    expect(screen.getByText("1h 2m")).toBeInTheDocument();
  });
});
