/**
 * Seeded monthly usage vs plan quota. Deterministic per (environment, mode) and
 * scaled by how far into the current UTC month `nowMs` falls, so the numbers
 * grow through the billing period like a real meter. Backs the Usage screen
 * until real metering lands in Phase 2.
 */

import type { EnvModeLike } from "./seed.js";

export type UsageUnit = "count" | "bytes" | "minutes";

export interface UsageMetric {
  key: string;
  label: string;
  used: number;
  quota: number;
  unit: UsageUnit;
}

export interface UsageSummary {
  plan: string;
  periodStartMs: number;
  periodEndMs: number;
  metrics: UsageMetric[];
  seeded: boolean;
  updatedAt: number;
}

interface QuotaDef {
  key: string;
  label: string;
  unit: UsageUnit;
  quotaLive: number;
  quotaTest: number;
}

const QUOTAS: QuotaDef[] = [
  {
    key: "messages",
    label: "Messages",
    unit: "count",
    quotaLive: 50_000_000,
    quotaTest: 1_000_000,
  },
  {
    key: "peakConnections",
    label: "Peak connections",
    unit: "count",
    quotaLive: 10_000,
    quotaTest: 200,
  },
  {
    key: "connectionMinutes",
    label: "Connection-minutes",
    unit: "minutes",
    quotaLive: 5_000_000,
    quotaTest: 50_000,
  },
  {
    key: "dataTransfer",
    label: "Data transfer",
    unit: "bytes",
    quotaLive: 500 * 1024 * 1024 * 1024, // 500 GiB
    quotaTest: 5 * 1024 * 1024 * 1024, //     5 GiB
  },
];

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

/** Deterministic month-to-date usage against the environment's plan quota. */
export function seededUsage(
  envId: string,
  mode: EnvModeLike,
  nowMs: number
): UsageSummary {
  const d = new Date(nowMs);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const dayOfMonth = d.getUTCDate();
  const progress = Math.min(1, dayOfMonth / daysInMonth);

  const rng = mulberry32(hashString(`${envId}:${mode}:usage`));

  const metrics: UsageMetric[] = QUOTAS.map((q) => {
    const quota = mode === "live" ? q.quotaLive : q.quotaTest;
    // Target utilization for the full month, then scale by month progress.
    const utilization = 0.35 + rng() * 0.6;
    // Peak connections is an instantaneous high-water mark, not accumulated.
    const scaled =
      q.key === "peakConnections" ? utilization : utilization * progress;
    const used = Math.min(quota, Math.round(quota * scaled));
    return { key: q.key, label: q.label, used, quota, unit: q.unit };
  });

  return {
    plan: mode === "live" ? "Scale" : "Free (sandbox)",
    periodStartMs: Date.UTC(year, month, 1),
    periodEndMs: Date.UTC(year, month + 1, 1),
    metrics,
    seeded: true,
    updatedAt: nowMs,
  };
}
