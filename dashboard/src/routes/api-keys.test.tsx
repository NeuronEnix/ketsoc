import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ApiKeysRoute } from "./api-keys";
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
  qc.setQueryData(
    ["keys", "org_1", "env_prod"],
    [
      {
        id: "kid1",
        envId: "env_prod",
        type: "secret",
        label: "server",
        keyPrefix: "ksk.abc123.kid1.",
        lastUsedAt: null,
        revokedAt: null,
        createdAt: 1,
      },
      {
        id: "kid2",
        envId: "env_prod",
        type: "public",
        label: null,
        keyPrefix: "kpk.abc123.kid2.",
        lastUsedAt: null,
        revokedAt: null,
        createdAt: 2,
      },
    ]
  );
  render(
    <QueryClientProvider client={qc}>
      <CurrentOrgProvider>
        <ApiKeysRoute />
      </CurrentOrgProvider>
    </QueryClientProvider>
  );
}

describe("ApiKeysRoute", () => {
  it("shows the env tab and lists keys with kpk/ksk badges", () => {
    renderScreen();
    expect(screen.getByRole("button", { name: "prod" })).toBeInTheDocument();
    // "ksk"/"kpk" appear in the intro copy, the badges, and the prefixes.
    expect(screen.getAllByText("ksk").length).toBeGreaterThan(0);
    expect(screen.getAllByText("kpk").length).toBeGreaterThan(0);
    expect(screen.getByText("server")).toBeInTheDocument();
  });

  it("offers public + secret key creation and a revoke per key", () => {
    renderScreen();
    expect(
      screen.getByRole("button", { name: "Public key" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Secret key" })
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Revoke ksk.abc123.kid1.")
    ).toBeInTheDocument();
  });
});
