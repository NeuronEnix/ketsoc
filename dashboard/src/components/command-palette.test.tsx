import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { useState } from "react";

import { CommandPalette } from "./command-palette";

function Harness() {
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  return (
    <>
      <div data-testid="path">{loc.pathname}</div>
      <button onClick={() => setOpen(true)}>open</button>
      <CommandPalette open={open} onOpenChange={setOpen} />
    </>
  );
}

function renderPalette() {
  render(
    <MemoryRouter initialEntries={["/overview"]}>
      <Harness />
    </MemoryRouter>
  );
}

describe("CommandPalette", () => {
  it("opens on ⌘K and lists the screens", async () => {
    renderPalette();
    fireEvent.keyDown(document, { key: "k", metaKey: true });
    await waitFor(() =>
      expect(screen.getByPlaceholderText("Jump to…")).toBeInTheDocument()
    );
    expect(screen.getByText("Metrics")).toBeInTheDocument();
    expect(screen.getByText("API Keys")).toBeInTheDocument();
  });

  it("filters as you type and navigates on select", async () => {
    renderPalette();
    fireEvent.keyDown(document, { key: "k", metaKey: true });
    const input = await screen.findByPlaceholderText("Jump to…");
    fireEvent.change(input, { target: { value: "usage" } });
    await waitFor(() => expect(screen.getByText("Usage")).toBeInTheDocument());
    // Non-matching items are filtered out.
    expect(screen.queryByText("Overview")).toBeNull();
    fireEvent.click(screen.getByText("Usage"));
    await waitFor(() =>
      expect(screen.getByTestId("path")).toHaveTextContent("/usage")
    );
  });
});
