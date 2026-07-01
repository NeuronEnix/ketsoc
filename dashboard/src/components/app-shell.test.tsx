import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { AppShell } from "./app-shell";

function renderShell(orgs: unknown[] = [{ id: "org_1", displayName: "Acme", handle: null, role: "owner", createdAt: 1 }]) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  qc.setQueryData(["orgs"], orgs);
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
    expect(screen.getByText("Create your organization")).toBeInTheDocument();
    expect(screen.queryByText("Overview")).toBeNull();
  });
});
