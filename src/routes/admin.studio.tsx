import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Check, Crown, MessageCircle, Search, Sparkles, X, Zap } from "lucide-react";
import { SectionHeader, Panel } from "@/components/admin/section-header";
import { StatusChip, studioTone } from "@/components/admin/status-chip";
import { AdminDrawer } from "@/components/admin/drawer";
import { type StudioRequest } from "@/lib/admin/data";
import { longDate, relTime } from "@/lib/admin/format";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/studio")({
  head: () => ({
    meta: [
      { title: "Studio requests — Admin · Ink Studio" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: StudioPage,
});

const STATUSES = [
  "all",
  "new",
  "in_review",
  "approved",
  "in_production",
  "shipped",
  "rejected",
] as const;

const PRINT_LABEL: Record<string, string> = {
  screen: "Screen print",
  dtg: "DTG",
  embroidery: "Embroidery",
  puff: "Puff print",
};

function StudioPage() {
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("all");
  const [q, setQ] = useState("");
  const [active, setActive] = useState<StudioRequest | null>(null);

  const { data: apiStudio = [], isLoading } = useQuery<StudioRequest[]>({
    queryKey: ["admin-studio"],
    queryFn: () => apiClient.get("/admin/studio"),
  });
  const baseList = apiStudio;

  const list = useMemo(
    () =>
      baseList.filter((r) => {
        if (status !== "all" && r.status !== status) return false;
        if (q && !`${r.customer.name} ${r.ref}`.toLowerCase().includes(q.toLowerCase()))
          return false;
        return true;
      }),
    [baseList, status, q],
  );

  const queryClient = useQueryClient();

  const statusMutation = useMutation({
    mutationFn: async ({
      id,
      action,
      payload,
    }: {
      id: string;
      action: "approve" | "reject" | "revise";
      payload?: any;
    }) => {
      return apiClient.post(`/admin/studio/${id}/${action}`, payload);
    },
    onSuccess: (_, variables) => {
      toast.success(`Request ${variables.action}d successfully`);
      queryClient.invalidateQueries({ queryKey: ["admin-studio"] });
      setActive(null);
    },
  });

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
        eyebrow={`${baseList.length} requests · ${baseList.filter((r) => r.status === "new").length} need triage`}
        title="Studio requests"
        description="Custom-print queue with approvals, revisions and production status."
      />

      <div className="flex flex-wrap items-center gap-1 border border-line bg-paper p-1">
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] transition ${status === s ? "bg-ink text-paper" : "text-mute hover:text-ink"}`}
          >
            {s.replace("_", " ")}
          </button>
        ))}
        <label className="relative ml-auto">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-mute"
            aria-hidden="true"
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search ref or customer…"
            className="h-8 w-56 border border-line bg-paper pl-8 pr-3 text-[12px] outline-none focus:border-ink"
          />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {list.map((r) => (
          <button
            key={r.id}
            onClick={() => setActive(r)}
            className="group flex flex-col gap-3 border border-line bg-paper p-3 text-left transition hover:border-ink/40"
          >
            <div className="relative aspect-[4/3] overflow-hidden bg-fog">
              <img
                src={r.preview}
                alt=""
                className="h-full w-full object-cover transition group-hover:scale-[1.02]"
              />
              <div className="absolute left-2 top-2 flex flex-col gap-1">
                <StatusChip label={r.status.replace("_", " ")} tone={studioTone(r.status)} />
                {r.priority === "vip" && <StatusChip label="VIP" tone="warn" />}
                {r.priority === "rush" && <StatusChip label="Rush" tone="warn" />}
              </div>
              <span className="absolute right-2 top-2 border border-paper/40 bg-ink/70 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.2em] text-paper backdrop-blur">
                {PRINT_LABEL[r.printType]}
              </span>
            </div>
            <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.22em] text-mute">
              <span>{r.ref}</span>
              <span>{relTime(r.submittedAt)}</span>
            </div>
            <div>
              <p className="text-[13px] text-ink">{r.customer.name}</p>
              <p className="text-[11px] text-mute">{r.garment}</p>
            </div>
            <div className="mt-auto flex items-center gap-2 border-t border-line pt-2 text-[10px] font-mono uppercase tracking-[0.22em] text-mute">
              <span>Rev {r.revisions}</span>
              <span className="h-1 w-1 rounded-full bg-mute/40" />
              <span>{r.customer.email.split("@")[1]}</span>
            </div>
          </button>
        ))}
      </div>

      <Panel title="Queue summary">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {(["new", "in_review", "approved", "in_production"] as const).map((s) => (
            <div key={s} className="border border-line bg-paper p-3">
              <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-mute">
                {s.replace("_", " ")}
              </p>
              <p className="mt-1 font-display text-3xl tabular-nums text-ink">
                {baseList.filter((r) => r.status === s).length}
              </p>
            </div>
          ))}
        </div>
      </Panel>

      <AdminDrawer
        open={!!active}
        onClose={() => setActive(null)}
        eyebrow={active?.ref}
        title={active ? `${active.customer.name} · ${PRINT_LABEL[active.printType]}` : ""}
        width={600}
        footer={
          <div className="flex justify-between gap-2">
            <button
              disabled={statusMutation.isPending}
              onClick={() => statusMutation.mutate({ id: active!.id, action: "reject" })}
              className="press flex items-center gap-1.5 border border-line bg-paper px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-accent hover:border-accent disabled:opacity-50"
            >
              <X className="h-3.5 w-3.5" /> Reject
            </button>
            <div className="flex gap-2">
              <button
                disabled={statusMutation.isPending}
                onClick={() =>
                  statusMutation.mutate({
                    id: active!.id,
                    action: "revise",
                    payload: { notes: "Revision requested" },
                  })
                }
                className="press flex items-center gap-1.5 border border-line bg-paper px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-mute hover:border-ink hover:text-ink disabled:opacity-50"
              >
                <MessageCircle className="h-3.5 w-3.5" /> Request revision
              </button>
              <button
                disabled={statusMutation.isPending}
                onClick={() => statusMutation.mutate({ id: active!.id, action: "approve" })}
                className="press flex items-center gap-1.5 bg-ink px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-paper disabled:opacity-50"
              >
                <Check className="h-3.5 w-3.5" /> Approve
              </button>
            </div>
          </div>
        }
      >
        {active && <StudioDetail req={active} />}
      </AdminDrawer>
    </div>
  );
}

function StudioDetail({ req }: { req: StudioRequest }) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <StatusChip label={req.status.replace("_", " ")} tone={studioTone(req.status)} />
        <StatusChip label={PRINT_LABEL[req.printType]} tone="info" />
        {req.priority === "vip" && <StatusChip label="VIP customer" tone="warn" />}
        {req.priority === "rush" && <StatusChip label="Rush · 48h SLA" tone="warn" />}
        <StatusChip label={`Rev ${req.revisions}`} tone="muted" />
      </div>

      <div className="aspect-[4/3] overflow-hidden border border-line bg-fog">
        <img src={req.preview} alt="" className="h-full w-full object-cover" />
      </div>

      <section className="grid grid-cols-2 gap-3">
        <Field
          label="Customer"
          value={req.customer.name}
          icon={req.priority === "vip" ? <Crown className="h-3 w-3 text-accent" /> : null}
        />
        <Field label="Submitted" value={longDate(req.submittedAt)} />
        <Field label="Garment" value={req.garment} />
        <Field
          label="Technique"
          value={PRINT_LABEL[req.printType]}
          icon={<Sparkles className="h-3 w-3 text-mute" />}
        />
        <Field
          label="Priority"
          value={req.priority}
          icon={req.priority !== "standard" ? <Zap className="h-3 w-3 text-accent" /> : null}
        />
        <Field label="Revisions" value={String(req.revisions)} />
      </section>

      <section>
        <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-mute">
          Customer notes
        </p>
        <p className="mt-2 border border-line bg-fog/40 p-3 text-[13px] text-ink">{req.notes}</p>
      </section>

      <section>
        <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-mute">
          Internal comments
        </p>
        <textarea
          placeholder="Add a comment for the studio team…"
          rows={3}
          className="mt-2 w-full resize-none border border-line bg-paper p-3 text-[13px] outline-none focus:border-ink"
        />
      </section>
    </div>
  );
}

function Field({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="border border-line bg-paper p-3">
      <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-mute">{label}</p>
      <p className="mt-1 inline-flex items-center gap-1.5 text-[13px] text-ink">
        {icon} {value}
      </p>
    </div>
  );
}
