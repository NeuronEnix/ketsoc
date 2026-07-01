import { useState } from "react";

import { useCurrentOrg } from "@/lib/current-org";
import { useCurrentEnv } from "@/lib/current-env";
import { useSeries, type SeriesPoint, type SeriesRange } from "@/lib/series";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LineChart } from "@/components/line-chart";

const RANGES: SeriesRange[] = ["1h", "24h", "7d"];

function fmt(n: number): string {
  return Math.round(n).toLocaleString();
}

export function MetricsRoute() {
  const { current: org } = useCurrentOrg();
  const { current: env } = useCurrentEnv();
  const [range, setRange] = useState<SeriesRange>("1h");
  const query = useSeries(org?.id ?? null, env?.id ?? null, range);
  const points: SeriesPoint[] = query.data?.points ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-semibold tracking-tight">Metrics</h1>
        {env ? (
          env.mode === "live" ? (
            <Badge variant="success">{env.name} · live</Badge>
          ) : (
            <Badge variant="test">{env.name} · test</Badge>
          )
        ) : null}
        <div className="ml-auto flex items-center gap-1 rounded-md border border-border bg-card p-0.5">
          {RANGES.map((r) => (
            <Button
              key={r}
              size="sm"
              variant={r === range ? "secondary" : "ghost"}
              className="h-7 px-2.5 text-xs"
              onClick={() => setRange(r)}
            >
              {r}
            </Button>
          ))}
        </div>
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
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Connections</CardTitle>
            </CardHeader>
            <CardContent>
              <LineChart
                data={points}
                area
                height={180}
                series={[
                  {
                    label: "connections",
                    color: "#7c5cff",
                    accessor: (p) => p.connections,
                  },
                ]}
                formatValue={fmt}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Throughput / sec</CardTitle>
            </CardHeader>
            <CardContent>
              <LineChart
                data={points}
                series={[
                  { label: "in", color: "#5cc8ff", accessor: (p) => p.msgsIn },
                  {
                    label: "out",
                    color: "#c15cff",
                    accessor: (p) => p.msgsOut,
                  },
                ]}
                formatValue={fmt}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Latency (ms)</CardTitle>
            </CardHeader>
            <CardContent>
              <LineChart
                data={points}
                series={[
                  { label: "p50", color: "#3ecf8e", accessor: (p) => p.p50 },
                  { label: "p95", color: "#f5a623", accessor: (p) => p.p95 },
                  { label: "p99", color: "#c15cff", accessor: (p) => p.p99 },
                ]}
                formatValue={(n) => `${n}`}
              />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
