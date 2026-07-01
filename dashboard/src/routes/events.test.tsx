import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { EventsRoute } from "./events";
import { CurrentOrgProvider } from "@/lib/current-org";
import { CurrentEnvProvider } from "@/lib/current-env";

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
    [{ id: "env_prod", name: "prod", mode: "live", isPermanent: true, createdAt: 1 }]
  );
  qc.setQueryData(["events", "org_1", "env_prod"], {
    ratePerSec: 7.4,
    seeded: true,
    updatedAt: 1,
    events: [
      {
        id: "evt_aaaaaaaaaaaa",
        seq: 100,
        t: 1_700_000_000_000,
        channel: "chat:general",
        name: "message",
        user: "usr_deadbeef",
        bytes: 2048,
        direction: "out",
      },
      {
        id: "evt_bbbbbbbbbbbb",
        seq: 99,
        t: 1_699_999_999_000,
        channel: "presence:lobby",
        name: "join",
        user: "usr_cafef00d",
        bytes: 96,
        direction: "in",
      },
    ],
  });
  render(
    <QueryClientProvider client={qc}>
      <CurrentOrgProvider>
        <CurrentEnvProvider>
          <EventsRoute />
        </CurrentEnvProvider>
      </CurrentOrgProvider>
    </QueryClientProvider>
  );
}

describe("EventsRoute", () => {
  it("renders the tail with channels, event names, and rate", () => {
    renderScreen();
    expect(screen.getByText("Events")).toBeInTheDocument();
    expect(screen.getByText("chat:general")).toBeInTheDocument();
    expect(screen.getByText("presence:lobby")).toBeInTheDocument();
    expect(screen.getByText("message")).toBeInTheDocument();
    expect(screen.getByText("join")).toBeInTheDocument();
    expect(screen.getByText("7.4")).toBeInTheDocument();
    // 2048 bytes → 2.0 KB
    expect(screen.getByText("2.0 KB")).toBeInTheDocument();
  });
});
