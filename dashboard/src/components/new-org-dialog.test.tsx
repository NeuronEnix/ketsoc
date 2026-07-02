import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { NewOrgDialog } from "./app-shell";
import { CurrentOrgProvider } from "@/lib/current-org";

function renderDialog(onClose = vi.fn()) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  qc.setQueryData(
    ["orgs"],
    [{ id: "org_1", displayName: "Acme", handle: null, role: "owner", createdAt: 1 }]
  );
  render(
    <QueryClientProvider client={qc}>
      <CurrentOrgProvider>
        <NewOrgDialog onClose={onClose} />
      </CurrentOrgProvider>
    </QueryClientProvider>
  );
  return onClose;
}

describe("NewOrgDialog a11y", () => {
  it("is an accessible modal dialog labelled by its title", () => {
    renderDialog();
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby", "new-org-title");
    expect(screen.getByText("New organization").id).toBe("new-org-title");
    expect(screen.getByLabelText("Organization name")).toBeInTheDocument();
  });

  it("closes on Escape", () => {
    const onClose = renderDialog();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});
