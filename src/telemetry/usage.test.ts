import { describe, it, expect } from "vitest";

import { seededUsage } from "./usage";

// 2026-07-15 UTC — mid-month.
const MID_JULY = Date.UTC(2026, 6, 15, 12, 0, 0);

describe("seededUsage()", () => {
  it("is deterministic for the same (env, mode, time)", () => {
    const a = seededUsage("env_1", "live", MID_JULY);
    const b = seededUsage("env_1", "live", MID_JULY);
    expect(a).toEqual(b);
  });

  it("keeps every metric's usage within its quota", () => {
    const s = seededUsage("env_1", "live", MID_JULY);
    expect(s.metrics.length).toBe(4);
    for (const m of s.metrics) {
      expect(m.used).toBeGreaterThanOrEqual(0);
      expect(m.used).toBeLessThanOrEqual(m.quota);
    }
    expect(s.seeded).toBe(true);
  });

  it("gives live envs larger quotas than test envs", () => {
    const live = seededUsage("env_1", "live", MID_JULY);
    const test = seededUsage("env_1", "test", MID_JULY);
    const q = (s: typeof live, key: string) =>
      s.metrics.find((m) => m.key === key)!.quota;
    expect(q(live, "messages")).toBeGreaterThan(q(test, "messages"));
    expect(live.plan).not.toBe(test.plan);
  });

  it("accumulates more usage later in the month for accumulating metrics", () => {
    const early = seededUsage("env_1", "live", Date.UTC(2026, 6, 2, 0, 0, 0));
    const late = seededUsage("env_1", "live", Date.UTC(2026, 6, 28, 0, 0, 0));
    const used = (s: typeof early, key: string) =>
      s.metrics.find((m) => m.key === key)!.used;
    expect(used(late, "messages")).toBeGreaterThan(used(early, "messages"));
  });

  it("reports the current UTC month as the billing period", () => {
    const s = seededUsage("env_1", "live", MID_JULY);
    expect(s.periodStartMs).toBe(Date.UTC(2026, 6, 1));
    expect(s.periodEndMs).toBe(Date.UTC(2026, 7, 1));
  });
});
