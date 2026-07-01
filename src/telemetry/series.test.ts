import { describe, it, expect } from "vitest";

import { seededSeries, isSeriesRange } from "./series";

describe("seededSeries()", () => {
  it("is deterministic for the same (env, mode, time, range)", () => {
    const a = seededSeries("env_1", "live", 1_700_000_000_000, "1h");
    const b = seededSeries("env_1", "live", 1_700_000_000_000, "1h");
    expect(a).toEqual(b);
  });

  it("returns 60 points with step matching the range", () => {
    const s = seededSeries("env_1", "live", 1_700_000_000_000, "24h");
    expect(s.points).toHaveLength(60);
    expect(s.stepMs).toBe(1_440_000);
    // last point is at nowMs, points are step apart and ascending in time
    expect(s.points[59]!.t).toBe(1_700_000_000_000);
    expect(s.points[1]!.t - s.points[0]!.t).toBe(1_440_000);
  });

  it("keeps latency percentiles ordered at every point", () => {
    const s = seededSeries("env_x", "live", 1_700_000_000_000, "1h");
    for (const p of s.points) {
      expect(p.p50).toBeLessThanOrEqual(p.p95);
      expect(p.p95).toBeLessThanOrEqual(p.p99);
      expect(p.connections).toBeGreaterThanOrEqual(0);
    }
  });

  it("slides over time (newest point changes, older points shift in)", () => {
    const a = seededSeries("env_1", "live", 1_700_000_000_000, "1h");
    const b = seededSeries("env_1", "live", 1_700_000_060_000, "1h");
    // advancing by one step: b's second-to-last equals a's last (shifted)
    expect(b.points[58]!.t).toBe(a.points[59]!.t);
    expect(b.points[58]!.connections).toBe(a.points[59]!.connections);
    expect(b.points[59]!.t).not.toBe(a.points[59]!.t);
  });

  it("scales test mode well below live", () => {
    const live = seededSeries("env_1", "live", 1_700_000_000_000, "1h");
    const test = seededSeries("env_1", "test", 1_700_000_000_000, "1h");
    const avg = (arr: number[]) => arr.reduce((x, y) => x + y, 0) / arr.length;
    expect(avg(test.points.map((p) => p.connections))).toBeLessThan(
      avg(live.points.map((p) => p.connections))
    );
  });

  it("validates range strings", () => {
    expect(isSeriesRange("1h")).toBe(true);
    expect(isSeriesRange("7d")).toBe(true);
    expect(isSeriesRange("99y")).toBe(false);
  });
});
