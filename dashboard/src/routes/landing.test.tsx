import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { LandingRoute } from "./landing";

const me = vi.fn();
vi.mock("@/lib/auth", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth");
  return { ...actual, useMe: () => me() };
});

function renderLanding() {
  render(
    <MemoryRouter>
      <LandingRoute />
    </MemoryRouter>
  );
}

describe("LandingRoute", () => {
  beforeEach(() => {
    me.mockReset();
  });

  it("renders the hero and signup CTAs for signed-out visitors", () => {
    me.mockReturnValue({ data: null });
    renderLanding();

    expect(screen.getByText("Sockets at the edge.")).toBeInTheDocument();
    const ctas = screen.getAllByRole("link", { name: /start building/i });
    expect(ctas.length).toBeGreaterThan(0);
    for (const cta of ctas) {
      expect(cta).toHaveAttribute("href", "/signup");
    }
    expect(
      screen.getAllByRole("link", { name: "Sign in" }).length
    ).toBeGreaterThan(0);
  });

  it("swaps CTAs to the dashboard for signed-in users", () => {
    me.mockReturnValue({
      data: { id: "usr_1", email: "a@b.com", displayName: null, createdAt: 1 },
    });
    renderLanding();

    const open = screen.getAllByRole("link", { name: /open dashboard/i });
    expect(open.length).toBeGreaterThan(0);
    for (const link of open) {
      expect(link).toHaveAttribute("href", "/overview");
    }
    expect(screen.queryByRole("link", { name: /start building/i })).toBeNull();
  });
});
