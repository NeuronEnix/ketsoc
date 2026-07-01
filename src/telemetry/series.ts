/**
 * Seeded time-series for the Metrics screen. Deterministic per
 * (environment, mode, range): the shape is a smooth sum-of-sines waveform in
 * absolute time, so the window slides left as `nowMs` advances (a new point
 * appears on the right) while staying stable between polls. Periods scale with
 * the range's step, so 1h / 24h / 7d all render smoothly.
 */

import type { EnvModeLike } from "./seed.js";

export type SeriesRange = "1h" | "24h" | "7d";

export interface SeriesPoint {
  t: number;
  connections: number;
  msgsIn: number;
  msgsOut: number;
  p50: number;
  p95: number;
  p99: number;
}

export interface MetricsSeries {
  range: SeriesRange;
  stepMs: number;
  points: SeriesPoint[];
  seeded: boolean;
  updatedAt: number;
}

const POINTS = 60;
const RANGE_STEP_MS: Record<SeriesRange, number> = {
  "1h": 60_000, //   1 min ×60 = 1h
  "24h": 1_440_000, // 24 min ×60 = 24h
  "7d": 10_080_000, // 2.8h ×60 = 7d
};

export function isSeriesRange(v: string): v is SeriesRange {
  return v === "1h" || v === "24h" || v === "7d";
}

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

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** A deterministic, live-sliding metrics series for an environment + range. */
export function seededSeries(
  envId: string,
  mode: EnvModeLike,
  nowMs: number,
  range: SeriesRange
): MetricsSeries {
  const stepMs = RANGE_STEP_MS[range];
  const stepSec = stepMs / 1000;
  const rng = mulberry32(hashString(`${envId}:${mode}:${range}`));
  const scale = mode === "live" ? 1 : 0.05;

  // Constants pulled once — stable across points and polls.
  const baseConns = (600 + rng() * 14000) * scale;
  const pA = rng() * 6.283;
  const pB = rng() * 6.283;
  const pC = rng() * 6.283;
  const pD = rng() * 6.283;
  const outRate = 0.5 + rng() * 1.8;
  const inRate = 0.4 + rng() * 0.5;
  const p50Base = 7 + rng() * 9;
  const p95Mult = 2 + rng() * 1.2;
  const p99Mult = 1.3 + rng() * 0.5;

  const points: SeriesPoint[] = [];
  for (let i = 0; i < POINTS; i++) {
    const t = nowMs - (POINTS - 1 - i) * stepMs;
    const ts = t / 1000;
    const wob =
      1 +
      0.18 * Math.sin(ts / (stepSec * 20) + pA) +
      0.08 * Math.sin(ts / (stepSec * 7) + pB) +
      0.04 * Math.sin(ts / (stepSec * 3) + pC);
    const connections = Math.max(0, Math.round(baseConns * wob));
    const msgsOut = Math.round(
      connections * outRate * (1 + 0.2 * Math.sin(ts / (stepSec * 5) + pD))
    );
    const msgsIn = Math.round(msgsOut * inRate);
    const latWob = 1 + 0.15 * Math.sin(ts / (stepSec * 9) + pB);
    const p50 = round1(p50Base * latWob);
    const p95 = round1(p50 * p95Mult);
    const p99 = round1(p95 * p99Mult);
    points.push({ t, connections, msgsIn, msgsOut, p50, p95, p99 });
  }

  return { range, stepMs, points, seeded: true, updatedAt: nowMs };
}
