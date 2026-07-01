/**
 * Seeded live event tail. Each event is keyed by a global sequence number
 * derived from time, so as `nowMs` advances new events appear at the head while
 * older ones keep stable content — a classic streaming tail. Deterministic per
 * (environment, mode). Backs the Events screen until the real SessionDO event
 * stream lands in Phase 2.
 */

import { seededOverview, type EnvModeLike } from "./seed.js";

export type EventDirection = "in" | "out";

export interface TailEvent {
  id: string;
  seq: number;
  t: number;
  channel: string;
  name: string;
  user: string;
  bytes: number;
  direction: EventDirection;
}

export interface EventsTail {
  events: TailEvent[];
  ratePerSec: number;
  seeded: boolean;
  updatedAt: number;
}

const CHANNELS = [
  "chat:general",
  "presence:lobby",
  "game:room-42",
  "orders:us-east",
  "notifications",
  "telemetry:ingest",
  "doc:collab-7",
];
const NAMES = [
  "message",
  "publish",
  "subscribe",
  "join",
  "leave",
  "state.update",
  "ack",
  "typing",
];
const DEFAULT_LIMIT = 50;
const HEX = "0123456789abcdef";

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hex(rng: () => number, len: number): string {
  let out = "";
  for (let i = 0; i < len; i++) out += HEX[Math.floor(rng() * 16)];
  return out;
}

function pick<T>(arr: T[], rng: () => number, fallback: T): T {
  return arr[Math.floor(rng() * arr.length)] ?? fallback;
}

/** The steady event rate (events/sec) for an environment — stable over time. */
function ratePerSec(envId: string, mode: EnvModeLike): number {
  const rng = mulberry32(hashString(`${envId}:${mode}:rate`));
  const base = 2 + rng() * 10;
  return mode === "live" ? base : Math.max(0.3, base * 0.05);
}

/** A deterministic, live-advancing tail of the most recent events. */
export function seededEvents(
  envId: string,
  mode: EnvModeLike,
  nowMs: number,
  limit: number = DEFAULT_LIMIT
): EventsTail {
  const rate = ratePerSec(envId, mode);
  const gapMs = 1000 / rate;
  const latestSeq = Math.floor(nowMs / gapMs);
  // Cap the tail by how many events could plausibly exist (mirrors scale).
  const activity = seededOverview(envId, mode, nowMs).msgsOutPerSec;
  const count = Math.max(0, Math.min(limit, activity > 0 ? limit : 0));

  const events: TailEvent[] = [];
  for (let k = 0; k < count; k++) {
    const seq = latestSeq - k;
    if (seq < 0) break;
    const rng = mulberry32(hashString(`${envId}:${mode}:evt:${seq}`));
    const channel = pick(CHANNELS, rng, "notifications");
    const name = pick(NAMES, rng, "message");
    const direction: EventDirection = rng() < 0.55 ? "out" : "in";
    const bytes = 20 + Math.floor(rng() * 4076);
    events.push({
      id: `evt_${hex(rng, 12)}`,
      seq,
      t: Math.round(seq * gapMs),
      channel,
      name,
      user: `usr_${hex(rng, 8)}`,
      bytes,
      direction,
    });
  }

  return {
    events,
    ratePerSec: Math.round(rate * 10) / 10,
    seeded: true,
    updatedAt: nowMs,
  };
}
