import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Check,
  ChevronDown,
  Download,
  Filter,
  Mail,
  PackageCheck,
  Printer,
  RotateCcw,
  Search,
  Truck,
} from "lucide-react";
import { SectionHeader, Panel } from "@/components/admin/section-header";
import { StatusChip, orderTone } from "@/components/admin/status-chip";
import { AdminDrawer } from "@/components/admin/drawer";
import { exportToCSV } from "@/lib/admin/export";
import type { Order, OrderStatus } from "@/lib/admin/data";
import { compactInr, inr, longDate, relTime } from "@/lib/admin/format";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";

export const Route = createFileRoute("/admin/orders")({
  head: () => ({
    meta: [
      { title: "Orders — Admin · Ink Studio" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: OrdersPage,
});

const STATUSES: ("all" | OrderStatus)[] = [
  "all",
  "pending",
  "paid",
  "fulfilled",
  "shipped",
  "delivered",
  "refunded",
];
const FULFILL_STEPS = [
  "received",
  "picked",
  "packed",
  "shipped",
  "out_for_delivery",
  "delivered",
] as const;
const FULFILL_LABEL: Record<string, string> = {
  received: "Order received",
  picked: "Picked",
  packed: "Packed",
  shipped: "Shipped",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
};

function OrdersPage() {
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("all");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [active, setActive] = useState<Order | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [manualOrder, setManualOrder] = useState({ email: '', items: [] as { id: string, qty: number }[], total: 0 });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const queryClient = useQueryClient();
  const { data: ALL_ORDERS = [], isLoading } = useQuery<Order[]>({
    queryKey: ["admin-orders"],
    queryFn: async () => {
      const res = await apiClient.get<Order[]>("/admin/orders");
      return res;
    },
  });

  useEffect(() => {
    setPage(1);
  }, [status, q]);

  const list = useMemo(
    () => {
      return ALL_ORDERS.filter((o) => {
        if (status !== "all" && o.status !== status) return false;
        if (q) {
          const s = q.toLowerCase();
          if (!(o.number || "").toLowerCase().includes(s) && !(o.customer?.name || "").toLowerCase().includes(s) && !(o.customer?.email || "").toLowerCase().includes(s)) {
            return false;
          }
        }
        return true;
      });
    }, [ALL_ORDERS, status, q]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: ALL_ORDERS.length };
    for (const s of STATUSES.slice(1)) c[s] = ALL_ORDERS.filter((o) => o.status === s).length;
    return c;
  }, [ALL_ORDERS]);

  const toggle = (id: string) =>
    setSelected((arr) => (arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]));

  const allSelected = list.length > 0 && list.every((o) => selected.includes(o.id));
  const toggleAll = () => setSelected(allSelected ? [] : list.map((o) => o.id));

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-24 animate-pulse rounded border border-line bg-fog/20" />
        <div className="h-12 animate-pulse rounded border border-line bg-fog/20" />
        <div className="h-96 animate-pulse rounded border border-line bg-fog/20" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow={`${ALL_ORDERS.length} orders · Last 30 days`}
        title="Orders"
        description="Fulfillment, payments, refunds and returns in one view."
        actions={
          <>
            <button 
              onClick={() => exportToCSV("orders", list)}
              className="press flex items-center gap-2 border border-line bg-paper px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-mute transition hover:border-ink hover:text-ink"
            >
              <Download className="h-3.5 w-3.5" /> Export
            </button>
            <button 
              onClick={() => setIsCreating(true)}
              className="press bg-ink px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-paper"
            >
              + Manual order
            </button>
          </>
        }
      />

      {/* Status tabs */}
      <div className="flex flex-wrap items-center gap-1 border border-line bg-paper p-1">
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`flex items-center gap-2 px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] transition ${status === s ? "bg-ink text-paper" : "text-mute hover:text-ink"}`}
          >
            <span>{s}</span>
            <span className="font-mono tabular-nums opacity-70">{counts[s] ?? 0}</span>
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2 pr-1">
          <label className="relative">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-mute"
              aria-hidden="true"
            />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search orders…"
              className="h-8 w-56 border border-line bg-paper pl-8 pr-3 text-[12px] outline-none transition placeholder:text-mute focus:border-ink"
            />
          </label>
          <button className="flex h-8 items-center gap-1.5 border border-line bg-paper px-2.5 text-[11px] uppercase tracking-[0.18em] text-mute transition hover:border-ink hover:text-ink">
            <Filter className="h-3.5 w-3.5" /> Filters <ChevronDown className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.length > 0 && (
        <div className="sticky top-14 z-20 flex items-center justify-between border border-ink bg-ink px-4 py-2.5 text-paper">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em]">
            {selected.length} selected
          </p>
          <div className="flex items-center gap-2">
            <BulkBtn icon={<Printer className="h-3.5 w-3.5" />} onClick={() => toast.success('Labels sent to printer')}>Print labels</BulkBtn>
            <BulkBtn 
              icon={<Truck className="h-3.5 w-3.5" />}
              onClick={() => {
                Promise.all(selected.map(id => apiClient.put(`/admin/orders/${id}/status`, { status: 'SHIPPED' })))
                  .then(() => {
                    toast.success(`Marked ${selected.length} orders as shipped`);
                    queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
                    setSelected([]);
                  })
                  .catch(() => toast.error('Failed to update orders'));
              }}
            >Mark shipped</BulkBtn>
            <BulkBtn icon={<Mail className="h-3.5 w-3.5" />} onClick={() => toast.success('Emails queued')}>Email customers</BulkBtn>
            <button
              onClick={() => setSelected([])}
              className="font-mono text-[10px] uppercase tracking-[0.2em] text-paper/70 hover:text-paper"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      <Panel bodyClassName="p-0">
        {list.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-mute">
            <Search className="mb-4 h-8 w-8 opacity-20" />
            <p className="text-[13px]">No orders found matching your criteria.</p>
          </div>
        ) : (
        <div className="overflow-x-auto w-full">
        <table className="w-full text-[13px]">
          <thead className="border-b border-line bg-fog/40 text-left">
            <tr className="text-[10px] font-mono uppercase tracking-[0.18em] text-mute">
              <th className="w-10 px-3 py-2.5">
                <Checkbox checked={allSelected} onChange={toggleAll} aria-label="Select all" />
              </th>
              <th className="px-3 py-2.5 font-normal">Order</th>
              <th className="px-3 py-2.5 font-normal">Customer</th>
              <th className="px-3 py-2.5 font-normal">Status</th>
              <th className="px-3 py-2.5 font-normal">Fulfillment</th>
              <th className="px-3 py-2.5 font-normal">Payment</th>
              <th className="px-3 py-2.5 font-normal">Channel</th>
              <th className="px-3 py-2.5 text-right font-normal">Total</th>
            </tr>
          </thead>
          <tbody>
            {list.slice((page - 1) * pageSize, page * pageSize).map((o) => (
              <tr
                key={o.id}
                onClick={() => setActive(o)}
                className="cursor-pointer border-b border-line/60 transition hover:bg-fog/40"
              >
                <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selected.includes(o.id)}
                    onChange={() => toggle(o.id)}
                    aria-label={`Select ${o.number}`}
                  />
                </td>
                <td className="px-3 py-3">
                  <p className="font-mono text-[12px] text-ink">{o.number}</p>
                  <p className="text-[11px] text-mute">{relTime(o.createdAt)}</p>
                </td>
                <td className="px-3 py-3">
                  <p className="text-ink">{o.customer.name}</p>
                  <p className="text-[11px] text-mute">{o.city}</p>
                </td>
                <td className="px-3 py-3">
                  <div className="flex flex-col items-start gap-1">
                    <StatusChip label={o.status} tone={orderTone(o.status)} />
                    {o.refundRequested && <StatusChip label="Refund requested" tone="warn" />}
                    {o.returnRequested && <StatusChip label="Return open" tone="info" />}
                  </div>
                </td>
                <td className="px-3 py-3 font-mono text-[11px] uppercase tracking-[0.16em] text-mute">
                  {FULFILL_LABEL[o.fulfillment]}
                </td>
                <td className="px-3 py-3 font-mono text-[11px] uppercase tracking-[0.16em] text-mute">
                  {o.payment}
                </td>
                <td className="px-3 py-3 font-mono text-[11px] uppercase tracking-[0.16em] text-mute">
                  {o.channel}
                </td>
                <td className="px-3 py-3 text-right font-mono tabular-nums">
                  {compactInr(o.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        )}
        {list.length > pageSize && (
          <div className="flex items-center justify-between border-t border-line bg-fog/20 px-4 py-3 text-[12px]">
            <p className="text-mute">
              Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, list.length)} of {list.length} orders
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
                disabled={page * pageSize >= list.length}
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
        eyebrow={active ? `${longDate(active.createdAt)}` : ""}
        title={active ? `Order ${active.number}` : ""}
        footer={
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-col gap-1">
              <button 
                onClick={() => {
                   if (!window.confirm("Are you sure you want to cancel this order? This action cannot be undone.")) return;
                   apiClient.put(`/admin/orders/${active?.id}/status`, { status: 'CANCELLED' }).then(() => {
                     toast.success('Order cancelled');
                     queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
                     setActive(null);
                   }).catch((err) => { toast.error('Failed to cancel order'); });
                }}
                className="press flex items-center gap-1.5 border border-line bg-paper px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-mute hover:border-ink hover:text-ink"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Cancel / Refund
              </button>
              {active?.paymentProvider === "RAZORPAY" && active?.status !== "FAILED" && active?.status !== "PAYMENT_PENDING" && (
                <p className="text-[9px] text-accent max-w-[150px] leading-tight">
                  Warning: Does not auto-refund via Razorpay.
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => window.print()}
                className="press border border-line bg-paper px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-mute hover:border-ink hover:text-ink"
              >
                Print invoice
              </button>
              <button 
                onClick={() => {
                  apiClient.put(`/admin/orders/${active?.id}/status`, { status: 'SHIPPED' }).then(() => {
                    toast.success('Order marked as shipped');
                    queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
                    setActive(null);
                  }).catch((err) => { toast.error('Failed to fulfill order'); });
                }}
                className="press flex items-center gap-1.5 bg-ink px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-paper"
              >
                <PackageCheck className="h-3.5 w-3.5" /> Fulfill
              </button>
            </div>
          </div>
        }
      >
        {active && <OrderDetail order={active} />}
      </AdminDrawer>

      <AdminDrawer
        open={isCreating}
        onClose={() => setIsCreating(false)}
        eyebrow="Manual POS"
        title="Create Order"
        footer={
          <div className="flex justify-end gap-2">
            <button 
              onClick={() => {
                setIsCreating(false);
                setManualOrder({ email: '', items: [], total: 0 });
              }}
              className="press border border-line bg-paper px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-mute hover:border-ink hover:text-ink"
            >
              Cancel
            </button>
            <button 
              disabled={isSubmitting}
              onClick={() => {
                setIsSubmitting(true);
                apiClient.post(`/admin/orders`, manualOrder).then(() => {
                  toast.success('Order created');
                  queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
                  setIsCreating(false);
                  setManualOrder({ email: '', items: [], total: 0 });
                }).catch(() => toast.error('Failed to create manual order'))
                  .finally(() => setIsSubmitting(false));
              }}
              className="press bg-ink px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-paper disabled:opacity-50"
            >
              {isSubmitting ? "Submitting..." : "Submit Order"}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="text-[12px] text-mute">Customer Email</label>
            <input 
              value={manualOrder.email} 
              onChange={e => setManualOrder(m => ({...m, email: e.target.value}))}
              className="mt-1 h-9 w-full border border-line bg-paper px-3 text-[13px] outline-none focus:border-ink" 
            />
          </div>
          <div>
            <label className="text-[12px] text-mute">Items</label>
            <div className="space-y-2 mt-1">
              {manualOrder.items.map((item: any, i: number) => (
                <div key={i} className="flex gap-2">
                  <input value={item.id} onChange={e => { const n = [...manualOrder.items]; n[i].id = e.target.value; setManualOrder(m => ({...m, items: n}))}} placeholder="Product ID / SKU" className="h-9 w-full border border-line bg-paper px-3 text-[13px] outline-none focus:border-ink" />
                  <input type="number" value={item.qty} onChange={e => { const n = [...manualOrder.items]; n[i].qty = Number(e.target.value); setManualOrder(m => ({...m, items: n}))}} placeholder="Qty" className="h-9 w-24 border border-line bg-paper px-3 text-[13px] outline-none focus:border-ink tabular-nums" />
                  <button onClick={() => setManualOrder(m => ({...m, items: m.items.filter((_, idx) => idx !== i)}))} className="text-accent hover:opacity-70 px-2">✕</button>
                </div>
              ))}
              <button onClick={() => setManualOrder(m => ({...m, items: [...m.items, { id: "", qty: 1 }]}))} className="press border border-dashed border-line bg-fog/20 px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-mute hover:border-ink hover:text-ink w-full">+ Add Item</button>
            </div>
          </div>
          <div>
            <label className="text-[12px] text-mute">Total Amount</label>
            <input 
              type="number"
              value={manualOrder.total} 
              onChange={e => setManualOrder(m => ({...m, total: Number(e.target.value)}))}
              className="mt-1 h-9 w-full border border-line bg-paper px-3 text-[13px] outline-none focus:border-ink tabular-nums" 
            />
          </div>
        </div>
      </AdminDrawer>
    </div>
  );
}

function OrderDetail({ order }: { order: Order }) {
  const currentStep = FULFILL_STEPS.indexOf(order.fulfillment);
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <StatusChip label={order.status} tone={orderTone(order.status)} />
        <StatusChip label={`${order.payment} · paid`} tone="info" />
        {order.refundRequested && <StatusChip label="Refund requested" tone="warn" />}
      </div>

      {/* Fulfillment timeline */}
      <section>
        <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-mute">
          Fulfillment timeline
        </p>
        <ol className="mt-3 space-y-3">
          {FULFILL_STEPS.map((step, i) => {
            const done = i <= currentStep;
            const current = i === currentStep;
            return (
              <li key={step} className="flex items-start gap-3">
                <span
                  className={`mt-0.5 flex h-5 w-5 items-center justify-center border text-[10px] ${done ? "border-ink bg-ink text-paper" : "border-line text-mute"}`}
                >
                  {done ? <Check className="h-3 w-3" /> : i + 1}
                </span>
                <div className="flex-1">
                  <p className={`text-[13px] ${done ? "text-ink" : "text-mute"}`}>
                    {FULFILL_LABEL[step]}
                  </p>
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-mute">
                    {current ? "In progress" : done ? "Completed" : "Pending"}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      {/* Items */}
      <section>
        <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-mute">
          Items · {order.items?.length || 0}
        </p>
        <ul className="mt-3 divide-y divide-line/60 border border-line">
          {(order.items || []).map((it, idx) => (
            <li key={idx} className="flex gap-3 p-3">
              <img src={it.image} alt="" className="h-14 w-12 object-cover" />
              <div className="flex-1">
                <p className="text-[13px] text-ink">{it.name}</p>
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-mute">
                  {it.sku} · ×{it.qty}
                </p>
              </div>
              <p className="font-mono text-[12px] tabular-nums">{inr(it.price * it.qty)}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Totals + customer */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="border border-line p-4">
          <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-mute">Customer</p>
          <p className="mt-2 text-[14px] text-ink">{order.customer?.name}</p>
          <p className="text-[12px] text-mute">{order.customer?.email}</p>
          <p className="mt-3 text-[12px] text-mute">
            Ships to <span className="text-ink">{order.city}, IN</span>
          </p>
        </div>
        <div className="border border-line p-4">
          <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-mute">Totals</p>
          <dl className="mt-2 space-y-1.5 text-[12px]">
            <Row label="Subtotal" value={inr(order.total)} />
            <Row label="Shipping" value="Free" />
            <Row label="Tax" value="Included" />
            <div className="mt-2 flex items-baseline justify-between border-t border-line pt-2 text-ink">
              <dt className="text-[11px] uppercase tracking-[0.22em] text-mute">Total</dt>
              <dd className="font-mono text-lg tabular-nums">{inr(order.total)}</dd>
            </div>
          </dl>
        </div>
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-mute">{label}</dt>
      <dd className="font-mono tabular-nums text-ink">{value}</dd>
    </div>
  );
}

function Checkbox({ checked, onChange, ...rest }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="checkbox"
      checked={checked as boolean}
      onChange={onChange}
      className="h-3.5 w-3.5 cursor-pointer accent-ink"
      {...rest}
    />
  );
}

function BulkBtn({ children, icon, onClick }: { children: React.ReactNode; icon: React.ReactNode; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1.5 border border-paper/20 px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] text-paper transition hover:bg-paper/10">
      {icon}
      {children}
    </button>
  );
}
