import { useCurrentOrg } from "@/lib/current-org";
import { useCurrentEnv } from "@/lib/current-env";
import { useUsage, type UsageMetric } from "@/lib/usage";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function fmtCount(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return `${Math.round(n)}`;
}

function fmtBytes(n: number): string {
  const gib = 1024 * 1024 * 1024;
  const mib = 1024 * 1024;
  if (n >= gib) return `${(n / gib).toFixed(1)} GiB`;
  if (n >= mib) return `${(n / mib).toFixed(1)} MiB`;
  return `${(n / 1024).toFixed(0)} KiB`;
}

function fmtValue(n: number, unit: UsageMetric["unit"]): string {
  if (unit === "bytes") return fmtBytes(n);
  if (unit === "minutes") return `${fmtCount(n)} min`;
  return fmtCount(n);
}

function UsageBar({ m }: { m: UsageMetric }) {
  const pct = m.quota > 0 ? Math.min(100, (m.used / m.quota) * 100) : 0;
  const tone =
    pct >= 95 ? "bg-destructive" : pct >= 80 ? "bg-warning" : "bg-primary";
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 pt-5">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-muted-foreground">{m.label}</span>
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {Math.round(pct)}%
          </span>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="font-mono text-2xl font-semibold tabular-nums">
            {fmtValue(m.used, m.unit)}
          </span>
          <span className="text-xs text-muted-foreground">
            / {fmtValue(m.quota, m.unit)}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-secondary">
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-500",
              tone
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      </CardContent>
    </Card>
  );
}

export function UsageRoute() {
  const { current: org } = useCurrentOrg();
  const { current: env } = useCurrentEnv();
  const query = useUsage(org?.id ?? null, env?.id ?? null);
  const usage = query.data;

  const period =
    usage != null
      ? new Date(usage.periodStartMs).toLocaleDateString(undefined, {
          month: "long",
          year: "numeric",
          timeZone: "UTC",
        })
      : "";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-semibold tracking-tight">Usage</h1>
        {env ? (
          env.mode === "live" ? (
            <Badge variant="success">{env.name} · live</Badge>
          ) : (
            <Badge variant="test">{env.name} · test</Badge>
          )
        ) : null}
        {usage ? (
          <>
            <Badge variant="outline">{usage.plan}</Badge>
            <span className="text-xs text-muted-foreground">{period}</span>
          </>
        ) : null}
      </div>

      {!env ? (
        <Card>
          <CardContent className="pt-5">
            <p className="text-sm text-muted-foreground">
              No environments yet — create one to see usage.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Month-to-date usage against your plan quota
            {env.mode === "test" ? (
              <> — test-mode traffic is unbilled</>
            ) : null}
            .
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {(usage?.metrics ?? []).map((m) => (
              <UsageBar key={m.key} m={m} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
