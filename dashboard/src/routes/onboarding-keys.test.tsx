import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
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

function renderFlow() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity },
      mutations: { retry: false },
    },
  });
  render(
    <QueryClientProvider client={qc}>
      <OnboardingScreen />
    </QueryClientProvider>
  );
}

describe("Onboarding key-reveal flow", () => {
  beforeEach(() => {
    get.mockReset();
    post.mockReset();
  });

  it("auto-creates the org, then reveals prod publishable + secret keys", async () => {
    get.mockImplementation(async (path: string) =>
      path.endsWith("/envs")
        ? [
            { id: "env_prod", name: "prod", mode: "live", isPermanent: true, createdAt: 1 },
            { id: "env_test", name: "test", mode: "test", isPermanent: false, createdAt: 2 },
          ]
        : []
    );
    post.mockImplementation(async (path: string, body: { type?: string; displayName?: string }) => {
      if (path === "/api/orgs") {
        return { id: "org_1", displayName: body.displayName, handle: null, role: "owner", createdAt: 1 };
      }
      // key creation
      const type = body.type ?? "public";
      return {
        id: `key_${type}`,
        envId: "env_prod",
        type,
        label: "Default",
        keyPrefix: type === "secret" ? "ksk.prod.abcd" : "kpk.prod.abcd",
        key: type === "secret" ? "ksk.prod.abcd.SECRETVALUE" : "kpk.prod.abcd.PUBVALUE",
        lastUsedAt: null,
        revokedAt: null,
        createdAt: 1,
      };
    });

    renderFlow();

    // Goes straight to the key-reveal step — no org-name form.
    await waitFor(() =>
      expect(screen.getByText("Your API keys")).toBeInTheDocument()
    );

    // Both keys are generated and revealed.
    await waitFor(() =>
      expect(screen.getByText("kpk.prod.abcd.PUBVALUE")).toBeInTheDocument()
    );
    expect(screen.getByText("ksk.prod.abcd.SECRETVALUE")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Continue to dashboard" })
    ).toBeInTheDocument();

    // Points at the Settings rename instead of asking for a name upfront.
    expect(screen.getByText(/rename\s*it any time in/i)).toBeInTheDocument();

    // Org was auto-created and two keys were minted (publishable + secret).
    expect(post).toHaveBeenCalledWith("/api/orgs", { displayName: "Personal" });
    const keyCalls = post.mock.calls.filter(([p]) => p.endsWith("/keys"));
    expect(keyCalls).toHaveLength(2);
  });
});
