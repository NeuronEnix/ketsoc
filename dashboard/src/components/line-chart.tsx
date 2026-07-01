import { useId } from "react";

export interface ChartSeries<T> {
  label: string;
  color: string;
  accessor: (d: T) => number;
}

interface LineChartProps<T> {
  data: T[];
  series: ChartSeries<T>[];
  height?: number;
  /** Fill the area under the first series with a gradient. */
  area?: boolean;
  formatValue?: (n: number) => string;
}

const VIEW_W = 600;
const PAD_Y = 8;

/**
 * Dependency-free responsive line/area chart. Renders an SVG that stretches to
 * its container width; strokes stay crisp via non-scaling-stroke. Good enough
 * for the seeded observability charts (uPlot swap tracked in KAU-54).
 */
export function LineChart<T>({
  data,
  series,
  height = 140,
  area = false,
  formatValue = (n) => Math.round(n).toLocaleString(),
}: LineChartProps<T>) {
  const gradId = useId();
  const n = data.length;

  if (n === 0 || series.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-sm text-muted-foreground"
        style={{ height }}
      >
        No data
      </div>
    );
  }

  const allValues = series.flatMap((s) => data.map((d) => s.accessor(d)));
  const rawMin = Math.min(...allValues);
  const rawMax = Math.max(...allValues);
  const span = rawMax - rawMin || 1;
  const min = rawMin - span * 0.08;
  const max = rawMax + span * 0.08;

  const x = (i: number) => (n === 1 ? 0 : (i / (n - 1)) * VIEW_W);
  const y = (v: number) =>
    height - PAD_Y - ((v - min) / (max - min)) * (height - PAD_Y * 2);

  const linePath = (s: ChartSeries<T>) =>
    data
      .map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(s.accessor(d)).toFixed(1)}`)
      .join(" ");

  const first = series[0]!;
  const areaPath = `${linePath(first)} L${VIEW_W},${height} L0,${height} Z`;

  return (
    <div className="flex flex-col gap-2">
      <svg
        viewBox={`0 0 ${VIEW_W} ${height}`}
        preserveAspectRatio="none"
        className="w-full"
        style={{ height }}
        role="img"
        aria-label={series.map((s) => s.label).join(", ")}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={first.color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={first.color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1="0"
            x2={VIEW_W}
            y1={height * f}
            y2={height * f}
            className="stroke-border"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
            opacity="0.4"
          />
        ))}
        {area ? <path d={areaPath} fill={`url(#${gradId})`} /> : null}
        {series.map((s) => (
          <path
            key={s.label}
            d={linePath(s)}
            fill="none"
            stroke={s.color}
            strokeWidth="1.5"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        {series.map((s) => {
          const last = s.accessor(data[n - 1]!);
          return (
            <span key={s.label} className="flex items-center gap-1.5">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: s.color }}
              />
              {s.label}
              <span className="font-mono tabular-nums text-foreground">
                {formatValue(last)}
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
