import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { SettingsRoute } from "./settings";
import { CurrentOrgProvider } from "@/lib/current-org";

function renderScreen(role: "owner" | "member" = "owner") {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  qc.setQueryData(
    ["orgs"],
    [{ id: "org_1", displayName: "Acme", handle: null, role, createdAt: 1 }]
  );
  qc.setQueryData(["me"], {
    id: "usr_1",
    email: "founder@ketsoc.dev",
    displayName: null,
    createdAt: 1,
  });
  render(
    <QueryClientProvider client={qc}>
      <CurrentOrgProvider>
        <SettingsRoute />
      </CurrentOrgProvider>
    </QueryClientProvider>
  );
}

describe("SettingsRoute", () => {
  it("shows org name, account email, and sign out for an owner", () => {
    renderScreen("owner");
    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(screen.getByLabelText("Display name")).toHaveValue("Acme");
    expect(screen.getByText("founder@ketsoc.dev")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
    // Save disabled until the name changes
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("disables renaming for members", () => {
    renderScreen("member");
    expect(screen.getByLabelText("Display name")).toBeDisabled();
    expect(
      screen.getByText("Only owners can rename the organization.")
    ).toBeInTheDocument();
  });
});
