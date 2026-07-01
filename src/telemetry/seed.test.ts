import { describe, it, expect } from "vitest";

import { seededOverview } from "./seed";

describe("seededOverview()", () => {
  it("is deterministic for the same (env, mode, time)", () => {
    const a = seededOverview("env_1", "live", 1_700_000_000_000);
    const b = seededOverview("env_1", "live", 1_700_000_000_000);
    expect(a).toEqual(b);
  });

  it("orders latency + RTT percentiles ascending", () => {
    const o = seededOverview("env_x", "live", 1_700_000_000_000);
    expect(o.latencyMs.p50).toBeLessThanOrEqual(o.latencyMs.p95);
    expect(o.latencyMs.p95).toBeLessThanOrEqual(o.latencyMs.p99);
    expect(o.latencyMs.p99).toBeLessThanOrEqual(o.latencyMs.p999);
    expect(o.rttMs.p50).toBeLessThanOrEqual(o.rttMs.p95);
    expect(o.rttMs.p95).toBeLessThanOrEqual(o.rttMs.p99);
  });

  it("scales test mode well below live mode", () => {
    const live = seededOverview("env_1", "live", 1_700_000_000_000);
    const test = seededOverview("env_1", "test", 1_700_000_000_000);
    expect(test.connections).toBeLessThan(live.connections);
  });

  it("covers all regions and roughly sums to total connections", () => {
    const o = seededOverview("env_1", "live", 1_700_000_000_000);
    expect(o.byRegion).toHaveLength(7);
    const sum = o.byRegion.reduce((a, r) => a + r.connections, 0);
    expect(Math.abs(sum - o.connections)).toBeLessThanOrEqual(
      o.byRegion.length
    );
    expect(o.connections).toBeGreaterThanOrEqual(0);
    expect(o.seeded).toBe(true);
  });

  it("changes over time (live feel)", () => {
    const a = seededOverview("env_1", "live", 1_700_000_000_000);
    const b = seededOverview("env_1", "live", 1_700_000_090_000);
    expect(a.connections).not.toBe(b.connections);
  });
});
