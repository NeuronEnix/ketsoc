import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { UsageRoute } from "./usage";
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
  qc.setQueryData(["usage", "org_1", "env_prod"], {
    plan: "Scale",
    periodStartMs: Date.UTC(2026, 6, 1),
    periodEndMs: Date.UTC(2026, 7, 1),
    seeded: true,
    updatedAt: 1,
    metrics: [
      { key: "messages", label: "Messages", used: 12_400_000, quota: 50_000_000, unit: "count" },
      { key: "dataTransfer", label: "Data transfer", used: 128 * 1024 * 1024 * 1024, quota: 500 * 1024 * 1024 * 1024, unit: "bytes" },
    ],
  });
  render(
    <QueryClientProvider client={qc}>
      <CurrentOrgProvider>
        <CurrentEnvProvider>
          <UsageRoute />
        </CurrentEnvProvider>
      </CurrentOrgProvider>
    </QueryClientProvider>
  );
}

describe("UsageRoute", () => {
  it("renders the plan, period, and quota bars with formatted values", () => {
    renderScreen();
    expect(screen.getByText("Usage")).toBeInTheDocument();
    expect(screen.getByText("Scale")).toBeInTheDocument();
    expect(screen.getByText("July 2026")).toBeInTheDocument();
    expect(screen.getByText("Messages")).toBeInTheDocument();
    expect(screen.getByText("12.4M")).toBeInTheDocument();
    expect(screen.getByText("128.0 GiB")).toBeInTheDocument();
  });
});
