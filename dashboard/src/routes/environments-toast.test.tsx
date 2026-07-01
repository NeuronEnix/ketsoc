import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { EnvironmentsRoute } from "./environments";
import { CurrentOrgProvider } from "@/lib/current-org";

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (m: string) => toastSuccess(m),
    error: (m: string) => toastError(m),
  },
}));

const post = vi.fn();
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    api: {
      get: vi.fn(async () => []),
      post: (path: string, body: unknown) => post(path, body),
      patch: vi.fn(),
      del: vi.fn(),
    },
  };
});

function renderScreen() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  qc.setQueryData(
    ["orgs"],
    [{ id: "org_1", displayName: "Acme", handle: null, role: "owner", createdAt: 1 }]
  );
  qc.setQueryData(["envs", "org_1"], []);
  render(
    <QueryClientProvider client={qc}>
      <CurrentOrgProvider>
        <EnvironmentsRoute />
      </CurrentOrgProvider>
    </QueryClientProvider>
  );
}

describe("EnvironmentsRoute toasts", () => {
  beforeEach(() => {
    toastSuccess.mockClear();
    toastError.mockClear();
    post.mockReset();
  });

  it("fires a success toast when an environment is created", async () => {
    post.mockResolvedValue({
      id: "env_new",
      name: "stag",
      mode: "test",
      isPermanent: false,
      createdAt: 2,
    });
    renderScreen();
    fireEvent.change(screen.getByLabelText("Environment name"), {
      target: { value: "stag" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith("Environment stag created")
    );
  });

  it("fires an error toast when creation fails", async () => {
    const { ApiError } = await import("@/lib/api");
    post.mockRejectedValue(new ApiError("NAME_TAKEN", "taken", 409));
    renderScreen();
    fireEvent.change(screen.getByLabelText("Environment name"), {
      target: { value: "stag" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("That name is already taken.")
    );
  });
});
