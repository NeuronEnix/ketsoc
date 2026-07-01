import { ArrowDownLeft, ArrowUpRight } from "lucide-react";

import { useCurrentOrg } from "@/lib/current-org";
import { useCurrentEnv } from "@/lib/current-env";
import { useEvents, type TailEvent } from "@/lib/events";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function fmtBytes(n: number): string {
  return n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`;
}

function fmtClock(t: number): string {
  const d = new Date(t);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  const ms = String(d.getMilliseconds()).padStart(3, "0");
  return `${hh}:${mm}:${ss}.${ms}`;
}

function EventRow({ e }: { e: TailEvent }) {
  const out = e.direction === "out";
  return (
    <div className="flex items-center gap-3 border-b border-border/40 px-4 py-2 font-mono text-xs last:border-0 hover:bg-accent/40">
      <span className="tabular-nums text-muted-foreground">{fmtClock(e.t)}</span>
      <span
        className={
          out
            ? "flex items-center gap-1 text-info"
            : "flex items-center gap-1 text-success"
        }
        title={out ? "delivered" : "published"}
      >
        {out ? (
          <ArrowUpRight className="h-3.5 w-3.5" />
        ) : (
          <ArrowDownLeft className="h-3.5 w-3.5" />
        )}
      </span>
      <span className="min-w-0 truncate font-medium text-foreground">
        {e.channel}
      </span>
      <Badge variant="outline" className="shrink-0 text-[10px]">
        {e.name}
      </Badge>
      <span className="ml-auto shrink-0 text-muted-foreground">{e.user}</span>
      <span className="w-16 shrink-0 text-right tabular-nums text-muted-foreground">
        {fmtBytes(e.bytes)}
      </span>
    </div>
  );
}

export function EventsRoute() {
  const { current: org } = useCurrentOrg();
  const { current: env } = useCurrentEnv();
  const query = useEvents(org?.id ?? null, env?.id ?? null);
  const tail = query.data;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-semibold tracking-tight">Events</h1>
        {env ? (
          env.mode === "live" ? (
            <Badge variant="success">{env.name} · live</Badge>
          ) : (
            <Badge variant="test">{env.name} · test</Badge>
          )
        ) : null}
        {tail ? (
          <span className="text-xs text-muted-foreground">
            ~
            <span className="font-mono text-foreground">
              {tail.ratePerSec}
            </span>{" "}
            events/sec
          </span>
        ) : null}
        <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
          streaming
        </span>
      </div>

      {!env ? (
        <Card>
          <CardContent className="pt-5">
            <p className="text-sm text-muted-foreground">
              No environments yet — create one to see the event tail.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            {query.isLoading ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">Loading…</p>
            ) : (tail?.events.length ?? 0) === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">
                No events yet.
              </p>
            ) : (
              <div className="max-h-[70vh] overflow-y-auto">
                {tail?.events.map((e) => <EventRow key={e.id} e={e} />)}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
