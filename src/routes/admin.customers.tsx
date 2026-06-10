import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Crown, Mail, MessageSquare, Search, Sparkles, Tag } from "lucide-react";
import { SectionHeader, Panel } from "@/components/admin/section-header";
import { StatusChip } from "@/components/admin/status-chip";
import { AdminDrawer } from "@/components/admin/drawer";
import { exportToCSV } from "@/lib/admin/export";
import { type Customer } from "@/lib/admin/data";
import { compactInr, longDate, relTime } from "@/lib/admin/format";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/customers")({
  head: () => ({
    meta: [
      { title: "Customers — Admin · Ink Studio" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: CustomersPage,
});

const SEGMENTS = ["all", "vip", "returning", "new", "lapsed"] as const;

function CustomersPage() {
  const [seg, setSeg] = useState<(typeof SEGMENTS)[number]>("all");
  const [q, setQ] = useState("");
  const [active, setActive] = useState<Customer | null>(null);

  const [page, setPage] = useState(1);
  const pageSize = 15;

  const { data: response, isLoading } = useQuery<{ data: Customer[]; meta: { total: number; totalPages: number } }>({
    queryKey: ["admin-customers", page, q, seg],
    queryFn: () => apiClient.get(`/admin/customers?page=${page}&limit=${pageSize}&q=${encodeURIComponent(q)}&segment=${seg}`),
  });

  const baseList = response?.data || [];
  const meta = response?.meta || { total: 0, totalPages: 1 };

  const list = baseList;
  const totalSpend = baseList.reduce((s, c) => s + (c.spend || 0), 0); // Note: This will only be current page spend.

  const queryClient = useQueryClient();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-24 animate-pulse rounded border border-line bg-fog/20" />
        <div className="h-24 animate-pulse rounded border border-line bg-fog/20" />
        <div className="h-96 animate-pulse rounded border border-line bg-fog/20" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow={`${meta.total} customers`}
        title="Customers"
        description="Lifetime value, segments, support history and loyalty tiers."
        actions={
          <>
            <button 
              onClick={() => exportToCSV("customers", list)}
              className="press border border-line bg-paper px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-mute hover:border-ink hover:text-ink"
            >
              Export
            </button>
            <button className="press flex items-center gap-1.5 bg-ink px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-paper">
              <Mail className="h-3.5 w-3.5" /> Send campaign
            </button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MiniStat label="Total LTV" value={compactInr(totalSpend)} delta="+12.4%" />
        <MiniStat
          label="Avg orders"
          value={(baseList.reduce((s, c) => s + (c.orders || 0), 0) / (baseList.length || 1)).toFixed(1)}
        />
        <MiniStat label="Repeat rate" value="48%" delta="+3.2%" />
        <MiniStat
          label="VIP share"
          value={`${Math.round((baseList.filter((c) => c.vip).length / (baseList.length || 1)) * 100)}%`}
        />
      </div>

      <div className="flex flex-wrap items-center gap-1 border border-line bg-paper p-1">
        {SEGMENTS.map((s) => (
          <button
            key={s}
            onClick={() => setSeg(s)}
            className={`px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] transition ${seg === s ? "bg-ink text-paper" : "text-mute hover:text-ink"}`}
          >
            {s}
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
            placeholder="Search customers…"
            className="h-8 w-56 border border-line bg-paper pl-8 pr-3 text-[12px] outline-none focus:border-ink"
          />
        </label>
      </div>

      <Panel bodyClassName="p-0">
        <div className="overflow-x-auto w-full">
        <table className="w-full text-[13px]">
          <thead className="border-b border-line bg-fog/40 text-left">
            <tr className="text-[10px] font-mono uppercase tracking-[0.18em] text-mute">
              <th className="px-3 py-2.5 font-normal">Customer</th>
              <th className="px-3 py-2.5 font-normal">Segment</th>
              <th className="px-3 py-2.5 font-normal">Loyalty</th>
              <th className="px-3 py-2.5 text-right font-normal">Orders</th>
              <th className="px-3 py-2.5 text-right font-normal">Spend</th>
              <th className="px-3 py-2.5 font-normal">Last order</th>
              <th className="px-3 py-2.5 font-normal">City</th>
            </tr>
          </thead>
          <tbody>
            {list.map((c) => (
              <tr
                key={c.id}
                onClick={() => setActive(c)}
                className="cursor-pointer border-b border-line/60 transition hover:bg-fog/40"
              >
                <td className="px-3 py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-[10px] font-medium text-paper">
                      {(c.name || "Unknown")
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)}
                    </span>
                    <div>
                      <p className="flex items-center gap-1.5 text-ink">
                        {c.name}
                        {c.vip && <Crown className="h-3 w-3 text-accent" aria-label="VIP" />}
                      </p>
                      <p className="text-[11px] text-mute">{c.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3">
                  <StatusChip
                    label={c.segment}
                    tone={c.segment === "vip" ? "warn" : c.segment === "lapsed" ? "muted" : "info"}
                  />
                </td>
                <td className="px-3 py-3">
                  <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-mute">
                    {c.loyalty}
                  </span>
                </td>
                <td className="px-3 py-3 text-right font-mono tabular-nums">{c.orders}</td>
                <td className="px-3 py-3 text-right font-mono tabular-nums">
                  {compactInr(c.spend)}
                </td>
                <td className="px-3 py-3 text-mute">{relTime(c.lastOrderAt)}</td>
                <td className="px-3 py-3 text-mute">{c.city}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {meta.total > pageSize && (
          <div className="flex items-center justify-between border-t border-line bg-fog/20 px-4 py-3 text-[12px]">
            <p className="text-mute">
              Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, meta.total)} of {meta.total} customers
            </p>
            <div className="flex gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                className="border border-line bg-paper px-3 py-1 text-mute hover:text-ink disabled:opacity-50"
              >
                Previous
              </button>
              <button
                disabled={page >= meta.totalPages}
                onClick={() => setPage(p => p + 1)}
                className="border border-line bg-paper px-3 py-1 text-mute hover:text-ink disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </Panel>

      <AdminDrawer
        open={!!active}
        onClose={() => setActive(null)}
        eyebrow={active ? `Customer · ${active.id}` : ""}
        title={active?.name ?? ""}
        width={560}
      >
        {active && <CustomerDetail customer={active} />}
      </AdminDrawer>
    </div>
  );
}

function CustomerDetail({ customer }: { customer: Customer }) {
  const queryClient = useQueryClient();
  const notesMutation = useMutation({
    mutationFn: async ({ id, note }: { id: string, note: string }) => apiClient.post(`/admin/customers/${id}/notes`, { note }),
    onSuccess: () => {
      toast.success("Note added successfully");
      queryClient.invalidateQueries({ queryKey: ["admin-customers"] });
    }
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        {customer.vip && <StatusChip label="VIP" tone="warn" />}
        <StatusChip label={customer.segment} tone="info" />
        <StatusChip label={`${customer.loyalty} tier`} tone="muted" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <MiniStat label="Lifetime spend" value={compactInr(customer.spend)} />
        <MiniStat label="Orders" value={String(customer.orders)} />
        <MiniStat label="Joined" value={longDate(customer.joinedAt)} />
        <MiniStat label="Last order" value={relTime(customer.lastOrderAt)} />
      </div>

      <section>
        <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-mute">Contact</p>
        <div className="mt-2 space-y-1 text-[13px]">
          <p className="text-ink">{customer.email}</p>
          <p className="text-mute">{customer.phone}</p>
          <p className="text-mute">{customer.city}, India</p>
        </div>
      </section>

      <section>
        <p className="flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.22em] text-mute">
          Internal Notes
        </p>
        <div className="mt-2 space-y-3">
          <p className="border border-line bg-fog/40 p-3 text-[13px] text-ink">
            {customer.notes ?? "No notes yet. Add internal observations, sizing preferences, or stylist references."}
          </p>
          <div>
            <textarea
              placeholder="Add a new note…"
              rows={3}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  const note = e.currentTarget.value;
                  if (note.trim()) {
                    notesMutation.mutate({ id: customer.id, note });
                    e.currentTarget.value = '';
                  }
                }
              }}
              disabled={notesMutation.isPending}
              className="w-full resize-none border border-line bg-paper p-3 text-[13px] outline-none focus:border-ink disabled:opacity-50"
            />
            <p className="text-[10px] text-mute mt-1">Press Enter to save.</p>
          </div>
        </div>
      </section>

      <section>
        <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-mute">
          Support history
        </p>
        <div className="mt-2 flex items-center justify-between border border-line bg-paper p-3">
          <p className="inline-flex items-center gap-2 text-[13px]">
            <MessageSquare className="h-3.5 w-3.5 text-mute" />
            {customer.supportTickets} ticket{customer.supportTickets === 1 ? "" : "s"} on record
          </p>
          <button className="font-mono text-[10px] uppercase tracking-[0.18em] text-mute hover:text-ink">
            View
          </button>
        </div>
      </section>

      <section>
        <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-mute">Segmentation</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {["High-LTV", "Anime fan", "Mumbai", (customer.loyalty || "").toUpperCase()].map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1 border border-line bg-paper px-2 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-mute"
            >
              <Tag className="h-3 w-3" /> {t}
            </span>
          ))}
          <button className="inline-flex items-center gap-1 border border-dashed border-line px-2 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-mute hover:border-ink hover:text-ink">
            <Sparkles className="h-3 w-3" /> Add tag
          </button>
        </div>
      </section>
    </div>
  );
}

function MiniStat({ label, value, delta }: { label: string; value: string; delta?: string }) {
  return (
    <div className="border border-line bg-paper p-3">
      <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-mute">{label}</p>
      <p className="mt-1 font-display text-2xl tabular-nums text-ink">{value}</p>
      {delta && <p className="font-mono text-[10px] tabular-nums text-mute">{delta}</p>}
    </div>
  );
}
