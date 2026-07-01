import { useCurrentOrg } from "@/lib/current-org";
import { useCurrentEnv } from "@/lib/current-env";
import { useConnections } from "@/lib/connections";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function fmtDuration(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m}m ${sec % 60}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function fmtCount(n: number): string {
  return Math.round(n).toLocaleString();
}

export function ConnectionsRoute() {
  const { current: org } = useCurrentOrg();
  const { current: env } = useCurrentEnv();
  const query = useConnections(org?.id ?? null, env?.id ?? null);
  const page = query.data;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-semibold tracking-tight">Connections</h1>
        {env ? (
          env.mode === "live" ? (
            <Badge variant="success">{env.name} · live</Badge>
          ) : (
            <Badge variant="test">{env.name} · test</Badge>
          )
        ) : null}
        <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
          live
        </span>
      </div>

      {!env ? (
        <Card>
          <CardContent className="pt-5">
            <p className="text-sm text-muted-foreground">
              No environments yet — create one to see connections.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            <span className="font-mono text-foreground">
              {fmtCount(page?.total ?? 0)}
            </span>{" "}
            active connections
            {page && page.total > page.sampled ? (
              <>
                {" "}
                · showing a live sample of{" "}
                <span className="font-mono text-foreground">
                  {page.sampled}
                </span>
              </>
            ) : null}
          </p>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="px-4 py-2.5 font-medium">Connection</th>
                      <th className="px-4 py-2.5 font-medium">User</th>
                      <th className="px-4 py-2.5 font-medium">Region</th>
                      <th className="px-4 py-2.5 font-medium">Transport</th>
                      <th className="px-4 py-2.5 text-right font-medium">
                        Connected
                      </th>
                      <th className="px-4 py-2.5 text-right font-medium">
                        Msgs
                      </th>
                      <th className="px-4 py-2.5 text-right font-medium">
                        Last seen
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(page?.connections ?? []).map((c) => (
                      <tr
                        key={c.id}
                        className="border-b border-border/50 last:border-0 hover:bg-accent/40"
                      >
                        <td className="px-4 py-2 font-mono text-xs text-foreground">
                          {c.id}
                        </td>
                        <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                          {c.user}
                        </td>
                        <td className="px-4 py-2 font-mono text-xs uppercase">
                          {c.region}
                        </td>
                        <td className="px-4 py-2">
                          <Badge variant="outline" className="text-[10px]">
                            {c.transport}
                          </Badge>
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-xs tabular-nums text-muted-foreground">
                          {fmtDuration(c.connectedForSec)}
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-xs tabular-nums">
                          {fmtCount(c.msgs)}
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-xs tabular-nums text-muted-foreground">
                          {c.lastSeenSec}s ago
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {query.isLoading ? (
                  <p className="px-4 py-6 text-sm text-muted-foreground">
                    Loading…
                  </p>
                ) : null}
                {page && page.connections.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-muted-foreground">
                    No active connections right now.
                  </p>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
