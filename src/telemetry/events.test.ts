import { describe, it, expect } from "vitest";

import { seededEvents } from "./events";

describe("seededEvents()", () => {
  it("is deterministic for the same (env, mode, time)", () => {
    const a = seededEvents("env_1", "live", 1_700_000_000_000);
    const b = seededEvents("env_1", "live", 1_700_000_000_000);
    expect(a).toEqual(b);
  });

  it("returns events newest-first with descending seq and timestamps", () => {
    const tail = seededEvents("env_1", "live", 1_700_000_000_000);
    expect(tail.events.length).toBeGreaterThan(0);
    for (let i = 1; i < tail.events.length; i++) {
      expect(tail.events[i]!.seq).toBeLessThan(tail.events[i - 1]!.seq);
      expect(tail.events[i]!.t).toBeLessThanOrEqual(tail.events[i - 1]!.t);
    }
  });

  it("advances like a tail: newer call reveals new head events, old ones stable", () => {
    const t0 = seededEvents("env_1", "live", 1_700_000_000_000);
    const t1 = seededEvents("env_1", "live", 1_700_000_005_000);
    // the head advanced
    expect(t1.events[0]!.seq).toBeGreaterThan(t0.events[0]!.seq);
    // an event present in both keeps identical content (keyed by seq)
    const shared = t0.events.find((e) =>
      t1.events.some((x) => x.seq === e.seq)
    );
    expect(shared).toBeDefined();
    const inT1 = t1.events.find((x) => x.seq === shared!.seq);
    expect(inT1).toEqual(shared);
  });

  it("emits valid shapes", () => {
    const tail = seededEvents("env_x", "live", 1_700_000_000_000);
    for (const e of tail.events) {
      expect(e.id).toMatch(/^evt_[0-9a-f]{12}$/);
      expect(["in", "out"]).toContain(e.direction);
      expect(e.bytes).toBeGreaterThanOrEqual(20);
      expect(e.channel.length).toBeGreaterThan(0);
    }
  });

  it("streams slower in test mode than live", () => {
    const live = seededEvents("env_1", "live", 1_700_000_000_000);
    const test = seededEvents("env_1", "test", 1_700_000_000_000);
    expect(test.ratePerSec).toBeLessThan(live.ratePerSec);
  });
});
