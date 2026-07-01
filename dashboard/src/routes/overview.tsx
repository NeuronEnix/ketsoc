import { useCurrentOrg } from "@/lib/current-org";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MetricReadout } from "@/components/metric-readout";
import { Badge } from "@/components/ui/badge";

export function OverviewRoute() {
  const { current, isLoading } = useCurrentOrg();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold tracking-tight">Overview</h1>
        {current ? (
          <Badge variant="outline">{current.displayName}</Badge>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Realtime</CardTitle>
          <CardDescription>
            Live socket metrics{isLoading ? " — loading…" : ""}. Seeded until the
            telemetry pipeline lands.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-6 sm:grid-cols-4">
          <MetricReadout label="Connections" value="—" />
          <MetricReadout label="Msgs / sec" value="—" />
          <MetricReadout label="p99.9 (tail)" value="—" unit="ms" />
          <MetricReadout label="RTT" value="—" unit="ms" />
        </CardContent>
      </Card>
    </div>
  );
}
