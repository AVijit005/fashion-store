import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Sparkline } from "./charts";
import { cn } from "@/lib/utils";

type Props = {
  label: string;
  value: string;
  delta: number;
  spark: number[];
  hint?: string;
};

export function KpiCard({ label, value, delta, spark, hint }: Props) {
  const positive = delta >= 0;
  return (
    <div className="group relative flex flex-col gap-4 border border-line bg-paper p-5 transition hover:border-ink/30">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-mute">{label}</p>
          <p className="mt-2 font-display text-3xl tabular-nums text-ink">{value}</p>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1 border px-1.5 py-0.5 font-mono text-[10px] tabular-nums",
            positive ? "border-ink/15 text-ink" : "border-accent/40 text-accent",
          )}
        >
          {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
          {Math.abs(delta).toFixed(1)}%
        </span>
      </div>
      <div className={cn("text-ink", !positive && "text-accent")}>
        <Sparkline data={spark} positive={positive} />
      </div>
      {hint && <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-mute">{hint}</p>}
    </div>
  );
}
