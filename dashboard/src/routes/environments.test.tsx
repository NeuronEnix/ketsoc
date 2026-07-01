import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { EnvironmentsRoute } from "./environments";
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
    [
      { id: "env_prod", name: "prod", mode: "live", isPermanent: true, createdAt: 1 },
      { id: "env_stag", name: "stag", mode: "test", isPermanent: false, createdAt: 2 },
    ]
  );
  render(
    <QueryClientProvider client={qc}>
      <CurrentOrgProvider>
        <EnvironmentsRoute />
      </CurrentOrgProvider>
    </QueryClientProvider>
  );
}

describe("EnvironmentsRoute", () => {
  it("lists envs with mode badges", () => {
    renderScreen();
    expect(screen.getAllByText("prod").length).toBeGreaterThan(0);
    expect(screen.getByText("live")).toBeInTheDocument();
    expect(screen.getByText("stag")).toBeInTheDocument();
    expect(screen.getByText("test mode")).toBeInTheDocument();
  });

  it("enables Create only for a valid 4-letter name", () => {
    renderScreen();
    const btn = screen.getByRole("button", { name: "Create" });
    expect(btn).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Environment name"), {
      target: { value: "stag" },
    });
    expect(btn).not.toBeDisabled();
    fireEvent.change(screen.getByLabelText("Environment name"), {
      target: { value: "ab" },
    });
    expect(btn).toBeDisabled();
  });

  it("shows a delete button only for non-prod envs", () => {
    renderScreen();
    expect(screen.getByLabelText("Delete stag")).toBeInTheDocument();
    expect(screen.queryByLabelText("Delete prod")).toBeNull();
  });
});
