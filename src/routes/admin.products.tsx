import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  CalendarClock,
  Eye,
  EyeOff,
  Filter,
  Layers,
  Plus,
  Search,
  Star,
} from "lucide-react";
import { SectionHeader, Panel } from "@/components/admin/section-header";
import { StatusChip } from "@/components/admin/status-chip";
import { AdminDrawer } from "@/components/admin/drawer";
import { exportToCSV } from "@/lib/admin/export";
import { type Product } from "@/lib/admin/data";
import { compactInr, inr } from "@/lib/admin/format";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";

export const Route = createFileRoute("/admin/products")({
  head: () => ({
    meta: [
      { title: "Products — Admin · Ink Studio" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: ProductsPage,
});

const STATUS_TONE = {
  active: "positive",
  draft: "muted",
  scheduled: "info",
  archived: "muted",
} as const;

function ProductsPage() {
  const [q, setQ] = useState("");
  const [view, setView] = useState<"table" | "grid">("table");
  const [active, setActive] = useState<Product | null>(null);
  const [edits, setEdits] = useState<Partial<Product>>({});
  const [isCreating, setIsCreating] = useState(false);
  const [newProduct, setNewProduct] = useState<Partial<Product>>({ status: 'draft', visible: false, variants: 0, stock: 0 });
  const [page, setPage] = useState(1);
  const pageSize = 15;

  useEffect(() => {
    setEdits({});
  }, [active]);

  const queryClient = useQueryClient();
  const { data: ALL = [], isLoading } = useQuery<Product[]>({
    queryKey: ["admin-products"],
    queryFn: async () => {
      const res = await apiClient.get<Product[]>("/admin/catalog/products");
      return res;
    },
  });

  const list = useMemo(
    () => {
      setPage(1);
      return ALL.filter(
        (p) =>
          !q ||
          p.name.toLowerCase().includes(q.toLowerCase()) ||
          p.sku.toLowerCase().includes(q.toLowerCase()),
      );
    },
    [ALL, q],
  );

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
        eyebrow={`${ALL.length} products · ${ALL.filter((p) => p.status === "active").length} active`}
        title="Products"
        description="Catalog, inventory, variants, scheduling and merchandising."
        actions={
          <>
            <button 
              onClick={() => exportToCSV("products", list)}
              className="press border border-line bg-paper px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-mute hover:border-ink hover:text-ink"
            >
              Export CSV
            </button>
            <button className="press border border-line bg-paper px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-mute hover:border-ink hover:text-ink">
              Import CSV
            </button>
            <button 
              onClick={() => setIsCreating(true)}
              className="press flex items-center gap-1.5 bg-ink px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-paper"
            >
              <Plus className="h-3.5 w-3.5" /> New product
            </button>
          </>
        }
      />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border border-line bg-paper p-2">
        <label className="relative">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-mute"
            aria-hidden="true"
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name or SKU…"
            className="h-8 w-72 border border-line bg-paper pl-8 pr-3 text-[12px] outline-none focus:border-ink"
          />
        </label>
        <button className="flex h-8 items-center gap-1.5 border border-line px-2.5 text-[11px] uppercase tracking-[0.18em] text-mute hover:border-ink hover:text-ink">
          <Filter className="h-3.5 w-3.5" /> Filters
        </button>
        <button className="flex h-8 items-center gap-1.5 border border-line px-2.5 text-[11px] uppercase tracking-[0.18em] text-mute hover:border-ink hover:text-ink">
          <Layers className="h-3.5 w-3.5" /> Collection
        </button>
        <div className="ml-auto inline-flex h-8 items-center border border-line">
          <button
            onClick={() => setView("table")}
            className={`px-3 text-[11px] uppercase tracking-[0.18em] ${view === "table" ? "bg-ink text-paper" : "text-mute"}`}
          >
            Table
          </button>
          <button
            onClick={() => setView("grid")}
            className={`px-3 text-[11px] uppercase tracking-[0.18em] ${view === "grid" ? "bg-ink text-paper" : "text-mute"}`}
          >
            Grid
          </button>
        </div>
      </div>

      {view === "table" ? (
        <Panel bodyClassName="p-0">
          {list.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-mute">
              <Search className="mb-4 h-8 w-8 opacity-20" />
              <p className="text-[13px]">No products found matching your search.</p>
            </div>
          ) : (
          <div className="overflow-x-auto w-full">
          <table className="w-full text-[13px]">
            <thead className="border-b border-line bg-fog/40 text-left">
              <tr className="text-[10px] font-mono uppercase tracking-[0.18em] text-mute">
                <th className="px-3 py-2.5 font-normal">Product</th>
                <th className="px-3 py-2.5 font-normal">SKU</th>
                <th className="px-3 py-2.5 font-normal">Status</th>
                <th className="px-3 py-2.5 text-right font-normal">Price</th>
                <th className="px-3 py-2.5 text-right font-normal">Stock</th>
                <th className="px-3 py-2.5 text-right font-normal">7d units</th>
                <th className="px-3 py-2.5 text-right font-normal">CR</th>
                <th className="px-3 py-2.5 font-normal"></th>
              </tr>
            </thead>
            <tbody>
              {list.slice((page - 1) * pageSize, page * pageSize).map((p) => {
                const low = p.stock > 0 && p.stock <= p.lowStockAt;
                const oos = p.stock === 0 && p.status === "active";
                return (
                  <tr
                    key={p.id}
                    onClick={() => setActive(p)}
                    className="cursor-pointer border-b border-line/60 transition hover:bg-fog/40"
                  >
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 shrink-0 bg-fog">
                          <img src={p.image || "https://placehold.co/400x500/f5f3ee/0d0d0d?text=No+Image"} alt="" className="h-10 w-10 object-cover" />
                        </div>
                        <div className="min-w-0">
                          <p className="flex items-center gap-1.5 truncate text-ink">
                            {p.name}
                            {p.featured && (
                              <Star className="h-3 w-3 text-accent" aria-label="Featured" />
                            )}
                          </p>
                          <p className="text-[11px] text-mute">
                            {p.collection} · {p.variants} variants
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 font-mono text-[11px] uppercase tracking-[0.16em] text-mute">
                      {p.sku}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-col items-start gap-1">
                        <StatusChip label={p.status} tone={STATUS_TONE[p.status]} />
                        {p.scheduledFor && (
                          <StatusChip label={`Live ${p.scheduledFor.slice(0, 10)}`} tone="info" />
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <p className="font-mono tabular-nums">{inr(p.price)}</p>
                      {p.compareAt && (
                        <p className="font-mono text-[10px] text-mute line-through">
                          {inr(p.compareAt)}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <p
                        className={`font-mono tabular-nums ${oos ? "text-accent" : low ? "text-accent" : "text-ink"}`}
                      >
                        {p.stock}
                      </p>
                      {oos ? (
                        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">
                          Sold out
                        </p>
                      ) : low ? (
                        <p className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.18em] text-accent">
                          <AlertTriangle className="h-2.5 w-2.5" />
                          Low
                        </p>
                      ) : (
                        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-mute">
                          In stock
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums">{p.units7d || 0}</td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums text-mute">
                      {(p.conversion || 0).toFixed(1)}%
                    </td>
                    <td className="px-3 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => {
                          apiClient.put(`/admin/catalog/products/${p.id}`, { visible: !p.visible })
                            .then(() => queryClient.invalidateQueries({ queryKey: ["admin-products"] }))
                            .catch(() => toast.error("Failed to update visibility"));
                        }}
                        aria-label={p.visible ? "Hide" : "Show"}
                        className="text-mute hover:text-ink"
                      >
                        {p.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
          )}
        </Panel>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {list.slice((page - 1) * pageSize, page * pageSize).map((p) => (
            <button
              key={p.id}
              onClick={() => setActive(p)}
              className="group border border-line bg-paper text-left transition hover:border-ink/40"
            >
              <div className="relative aspect-[4/5] overflow-hidden bg-fog">
                <img
                  src={p.image || "https://placehold.co/400x500/f5f3ee/0d0d0d?text=No+Image"}
                  alt=""
                  className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                />
                <div className="absolute left-2 top-2 flex flex-col gap-1">
                  <StatusChip label={p.status} tone={STATUS_TONE[p.status]} />
                  {p.featured && <StatusChip label="Featured" tone="warn" />}
                </div>
              </div>
              <div className="p-3">
                <p className="truncate text-[13px] text-ink">{p.name}</p>
                <div className="mt-1 flex items-baseline justify-between font-mono text-[11px]">
                  <span className="tabular-nums text-ink">{inr(p.price)}</span>
                  <span className="tabular-nums text-mute">{p.stock} stock</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {list.length > pageSize && (
        <div className="flex items-center justify-between border-t border-line bg-fog/20 px-4 py-3 text-[12px]">
          <p className="text-mute">
            Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, list.length)} of {list.length} products
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

      <AdminDrawer
        open={!!active}
        onClose={() => setActive(null)}
        eyebrow={active?.collection}
        title={active?.name ?? ""}
        width={620}
        footer={
          <div className="flex justify-between gap-2">
            <button 
              onClick={() => {
                apiClient.put(`/admin/catalog/products/${active?.id}`, { ...edits, status: 'archived' })
                  .then(() => {
                    toast.success('Product archived');
                    queryClient.invalidateQueries({ queryKey: ["admin-products"] });
                    setActive(null);
                  })
                  .catch(() => toast.error('Failed to archive'));
              }}
              className="press border border-line bg-paper px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-mute hover:border-ink hover:text-ink"
            >
              Archive
            </button>
            <div className="flex gap-2">
              <button 
                onClick={() => {
                  apiClient.put(`/admin/catalog/products/${active?.id}`, { ...edits, status: 'draft' }).then(() => {
                    toast.success('Saved as draft');
                    queryClient.invalidateQueries({ queryKey: ["admin-products"] });
                    setActive(null);
                  }).catch(() => toast.error('Failed to save draft'));
                }}
                className="press border border-line bg-paper px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-mute hover:border-ink hover:text-ink"
              >
                Save draft
              </button>
              <button 
                onClick={() => {
                  apiClient.put(`/admin/catalog/products/${active?.id}`, { ...edits, status: 'active' }).then(() => {
                    toast.success('Product published');
                    queryClient.invalidateQueries({ queryKey: ["admin-products"] });
                    setActive(null);
                  }).catch(() => toast.error('Failed to save changes'));
                }}
                className="press bg-ink px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-paper"
              >
                Save changes
              </button>
            </div>
          </div>
        }
      >
        {active && <ProductDetail product={active} edits={edits} onChange={(k, v) => setEdits(e => ({...e, [k]: v}))} />}
      </AdminDrawer>
      <AdminDrawer
        open={isCreating}
        onClose={() => { setIsCreating(false); setNewProduct({ status: 'draft', visible: false, variants: 0, stock: 0 }); }}
        eyebrow="New Product"
        title={newProduct.name || "Untitled Product"}
        width={620}
        footer={
          <div className="flex justify-end gap-2">
            <button 
              onClick={() => { setIsCreating(false); setNewProduct({ status: 'draft', visible: false, variants: 0, stock: 0 }); }}
              className="press border border-line bg-paper px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-mute hover:border-ink hover:text-ink"
            >
              Cancel
            </button>
            <button 
              onClick={() => {
                apiClient.post(`/admin/catalog/products`, newProduct).then(() => {
                  toast.success('Product created');
                  queryClient.invalidateQueries({ queryKey: ["admin-products"] });
                  setIsCreating(false);
                  setNewProduct({ status: 'draft', visible: false, variants: 0, stock: 0 });
                }).catch(() => toast.error('Failed to create product'));
              }}
              className="press bg-ink px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-paper"
            >
              Create Product
            </button>
          </div>
        }
      >
        <ProductDetail 
          product={newProduct as Product} 
          edits={newProduct} 
          onChange={(k, v) => setNewProduct(e => ({...e, [k]: v}))} 
        />
      </AdminDrawer>
    </div>
  );
}

function ProductDetail({ product, edits, onChange }: { product: Product, edits: Partial<Product>, onChange: (key: string, value: any) => void }) {
  const [tab, setTab] = useState<"general" | "media" | "variants" | "seo" | "schedule">("general");
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-2">
        {[product.image, product.image, product.image].map((src, i) => (
          <div
            key={i}
            className={`relative aspect-[4/5] overflow-hidden border ${i === 0 ? "border-ink" : "border-line"}`}
          >
            <img src={src || "https://placehold.co/400x500/f5f3ee/0d0d0d?text=No+Image"} alt="" className="h-full w-full object-cover" />
            {i === 0 && (
              <span className="absolute left-1 top-1 bg-ink px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-paper">
                Cover
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-1 border-b border-line">
        {(["general", "media", "variants", "seo", "schedule"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-3 py-2 text-[11px] uppercase tracking-[0.18em] transition ${tab === t ? "border-ink text-ink" : "border-transparent text-mute hover:text-ink"}`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "general" && (
        <div className="space-y-4">
          <FieldRow label="Name" value={edits.name ?? product.name} onChange={e => onChange("name", e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <FieldRow label="Price" prefix="₹" type="number" value={edits.price ?? product.price} onChange={e => onChange("price", Number(e.target.value))} />
            <FieldRow
              label="Compare at"
              prefix="₹"
              type="number"
              value={edits.compareAt ?? product.compareAt ?? ""}
              onChange={e => onChange("compareAt", Number(e.target.value) || undefined)}
              placeholder="Optional"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FieldRow label="SKU" value={edits.sku ?? product.sku} onChange={e => onChange("sku", e.target.value)} />
            <FieldRow label="Stock" type="number" value={edits.stock ?? product.stock} onChange={e => onChange("stock", Number(e.target.value))} />
          </div>
          <ToggleRow label="Visible on storefront" checked={edits.visible ?? product.visible} onChange={v => onChange("visible", v)} />
          <ToggleRow
            label="Featured"
            checked={edits.featured ?? product.featured}
            onChange={v => onChange("featured", v)}
            hint="Surfaces on home and category pages"
          />
        </div>
      )}

      {tab === "media" && (
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <button
              key={i}
              className="flex aspect-[4/5] items-center justify-center border border-dashed border-line text-mute transition hover:border-ink hover:text-ink"
            >
              <Plus className="h-5 w-5" />
            </button>
          ))}
        </div>
      )}

      {tab === "variants" && (
        <div className="space-y-2">
          {[
            { size: "S", color: "Bone", stock: 24, sku: `${product.sku}-S-BNE` },
            { size: "M", color: "Bone", stock: 48, sku: `${product.sku}-M-BNE` },
            { size: "L", color: "Bone", stock: 38, sku: `${product.sku}-L-BNE` },
            { size: "XL", color: "Bone", stock: 32, sku: `${product.sku}-XL-BNE` },
          ].map((v) => (
            <div
              key={v.sku}
              className="grid grid-cols-[1fr_1fr_80px_120px] items-center gap-3 border border-line bg-paper p-3 text-[12px]"
            >
              <p className="text-ink">{v.size}</p>
              <p className="text-mute">{v.color}</p>
              <p className="text-right font-mono tabular-nums">{v.stock}</p>
              <p className="text-right font-mono text-[10px] uppercase tracking-[0.18em] text-mute">
                {v.sku}
              </p>
            </div>
          ))}
        </div>
      )}

      {tab === "seo" && (
        <div className="space-y-4">
          <FieldRow label="Meta title" value={`${edits.name ?? product.name ?? ''} — Ink Studio`} onChange={() => {}} />
          <FieldRow
            label="Meta description"
            value={`${edits.name ?? product.name ?? ''} — heavyweight cotton.`}
            onChange={() => {}}
          />
          <FieldRow
            label="URL slug"
            prefix="/p/"
            value={(edits.sku ?? product.sku ?? '').toLowerCase().replace(/[^a-z0-9]+/g, "-")}
            onChange={() => {}}
          />
          <div className="border border-line bg-fog/40 p-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-mute">Preview</p>
            <p className="mt-1 text-[14px] text-ink">{edits.name ?? product.name ?? 'Untitled'} — Ink Studio</p>
            <p className="font-mono text-[11px] text-mute">
              inkstudio.cc/p/{(edits.sku ?? product.sku ?? 'slug').toLowerCase()}
            </p>
            <p className="mt-1 text-[12px] text-mute">
              {edits.name ?? product.name ?? 'Untitled'} — heavyweight cotton.
            </p>
          </div>
        </div>
      )}

      {tab === "schedule" && (
        <div className="space-y-4">
          <ToggleRow label="Schedule publish" checked={!!(edits.scheduledFor ?? product.scheduledFor)} onChange={v => { if (!v) onChange("scheduledFor", undefined); }} />
          <FieldRow
            label="Publish at"
            value={(edits.scheduledFor ?? product.scheduledFor)?.slice(0, 16).replace("T", " ") ?? ""}
            onChange={e => onChange("scheduledFor", e.target.value ? new Date(e.target.value).toISOString() : undefined)}
            placeholder="YYYY-MM-DD HH:MM"
          />
          <FieldRow label="Available until" placeholder="Optional" />
          <p className="inline-flex items-center gap-1.5 text-[11px] text-mute">
            <CalendarClock className="h-3.5 w-3.5" /> Drops auto-publish at scheduled time in IST.
          </p>
        </div>
      )}
    </div>
  );
}

function FieldRow({
  label,
  prefix,
  ...rest
}: { label: string; prefix?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-mute">{label}</span>
      <div className="mt-1 flex items-center border border-line bg-paper transition focus-within:border-ink">
        {prefix && <span className="px-3 font-mono text-[12px] text-mute">{prefix}</span>}
        <input
          {...rest}
          className="h-9 w-full bg-transparent px-3 text-[13px] outline-none placeholder:text-mute"
        />
      </div>
    </label>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
}) {
  const on = checked ?? false;
  return (
    <div className="flex items-start justify-between gap-4 border-y border-line py-3">
      <div>
        <p className="text-[13px] text-ink">{label}</p>
        {hint && <p className="text-[11px] text-mute">{hint}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() => onChange?.(!on)}
        className={`relative h-5 w-9 rounded-full transition ${on ? "bg-ink" : "bg-line"}`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-paper transition ${on ? "left-[18px]" : "left-0.5"}`}
        />
      </button>
    </div>
  );
}

// re-export to avoid unused import warning
export const __reexport = { compactInr };
