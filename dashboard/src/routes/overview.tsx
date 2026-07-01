import { useCurrentOrg } from "@/lib/current-org";
import { useEnvs } from "@/lib/envs";
import { useOverview, type MetricsOverview } from "@/lib/metrics";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MetricReadout } from "@/components/metric-readout";
import { Badge } from "@/components/ui/badge";

function fmt(n: number | undefined): string {
  return n === undefined ? "—" : Math.round(n).toLocaleString();
}

function RegionBars({ data }: { data: MetricsOverview["byRegion"] }) {
  const max = Math.max(1, ...data.map((r) => r.connections));
  return (
    <div className="flex flex-col gap-2">
      {data.map((r) => (
        <div key={r.region} className="flex items-center gap-3">
          <span className="w-10 font-mono text-xs uppercase text-muted-foreground">
            {r.region}
          </span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-500"
              style={{ width: `${(r.connections / max) * 100}%` }}
            />
          </div>
          <span className="w-16 text-right font-mono text-xs tabular-nums text-muted-foreground">
            {r.connections.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}

export function OverviewRoute() {
  const { current } = useCurrentOrg();
  const orgId = current?.id ?? null;
  const envs = useEnvs(orgId).data ?? [];
  const env = envs.find((e) => e.name === "prod") ?? envs[0] ?? null;
  const overview = useOverview(orgId, env?.id ?? null);
  const m = overview.data;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-semibold tracking-tight">Overview</h1>
        {current ? (
          <Badge variant="outline">{current.displayName}</Badge>
        ) : null}
        {env ? (
          env.mode === "live" ? (
            <Badge variant="success">{env.name} · live</Badge>
          ) : (
            <Badge variant="test">{env.name} · test</Badge>
          )
        ) : null}
        <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
          seeded live
        </span>
      </div>

      {!env ? (
        <Card>
          <CardContent className="pt-5">
            <p className="text-sm text-muted-foreground">
              No environments yet — create one to see metrics.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Card>
              <CardContent className="pt-5">
                <MetricReadout
                  label="Connections"
                  value={fmt(m?.connections)}
                />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <MetricReadout
                  label="Msgs in / sec"
                  value={fmt(m?.msgsInPerSec)}
                />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <MetricReadout
                  label="Msgs out / sec"
                  value={fmt(m?.msgsOutPerSec)}
                />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <MetricReadout
                  label="Active users"
                  value={fmt(m?.activeUsers)}
                />
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Latency</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-4 gap-4">
                <MetricReadout label="p50" value={m?.latencyMs.p50 ?? "—"} unit="ms" />
                <MetricReadout label="p95" value={m?.latencyMs.p95 ?? "—"} unit="ms" />
                <MetricReadout label="p99" value={m?.latencyMs.p99 ?? "—"} unit="ms" />
                <div className="-m-1 rounded-md p-1 ring-1 ring-primary/30">
                  <MetricReadout
                    label="p99.9 tail"
                    value={m?.latencyMs.p999 ?? "—"}
                    unit="ms"
                  />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>RTT</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-3 gap-4">
                <MetricReadout label="p50" value={m?.rttMs.p50 ?? "—"} unit="ms" />
                <MetricReadout label="p95" value={m?.rttMs.p95 ?? "—"} unit="ms" />
                <MetricReadout label="p99" value={m?.rttMs.p99 ?? "—"} unit="ms" />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Connections by region</CardTitle>
            </CardHeader>
            <CardContent>
              {m ? (
                <RegionBars data={m.byRegion} />
              ) : (
                <p className="text-sm text-muted-foreground">Loading…</p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
