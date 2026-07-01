/**
 * Seeded live connections. Deterministic per environment: each row keeps a
 * stable identity across polls while its age + message count tick upward, so
 * the Connections table feels live without rows jumping around. Backs the
 * observability UI until the real SessionDO telemetry lands in Phase 2.
 */

import { seededOverview, type EnvModeLike } from "./seed.js";

export type Transport = "websocket" | "sse";

export interface ConnectionRow {
  id: string;
  user: string;
  region: string;
  transport: Transport;
  connectedForSec: number;
  msgs: number;
  lastSeenSec: number;
}

export interface ConnectionsPage {
  total: number;
  sampled: number;
  connections: ConnectionRow[];
  seeded: boolean;
  updatedAt: number;
}

const REGIONS = ["iad", "sjc", "lhr", "fra", "sin", "syd", "gru"];
const DEFAULT_LIMIT = 40;
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
  for (let i = 0; i < len; i++) {
    out += HEX[Math.floor(rng() * 16)];
  }
  return out;
}

/**
 * A deterministic page of active connections for an environment. `total`
 * mirrors the overview connection count; `connections` is a stable sample of
 * up to `limit` rows whose age/msgs advance with `nowMs`.
 */
export function seededConnections(
  envId: string,
  mode: EnvModeLike,
  nowMs: number,
  limit: number = DEFAULT_LIMIT
): ConnectionsPage {
  const total = seededOverview(envId, mode, nowMs).connections;
  const count = Math.max(0, Math.min(limit, total));
  const tick = Math.floor(nowMs / 1000) % 3600;

  const connections: ConnectionRow[] = [];
  for (let i = 0; i < count; i++) {
    const rng = mulberry32(hashString(`${envId}:${mode}:conn:${i}`));
    const region = REGIONS[Math.floor(rng() * REGIONS.length)] ?? "iad";
    const transport: Transport = rng() < 0.85 ? "websocket" : "sse";
    const baseAge = Math.floor(5 + rng() * 10800);
    const connectedForSec = baseAge + tick;
    const rate = 0.2 + rng() * 3;
    const msgs = Math.floor(connectedForSec * rate);
    const lastSeenSec = Math.floor(rng() * 8);
    connections.push({
      id: `conn_${hex(rng, 12)}`,
      user: `usr_${hex(rng, 8)}`,
      region,
      transport,
      connectedForSec,
      msgs,
      lastSeenSec,
    });
  }

  return { total, sampled: count, connections, seeded: true, updatedAt: nowMs };
}
