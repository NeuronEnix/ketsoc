import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { OnboardingScreen } from "./onboarding";

const get = vi.fn();
const post = vi.fn();
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    api: {
      get: (path: string) => get(path),
      post: (path: string, body: unknown) => post(path, body),
      patch: vi.fn(),
      del: vi.fn(),
    },
  };
});

function renderScreen() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={qc}>
      <OnboardingScreen />
    </QueryClientProvider>
  );
}

describe("OnboardingScreen", () => {
  beforeEach(() => {
    get.mockReset();
    post.mockReset();
  });

  it("auto-creates a default org on mount — no name form", async () => {
    get.mockResolvedValue([]);
    post.mockResolvedValue({
      id: "org_1",
      displayName: "Personal",
      handle: null,
      role: "owner",
      createdAt: 1,
    });

    renderScreen();

    expect(screen.queryByLabelText("Organization name")).toBeNull();
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith("/api/orgs", {
        displayName: "Personal",
      })
    );
    expect(post).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(screen.getByText("Your API keys")).toBeInTheDocument()
    );
  });

  it("shows an error with a retry button when org creation fails", async () => {
    get.mockResolvedValue([]);
    post.mockRejectedValueOnce(new Error("boom")).mockResolvedValue({
      id: "org_1",
      displayName: "Personal",
      handle: null,
      role: "owner",
      createdAt: 1,
    });

    renderScreen();

    await waitFor(() =>
      expect(
        screen.getByText("Couldn't set up your workspace")
      ).toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() =>
      expect(screen.getByText("Your API keys")).toBeInTheDocument()
    );
  });
});
