import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { AppShell } from "./app-shell";

const PROD = { id: "env_prod", name: "prod", mode: "live", isPermanent: true, createdAt: 1 };
const TEST = { id: "env_test", name: "test", mode: "test", isPermanent: false, createdAt: 2 };

function renderShell(
  orgs: unknown[] = [{ id: "org_1", displayName: "Acme", handle: null, role: "owner", createdAt: 1 }],
  envs: unknown[] = [PROD, TEST]
) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  qc.setQueryData(["orgs"], orgs);
  qc.setQueryData(["envs", "org_1"], envs);
  qc.setQueryData(["me"], {
    id: "usr_1",
    email: "a@b.com",
    displayName: null,
    createdAt: 1,
  });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <AppShell />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("AppShell", () => {
  it("renders the product nav and the current org", () => {
    renderShell();
    expect(screen.getByText("Overview")).toBeInTheDocument();
    expect(screen.getByText("Connections")).toBeInTheDocument();
    expect(screen.getByText("Environments")).toBeInTheDocument();
    expect(screen.getByText("API Keys")).toBeInTheDocument();
    expect(screen.getByText("Acme")).toBeInTheDocument();
  });

  it("shows the coming-soon products", () => {
    renderShell();
    expect(screen.getByText("Live Objects")).toBeInTheDocument();
    expect(screen.getByText("Streaming")).toBeInTheDocument();
  });

  it("shows onboarding instead of the shell when the user has no orgs", () => {
    renderShell([]);
    expect(screen.getByText("Setting up your workspace…")).toBeInTheDocument();
    expect(screen.queryByText("Overview")).toBeNull();
  });

  it("defaults the env switcher to prod (live, no TEST MODE badge)", () => {
    renderShell();
    expect(screen.getByText("prod")).toBeInTheDocument();
    expect(screen.queryByText("Test Mode")).toBeNull();
  });

  it("flags TEST MODE when the active env is test-mode", () => {
    renderShell(undefined, [TEST]);
    expect(screen.getByText("Test Mode")).toBeInTheDocument();
  });
});
