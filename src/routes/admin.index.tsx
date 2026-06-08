import { createFileRoute, Link } from "@tanstack/react-router";
import { Activity, AlertTriangle, ArrowUpRight, Eye, Sparkles } from "lucide-react";
import { KpiCard } from "@/components/admin/kpi-card";
import { Panel, SectionHeader } from "@/components/admin/section-header";
import { AreaChart, BarRow } from "@/components/admin/charts";
import { StatusChip, orderTone } from "@/components/admin/status-chip";
import {
  kpis as mockKpis,
  liveActivity as mockActivity,
  orders,
  products as mockProducts,
  revenueSeries,
  topCategories,
  trafficSources,
} from "@/lib/admin/data";
import { compactInr, relTime } from "@/lib/admin/format";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { useAuthStore } from "@/lib/store/auth";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Overview — Admin · Ink Studio" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: OverviewPage,
});

function OverviewPage() {
  const { data: kpisData } = useQuery<any>({
    queryKey: ["admin-kpis"],
    queryFn: () => apiClient.get("/admin/dashboard/kpis"),
  });
  const { data: activityData = [] } = useQuery<any[]>({
    queryKey: ["admin-activity"],
    queryFn: () => apiClient.get("/admin/dashboard/activity"),
    refetchInterval: 5000,
  });
  const { data: products = [] } = useQuery<any[]>({
    queryKey: ["admin-products"],
    queryFn: () => apiClient.get("/admin/catalog/products"),
  });
  const { data: apiOrders = [] } = useQuery<any[]>({
    queryKey: ["admin-orders"],
    queryFn: () => apiClient.get("/admin/orders"),
  });

  const recent = (apiOrders.length > 0 ? apiOrders : orders).slice(0, 6);
  const lowStock = (products.length > 0 ? products : mockProducts).filter((p: any) => p.stock > 0 && p.stock <= p.lowStockAt).slice(0, 5);
  const trending = [...(products.length > 0 ? products : mockProducts)].sort((a: any, b: any) => (b.views7d || 0) - (a.views7d || 0)).slice(0, 5);
  const liveActivity = activityData.length > 0 ? activityData : mockActivity;

  const adminName = useAuthStore((s) => s.user?.email?.split('@')[0] ?? 'Admin');
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Operations · Last 14 days"
        title={`${greeting}, ${adminName}.`}
        description="A snapshot of today's storefront performance, fulfillment status, and live activity."
        actions={
          <>
            <button className="press border border-line bg-paper px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-mute transition hover:border-ink hover:text-ink">
              Export
            </button>
            <button className="press bg-ink px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-paper transition hover:bg-graphite">
              New report
            </button>
          </>
        }
      />

      {/* KPI grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(kpisData ? [
          { label: 'Revenue', value: kpisData.totalRevenue ? '₹' + (kpisData.totalRevenue / 100000).toFixed(2) + 'L' : '₹0', delta: 0, spark: mockKpis[0].spark, hint: "Last 14 days" },
          { label: 'Orders', value: String(kpisData.totalOrders ?? 0), delta: 0, spark: mockKpis[1].spark, hint: "Last 14 days" },
          ...mockKpis.slice(2)
        ] : mockKpis).map((k: any) => (
          <KpiCard key={k.label} {...k} />
        ))}
      </div>

      {/* Revenue + sources */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.6fr_1fr]">
        <Panel
          title="Revenue · 30 days"
          action={
            <div className="flex items-center gap-3 text-[10px] font-mono uppercase tracking-[0.2em] text-mute">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-3 bg-ink" /> Revenue
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-3 bg-mute/50" /> Orders
              </span>
            </div>
          }
        >
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-mute">
                Total revenue
              </p>
              <p className="mt-1 font-display text-4xl tabular-nums">
                {compactInr(revenueSeries.reduce((s, d) => s + d.revenue, 0))}
              </p>
              <p className="mt-1 inline-flex items-center gap-1 font-mono text-[11px] tabular-nums text-ink">
                <ArrowUpRight className="h-3 w-3" /> 18.4% vs last 30
              </p>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-right">
              <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-mute">Orders</p>
              <p className="font-mono text-[12px] tabular-nums">
                {revenueSeries.reduce((s, d) => s + d.orders, 0)}
              </p>
              <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-mute">
                Avg / day
              </p>
              <p className="font-mono text-[12px] tabular-nums">
                {compactInr(
                  Math.round(
                    revenueSeries.reduce((s, d) => s + d.revenue, 0) / revenueSeries.length,
                  ),
                )}
              </p>
            </div>
          </div>
          <div className="mt-4">
            <AreaChart data={revenueSeries} yKey="revenue" height={220} />
          </div>
        </Panel>

        <Panel title="Traffic · Sources">
          <BarRow
            rows={trafficSources.map((s) => ({
              name: s.source,
              value: s.visits,
              sub: `${s.visits.toLocaleString("en-IN")} · ${s.pct}%`,
            }))}
          />
          <div className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-4">
            <Stat label="Visitors" value="48,460" />
            <Stat label="Sessions" value="62,180" />
            <Stat label="Bounce" value="38%" />
          </div>
        </Panel>
      </div>

      {/* Recent orders + Live activity */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.6fr_1fr]">
        <Panel
          title="Recent orders"
          action={
            <Link
              to="/admin/orders"
              className="font-mono text-[10px] uppercase tracking-[0.22em] text-mute hover:text-ink"
            >
              View all →
            </Link>
          }
          bodyClassName="p-0"
        >
          <table className="w-full text-[13px]">
            <thead className="border-b border-line bg-fog/40 text-left">
              <tr className="text-[10px] font-mono uppercase tracking-[0.18em] text-mute">
                <th className="px-4 py-2.5 font-normal">Order</th>
                <th className="px-4 py-2.5 font-normal">Customer</th>
                <th className="px-4 py-2.5 font-normal">Status</th>
                <th className="px-4 py-2.5 text-right font-normal">Total</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((o) => (
                <tr key={o.id} className="border-b border-line/60 transition hover:bg-fog/30">
                  <td className="px-4 py-3">
                    <p className="font-mono text-[12px] text-ink">{o.number}</p>
                    <p className="text-[11px] text-mute">{relTime(o.createdAt)}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="truncate text-ink">{o.customer.name}</p>
                    <p className="truncate text-[11px] text-mute">{o.customer.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <StatusChip label={o.status} tone={orderTone(o.status)} />
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">
                    {compactInr(o.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel
          title="Live activity"
          action={
            <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-mute">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" /> Realtime
            </span>
          }
        >
          <ol className="space-y-3">
            {liveActivity.map((a) => (
              <li
                key={a.id}
                className="flex gap-3 border-b border-line/60 pb-3 last:border-0 last:pb-0"
              >
                <span
                  className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-ink/60"
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] text-ink">{a.text}</p>
                  <p className="text-[11px] text-mute">{a.meta}</p>
                </div>
                <p className="shrink-0 font-mono text-[10px] uppercase tracking-[0.2em] text-mute">
                  {a.time}
                </p>
              </li>
            ))}
          </ol>
        </Panel>
      </div>

      {/* Categories + Low stock + Trending */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Panel title="Top categories">
          <BarRow
            rows={topCategories.map((c) => ({
              name: c.name,
              value: c.revenue,
              sub: `${compactInr(c.revenue)} · ${c.units} units`,
            }))}
          />
        </Panel>

        <Panel
          title="Low stock"
          action={<StatusChip label={`${lowStock.length} alerts`} tone="warn" />}
        >
          {lowStock.length === 0 ? (
            <p className="py-6 text-center text-sm text-mute">Stock levels healthy.</p>
          ) : (
            <ul className="space-y-2.5">
              {lowStock.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center gap-3 border-b border-line/60 pb-2.5 last:border-0 last:pb-0"
                >
                  <img src={p.image} alt="" className="h-10 w-10 object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] text-ink">{p.name}</p>
                    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-mute">
                      {p.sku}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="inline-flex items-center gap-1 font-mono text-[12px] tabular-nums text-accent">
                      <AlertTriangle className="h-3 w-3" />
                      {p.stock}
                    </p>
                    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-mute">
                      left
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="Trending products"
          action={
            <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.2em] text-mute">
              <Sparkles className="h-3 w-3" /> 7d
            </span>
          }
        >
          <ul className="space-y-2.5">
            {trending.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-3 border-b border-line/60 pb-2.5 last:border-0 last:pb-0"
              >
                <img src={p.image} alt="" className="h-10 w-10 object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] text-ink">{p.name}</p>
                  <p className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-mute">
                    <span className="inline-flex items-center gap-1">
                      <Eye className="h-3 w-3" />
                      {p.views7d.toLocaleString("en-IN")}
                    </span>
                    <span>·</span>
                    <span>{p.conversion.toFixed(1)}%</span>
                  </p>
                </div>
                <p className="font-mono text-[12px] tabular-nums text-ink">{p.units7d}</p>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      {/* Bottom strip */}
      <Panel title="System">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Stat label="Uptime" value="99.98%" />
          <Stat label="Latency p95" value="184ms" />
          <Stat label="Fulfillment SLA" value="98.4%" />
          <Stat
            label="Active drops"
            value="1"
            hint={
              <span className="inline-flex items-center gap-1 font-mono text-[10px] text-mute">
                <Activity className="h-3 w-3" /> Live
              </span>
            }
          />
        </div>
      </Panel>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-mute">{label}</p>
      <p className="mt-1 font-display text-2xl tabular-nums text-ink">{value}</p>
      {hint && <div className="mt-0.5">{hint}</div>}
    </div>
  );
}
