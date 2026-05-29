// Minimal inline-SVG charts — no third-party deps. Premium, restrained.
import { useMemo } from "react";
import { cn } from "@/lib/utils";

export function Sparkline({
  data,
  positive = true,
  className,
}: {
  data: number[];
  positive?: boolean;
  className?: string;
}) {
  const { d, area } = useMemo(() => buildPath(data, 120, 36), [data]);
  return (
    <svg viewBox="0 0 120 36" className={cn("h-10 w-full", className)} preserveAspectRatio="none">
      <path d={area} fill={positive ? "currentColor" : "currentColor"} opacity="0.08" />
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function AreaChart({
  data,
  height = 220,
  yKey = "revenue",
}: {
  data: Array<Record<string, number>>;
  height?: number;
  yKey?: string;
}) {
  const values = data.map((d) => d[yKey]);
  const { d: line, area } = buildPath(values, 1000, height);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const gridY = [0.25, 0.5, 0.75].map((p) => Math.round(p * height));
  return (
    <div className="relative">
      <svg
        viewBox={`0 0 1000 ${height}`}
        className="h-[var(--h)] w-full text-ink"
        style={{ ["--h" as string]: `${height}px` }}
        preserveAspectRatio="none"
      >
        {gridY.map((y) => (
          <line
            key={y}
            x1={0}
            x2={1000}
            y1={y}
            y2={y}
            stroke="currentColor"
            strokeOpacity="0.06"
            strokeDasharray="2 4"
          />
        ))}
        <path d={area} fill="currentColor" opacity="0.06" />
        <path
          d={line}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
      <div className="pointer-events-none absolute inset-y-2 right-1 flex flex-col justify-between text-[9px] font-mono uppercase tracking-[0.18em] text-mute">
        <span>{compactNum(max)}</span>
        <span>{compactNum(min)}</span>
      </div>
    </div>
  );
}

export function BarRow({
  rows,
  valueLabel,
}: {
  rows: Array<{ name: string; value: number; sub?: string }>;
  valueLabel?: string;
}) {
  const max = Math.max(...rows.map((r) => r.value));
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => {
        const pct = max ? (r.value / max) * 100 : 0;
        return (
          <li key={r.name} className="group">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-[12px] text-ink">{r.name}</p>
              <p className="font-mono text-[11px] tabular-nums text-mute">
                {r.sub ?? `${valueLabel ?? ""}${r.value.toLocaleString("en-IN")}`}
              </p>
            </div>
            <div className="mt-1.5 h-[3px] w-full bg-fog">
              <div
                className="h-full bg-ink transition-all duration-700 ease-out"
                style={{ width: `${pct}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function buildPath(values: number[], w: number, h: number) {
  if (values.length === 0) return { d: "", area: "" };
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const stepX = w / (values.length - 1 || 1);
  const points = values.map((v, i) => {
    const x = i * stepX;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return [x, y] as const;
  });
  const d = points.map(([x, y], i) => (i === 0 ? `M${x},${y}` : `L${x},${y}`)).join(" ");
  const area = `${d} L${w},${h} L0,${h} Z`;
  return { d, area };
}

function compactNum(n: number) {
  if (n >= 1_00_000) return `${(n / 1_00_000).toFixed(1)}L`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}
