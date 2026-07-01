import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { MetricsRoute } from "./metrics";
import { CurrentOrgProvider } from "@/lib/current-org";
import { CurrentEnvProvider } from "@/lib/current-env";

function points() {
  return Array.from({ length: 60 }, (_, i) => ({
    t: i * 60_000,
    connections: 1000 + i * 10,
    msgsIn: 500 + i,
    msgsOut: 900 + i,
    p50: 12,
    p95: 30,
    p99: 55,
  }));
}

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
  qc.setQueryData(["series", "org_1", "env_prod", "1h"], {
    range: "1h",
    stepMs: 60_000,
    points: points(),
    seeded: true,
    updatedAt: 1,
  });
  render(
    <QueryClientProvider client={qc}>
      <CurrentOrgProvider>
        <CurrentEnvProvider>
          <MetricsRoute />
        </CurrentEnvProvider>
      </CurrentOrgProvider>
    </QueryClientProvider>
  );
}

describe("MetricsRoute", () => {
  it("renders the chart cards and range selector", () => {
    renderScreen();
    expect(screen.getByText("Metrics")).toBeInTheDocument();
    expect(screen.getByText("Connections")).toBeInTheDocument();
    expect(screen.getByText("Throughput / sec")).toBeInTheDocument();
    expect(screen.getByText("Latency (ms)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1h" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "7d" })).toBeInTheDocument();
  });

  it("switches range on click without crashing", () => {
    renderScreen();
    fireEvent.click(screen.getByRole("button", { name: "24h" }));
    // still renders the chart headings after switching range
    expect(screen.getByText("Connections")).toBeInTheDocument();
  });
});
