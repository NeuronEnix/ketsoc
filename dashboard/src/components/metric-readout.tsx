import { cn } from "@/lib/utils";

export interface MetricReadoutProps {
  label: string;
  value: string | number;
  unit?: string;
  /** Percentage change vs the previous period; positive = up. */
  delta?: number;
  className?: string;
}

/** A single big metric readout — mono, tabular figures, optional unit + delta. */
export function MetricReadout({
  label,
  value,
  unit,
  delta,
  className,
}: MetricReadoutProps) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <div className="flex items-baseline gap-1.5">
        <span className="font-mono text-3xl font-semibold tabular-nums text-foreground">
          {value}
        </span>
        {unit ? (
          <span className="font-mono text-sm text-muted-foreground">{unit}</span>
        ) : null}
        {delta !== undefined ? (
          <span
            className={cn(
              "font-mono text-xs font-medium tabular-nums",
              delta >= 0 ? "text-success" : "text-destructive"
            )}
          >
            {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)}%
          </span>
        ) : null}
      </div>
    </div>
  );
}
