import { describe, it, expect } from "vitest";

import { seededConnections } from "./connections";

describe("seededConnections()", () => {
  it("is deterministic for the same (env, mode, time)", () => {
    const a = seededConnections("env_1", "live", 1_700_000_000_000);
    const b = seededConnections("env_1", "live", 1_700_000_000_000);
    expect(a).toEqual(b);
  });

  it("keeps stable row identities but ticks age/msgs upward over time", () => {
    const t0 = seededConnections("env_1", "live", 1_700_000_000_000);
    const t1 = seededConnections("env_1", "live", 1_700_000_030_000);
    expect(t1.connections[0]?.id).toBe(t0.connections[0]?.id);
    expect(t1.connections[0]?.region).toBe(t0.connections[0]?.region);
    expect(t1.connections[0]!.connectedForSec).toBeGreaterThan(
      t0.connections[0]!.connectedForSec
    );
    expect(t1.connections[0]!.msgs).toBeGreaterThanOrEqual(
      t0.connections[0]!.msgs
    );
  });

  it("samples at most `limit` rows and reports the true total", () => {
    const page = seededConnections("env_1", "live", 1_700_000_000_000, 10);
    expect(page.connections.length).toBeLessThanOrEqual(10);
    expect(page.sampled).toBe(page.connections.length);
    expect(page.total).toBeGreaterThanOrEqual(page.sampled);
    expect(page.seeded).toBe(true);
  });

  it("emits valid regions and transports", () => {
    const page = seededConnections("env_x", "live", 1_700_000_000_000);
    for (const c of page.connections) {
      expect(["websocket", "sse"]).toContain(c.transport);
      expect(c.region).toMatch(/^[a-z]{3}$/);
      expect(c.id).toMatch(/^conn_[0-9a-f]{12}$/);
      expect(c.connectedForSec).toBeGreaterThan(0);
    }
  });

  it("shows far fewer connections in test mode than live", () => {
    const live = seededConnections("env_1", "live", 1_700_000_000_000);
    const test = seededConnections("env_1", "test", 1_700_000_000_000);
    expect(test.total).toBeLessThan(live.total);
  });
});
