/**
 * Seeded-but-realistic metrics. Deterministic per environment, gently
 * time-modulated so the dashboard feels alive. Serves the observability UI
 * until the real telemetry pipeline (Queue → D1/ClickHouse) lands in Phase 2.
 */

export type EnvModeLike = "live" | "test";

export interface LatencyPercentiles {
  p50: number;
  p95: number;
  p99: number;
  p999: number;
}

export interface RegionLoad {
  region: string;
  connections: number;
}

export interface MetricsOverview {
  connections: number;
  connectionsPeak: number;
  msgsInPerSec: number;
  msgsOutPerSec: number;
  activeUsers: number;
  latencyMs: LatencyPercentiles;
  rttMs: { p50: number; p95: number; p99: number };
  errorsPerMin: number;
  byRegion: RegionLoad[];
  seeded: boolean;
  updatedAt: number;
}

const REGIONS = ["iad", "sjc", "lhr", "fra", "sin", "syd", "gru"];

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

/** Deterministic, time-modulated metrics for an environment. */
export function seededOverview(
  envId: string,
  mode: EnvModeLike,
  nowMs: number
): MetricsOverview {
  const rng = mulberry32(hashString(`${envId}:${mode}`));
  const scale = mode === "live" ? 1 : 0.05;
  const baseConns = (600 + rng() * 14000) * scale;

  const t = nowMs / 1000;
  const phase1 = rng() * 6.28;
  const phase2 = rng() * 6.28;
  const wobble =
    1 + 0.15 * Math.sin(t / 37 + phase1) + 0.05 * Math.sin(t / 7 + phase2);

  const connections = Math.max(0, Math.round(baseConns * wobble));
  const connectionsPeak = Math.round(baseConns * (1.3 + rng() * 0.4));
  const msgsOut = Math.round(
    connections * (0.5 + rng() * 1.8) * (1 + 0.2 * Math.sin(t / 11))
  );
  const msgsIn = Math.round(msgsOut * (0.4 + rng() * 0.5));
  const activeUsers = Math.round(connections * (0.55 + rng() * 0.35));

  const p50 = round1(7 + rng() * 9);
  const p95 = round1(p50 * (2 + rng() * 1.2));
  const p99 = round1(p95 * (1.3 + rng() * 0.5));
  const p999 = round1(p99 * (1.25 + rng() * 0.7));

  const rtt50 = round1(p50 * (1.8 + rng() * 0.6));
  const rtt95 = round1(rtt50 * (1.8 + rng()));
  const rtt99 = round1(rtt95 * (1.3 + rng() * 0.5));

  const errorsPerMin = round1(connections * rng() * 0.01);

  const weights = REGIONS.map(() => 0.3 + rng());
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const byRegion = REGIONS.map((region, i) => ({
    region,
    connections: Math.round(((weights[i] ?? 0) / totalWeight) * connections),
  }));

  return {
    connections,
    connectionsPeak,
    msgsInPerSec: msgsIn,
    msgsOutPerSec: msgsOut,
    activeUsers,
    latencyMs: { p50, p95, p99, p999 },
    rttMs: { p50: rtt50, p95: rtt95, p99: rtt99 },
    errorsPerMin,
    byRegion,
    seeded: true,
    updatedAt: nowMs,
  };
}
