import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AlertTriangle, CalendarClock, Eye, Plus, Star } from "lucide-react";
import { SectionHeader, Panel } from "@/components/admin/section-header";
import { StatusChip } from "@/components/admin/status-chip";
import { drops as ALL, type Drop } from "@/lib/admin/data";
import { compactInr, longDate } from "@/lib/admin/format";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";

export const Route = createFileRoute("/admin/drops")({
  head: () => ({
    meta: [
      { title: "Drops — Admin · Ink Studio" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: DropsPage,
});

const STATUS_TONE = { live: "positive", scheduled: "warn", ended: "muted", draft: "info" } as const;

function DropsPage() {
  const { data: apiDrops = [], isLoading } = useQuery<Drop[]>({
    queryKey: ["admin-drops"],
    queryFn: () => apiClient.get("/admin/drops"),
  });
  const baseList = apiDrops.length > 0 ? apiDrops : ALL;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-24 animate-pulse rounded border border-line bg-fog/20" />
        <div className="h-96 animate-pulse rounded border border-line bg-fog/20" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow={`${baseList.length} capsules · ${baseList.filter((d) => d.status === "live").length} live`}
        title="Drops"
        description="Schedule capsules, monitor live performance, manage featured campaigns."
        actions={
          <button className="press flex items-center gap-1.5 bg-ink px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-paper">
            <Plus className="h-3.5 w-3.5" /> New drop
          </button>
        }
      />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {baseList.map((d) => (
          <DropCard key={d.id} drop={d} />
        ))}
      </div>

      <Panel title="Campaign calendar" bodyClassName="p-0">
        <ul className="divide-y divide-line/60">
          {baseList.map((d) => (
            <li key={d.id} className="flex items-center gap-4 px-4 py-3 transition hover:bg-fog/40">
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-mute">
                {longDate(d.startsAt)}
              </span>
              <span className="h-px flex-1 bg-line" />
              <p className="text-[13px] text-ink">{d.name}</p>
              <StatusChip label={d.status} tone={STATUS_TONE[d.status]} />
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

function DropCard({ drop }: { drop: Drop }) {
  const sellThrough = drop.capsuleSize ? Math.round((drop.sold / drop.capsuleSize) * 100) : 0;
  const remaining = drop.capsuleSize - drop.sold;
  return (
    <article className="overflow-hidden border border-line bg-paper">
      <div className="relative aspect-[16/9] overflow-hidden bg-fog">
        <img src={drop.cover} alt="" className="h-full w-full object-cover" />
        <div className="absolute left-3 top-3 flex flex-col gap-1.5">
          <StatusChip label={drop.status} tone={STATUS_TONE[drop.status]} />
          {drop.featured && <StatusChip label="Featured campaign" tone="warn" />}
        </div>
        {drop.status === "live" && (
          <div className="absolute right-3 top-3 flex items-center gap-1.5 border border-paper/30 bg-ink/80 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-paper backdrop-blur">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" /> Live
          </div>
        )}
        {drop.status === "scheduled" && <Countdown to={drop.startsAt} />}
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-xl text-ink">{drop.name}</h3>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-mute">
              {longDate(drop.startsAt)}
              {drop.endsAt ? ` → ${longDate(drop.endsAt)}` : ""}
            </p>
          </div>
          <button className="text-mute hover:text-ink" aria-label="Toggle featured">
            <Star className={`h-4 w-4 ${drop.featured ? "fill-accent text-accent" : ""}`} />
          </button>
        </div>

        {drop.status !== "draft" && drop.status !== "scheduled" && (
          <div className="mt-4 space-y-2">
            <div className="flex items-baseline justify-between font-mono text-[11px] uppercase tracking-[0.18em] text-mute">
              <span>Sell-through</span>
              <span className="tabular-nums text-ink">
                {drop.sold}/{drop.capsuleSize} · {sellThrough}%
              </span>
            </div>
            <div className="h-[3px] bg-fog">
              <div className="h-full bg-ink" style={{ width: `${sellThrough}%` }} />
            </div>
          </div>
        )}

        <div className="mt-4 grid grid-cols-3 gap-3 border-t border-line pt-3">
          <Cell label="Revenue" value={compactInr(drop.revenue)} />
          <Cell label="Units" value={String(drop.units)} />
          <Cell label="CR" value={`${drop.conversion.toFixed(1)}%`} />
        </div>

        {drop.status === "live" && remaining <= 20 && remaining > 0 && (
          <p className="mt-3 inline-flex items-center gap-1.5 border border-accent/40 bg-accent/10 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-accent">
            <AlertTriangle className="h-3 w-3" /> {remaining} units left in capsule
          </p>
        )}

        <div className="mt-4 flex items-center gap-2 border-t border-line pt-3">
          <button className="flex items-center gap-1.5 border border-line bg-paper px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-mute hover:border-ink hover:text-ink">
            <Eye className="h-3.5 w-3.5" /> Preview
          </button>
          <button className="flex items-center gap-1.5 border border-line bg-paper px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-mute hover:border-ink hover:text-ink">
            <CalendarClock className="h-3.5 w-3.5" /> Reschedule
          </button>
          <button className="ml-auto bg-ink px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-paper">
            Manage
          </button>
        </div>
      </div>
    </article>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-mute">{label}</p>
      <p className="mt-0.5 font-display text-xl tabular-nums text-ink">{value}</p>
    </div>
  );
}

function Countdown({ to }: { to: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);
  const diff = Math.max(0, new Date(to).getTime() - now);
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return (
    <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2 border border-paper/30 bg-ink/80 px-3 py-1.5 font-mono text-[11px] tabular-nums text-paper backdrop-blur">
      <span>{d}d</span>
      <span>{String(h).padStart(2, "0")}h</span>
      <span>{String(m).padStart(2, "0")}m</span>
      <span className="text-paper/60">{String(s).padStart(2, "0")}s</span>
    </div>
  );
}
