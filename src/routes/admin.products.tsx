import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect, useCallback } from "react";
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
  X,
} from "lucide-react";
import { SectionHeader, Panel } from "@/components/admin/section-header";
import { StatusChip } from "@/components/admin/status-chip";
import { AdminDrawer } from "@/components/admin/drawer";
import { exportToCSV } from "@/lib/admin/export";
import { type Product } from "@/lib/admin/data";
import { compactInr, inr } from "@/lib/admin/format";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { z } from "zod";

const productSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters"),
  sku: z.string().min(3, "SKU must be at least 3 characters"),
  price: z.number().min(1, "Price must be greater than 0"),
  stock: z.number().min(0, "Stock cannot be negative"),
  variantsData: z
    .array(
      z.object({
        sku: z.string(),
        size: z.string(),
        color: z.string(),
        stock: z.number(),
      }),
    )
    .optional()
    .refine((variants) => {
      if (!variants) return true;
      const skus = variants.map((v) => v.sku).filter(Boolean);
      return new Set(skus).size === skus.length;
    }, "Variant SKUs must be unique"),
});

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
  const [isSaving, setIsSaving] = useState(false);
  const [newProduct, setNewProduct] = useState<Partial<Product>>({
    status: "draft",
    visible: false,
    variants: 0,
    stock: 0,
  });
  const [page, setPage] = useState(1);
  const pageSize = 15;

  useEffect(() => {
    setEdits({});
  }, [active]);

  const queryClient = useQueryClient();
  const {
    data: response,
    isLoading,
    isPlaceholderData,
  } = useQuery<{ data: Product[]; meta: { total: number; totalPages: number } }>({
    queryKey: ["admin-products", page, q],
    queryFn: async () =>
      apiClient.get(
        `/admin/catalog/products?page=${page}&limit=${pageSize}&q=${encodeURIComponent(q)}`,
      ),
    placeholderData: keepPreviousData,
  });
  const ALL = response?.data || [];
  const meta = response?.meta || { total: 0, totalPages: 1 };

  const updateProductMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Product> }) => {
      return apiClient.patch(`/admin/catalog/products/${id}`, data);
    },
    onSuccess: (_, variables) => {
      toast.success("Product updated successfully");
      queryClient.setQueriesData({ queryKey: ["admin-products"] }, (old: any) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: old.data.map((p: any) => (p.id === variables.id ? { ...p, ...variables.data } : p)),
        };
      });
      setEdits({});
      setIsSaving(false);
      setActive(null);
    },
    onError: () => {
      setIsSaving(false);
      toast.error("Failed to update product");
    },
  });

  const handleSave = () => {
    if (!active) return;
    try {
      productSchema.parse({ ...active, ...edits });
      setIsSaving(true);
      updateProductMutation.mutate({ id: active.id, data: edits });
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast.error(err.errors[0].message);
      } else {
        toast.error("Validation failed");
      }
    }
  };

  const createProductMutation = useMutation({
    mutationFn: async (data: Partial<Product>) => {
      return apiClient.post(`/admin/catalog/products`, data);
    },
    onSuccess: () => {
      toast.success("Product created");
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      setIsCreating(false);
      setNewProduct({ status: "draft", visible: false, variants: 0, stock: 0 });
    },
  });

  const handleEditsChange = useCallback((k: string, v: unknown) => {
    setEdits((e) => ({ ...e, [k]: v }));
  }, []);

  const handleCreate = () => {
    try {
      productSchema.parse(newProduct);
      createProductMutation.mutate(newProduct);
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast.error(err.errors[0].message);
      } else {
        toast.error("Validation failed");
      }
    }
  };

  const handleNewProductChange = useCallback((k: string, v: unknown) => {
    setNewProduct((e) => ({ ...e, [k]: v }));
  }, []);

  useEffect(() => {
    setPage(1);
  }, [q]);

  const list = ALL;

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
        eyebrow={`${meta.total} products`}
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
            <>
              <div className="overflow-x-auto w-full hidden md:block">
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
                    {list.map((p) => {
                      const low = p.stock > 0 && p.stock <= (p.lowStockAt || 0);
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
                                <img
                                  src={
                                    p.image ||
                                    "https://placehold.co/400x500/f5f3ee/0d0d0d?text=No+Image"
                                  }
                                  alt=""
                                  className="h-10 w-10 object-cover"
                                />
                              </div>
                              <div className="min-w-0">
                                <p className="flex items-center gap-1.5 truncate text-ink">
                                  {p.name}
                                  {p.featured && (
                                    <Star className="h-3 w-3 text-accent" aria-label="Featured" />
                                  )}
                                </p>
                                <p className="text-[11px] text-mute">
                                  {p.collection} ·{" "}
                                  {Array.isArray(p.variants) ? p.variants.length : p.variants || 0}{" "}
                                  variants
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
                                <StatusChip
                                  label={`Live ${p.scheduledFor.slice(0, 10)}`}
                                  tone="info"
                                />
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
                          <td className="px-3 py-3 text-right font-mono tabular-nums">
                            {p.units7d || 0}
                          </td>
                          <td className="px-3 py-3 text-right font-mono tabular-nums text-mute">
                            {(p.conversion || 0).toFixed(1)}%
                          </td>
                          <td className="px-3 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => {
                                updateProductMutation.mutate({
                                  id: p.id,
                                  data: { visible: !p.visible },
                                });
                              }}
                              aria-label={p.visible ? "Hide" : "Show"}
                              className="text-mute hover:text-ink"
                            >
                              {p.visible ? (
                                <Eye className="h-4 w-4" />
                              ) : (
                                <EyeOff className="h-4 w-4" />
                              )}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Layout */}
              <div className="flex flex-col md:hidden">
                {list.map((p) => {
                  const low = p.stock > 0 && p.stock <= (p.lowStockAt || 0);
                  const oos = p.stock === 0 && p.status === "active";
                  return (
                    <div
                      key={p.id}
                      onClick={() => setActive(p)}
                      className="flex flex-col gap-3 border-b border-line/60 p-4 transition hover:bg-fog/30 cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 shrink-0 bg-fog">
                            <img
                              src={
                                p.image ||
                                "https://placehold.co/400x500/f5f3ee/0d0d0d?text=No+Image"
                              }
                              alt=""
                              className="h-10 w-10 object-cover"
                            />
                          </div>
                          <div>
                            <p className="flex items-center gap-1.5 text-[13px] text-ink font-medium">
                              {p.name}
                              {p.featured && <Star className="h-3 w-3 text-accent" />}
                            </p>
                            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-mute">
                              {p.sku}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            updateProductMutation.mutate({
                              id: p.id,
                              data: { visible: !p.visible },
                            });
                          }}
                          aria-label={p.visible ? "Hide" : "Show"}
                          className="p-2 text-mute hover:text-ink"
                        >
                          {p.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-1">
                          <StatusChip label={p.status} tone={STATUS_TONE[p.status]} />
                          {oos ? (
                            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">
                              Sold out
                            </p>
                          ) : low ? (
                            <p className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.18em] text-accent">
                              <AlertTriangle className="h-2.5 w-2.5" /> Low
                            </p>
                          ) : (
                            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-mute">
                              In stock
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="font-mono tabular-nums text-[13px]">{inr(p.price)}</p>
                          <p className="font-mono text-[11px] text-mute">{p.stock} units</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </Panel>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {list.map((p) => (
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
                  {p.stock === 0 && p.status === "active" && (
                    <StatusChip label="Sold out" tone="negative" />
                  )}
                  {p.stock > 0 && p.stock <= (p.lowStockAt || 0) && (
                    <StatusChip label="Low stock" tone="warn" />
                  )}
                </div>
              </div>
              <div className="p-3">
                <p className="truncate text-[13px] text-ink">{p.name}</p>
                <div className="mt-1 flex items-baseline justify-between font-mono text-[11px]">
                  <span className="tabular-nums text-ink">{inr(p.price)}</span>
                  <span
                    className={`tabular-nums ${(p.stock === 0 && p.status === "active") || (p.stock > 0 && p.stock <= (p.lowStockAt || 0)) ? "text-accent" : "text-mute"}`}
                  >
                    {p.stock} stock
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {meta.total > pageSize && (
        <div className="flex items-center justify-between border-t border-line bg-fog/20 px-4 py-3 text-[12px]">
          <p className="text-mute">
            Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, meta.total)} of{" "}
            {meta.total} products
          </p>
          <div className="flex gap-2">
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              className="border border-line bg-paper px-3 py-1 text-mute hover:text-ink disabled:opacity-50"
            >
              Previous
            </button>
            <button
              disabled={page >= meta.totalPages}
              onClick={() => setPage((p) => p + 1)}
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
              disabled={
                updateProductMutation.isPending &&
                updateProductMutation.variables?.data.status === "archived"
              }
              onClick={() => {
                updateProductMutation.mutate(
                  { id: active?.id as string, data: { ...edits, status: "archived" } },
                  { onSuccess: () => toast.success("Product archived") },
                );
              }}
              className="press border border-line bg-paper px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-mute hover:border-ink hover:text-ink disabled:opacity-50"
            >
              {updateProductMutation.isPending &&
              updateProductMutation.variables?.data.status === "archived"
                ? "Archiving..."
                : "Archive"}
            </button>
            <div className="flex gap-2">
              <button
                disabled={isSaving}
                onClick={handleSave}
                className="press bg-ink px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-paper disabled:opacity-50"
              >
                {isSaving ? "Saving..." : "Save changes"}
              </button>
            </div>
          </div>
        }
      >
        {active && <ProductDetail product={active} edits={edits} onChange={handleEditsChange} />}
      </AdminDrawer>
      <AdminDrawer
        open={isCreating}
        onClose={() => {
          setIsCreating(false);
          setNewProduct({ status: "draft", visible: false, variants: 0, stock: 0 });
        }}
        eyebrow="New Product"
        title={newProduct.name || "Untitled Product"}
        width={620}
        footer={
          <div className="flex justify-end gap-2">
            <button
              disabled={createProductMutation.isPending}
              onClick={() => {
                setIsCreating(false);
                setNewProduct({ status: "draft", visible: false, variants: 0, stock: 0 });
              }}
              className="press border border-line bg-paper px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-mute hover:border-ink hover:text-ink disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              disabled={createProductMutation.isPending}
              onClick={handleCreate}
              className="press bg-ink px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-paper disabled:opacity-50"
            >
              {createProductMutation.isPending ? "Creating..." : "Create Product"}
            </button>
          </div>
        }
      >
        <ProductDetail
          product={newProduct as Product}
          edits={newProduct}
          onChange={handleNewProductChange}
        />
      </AdminDrawer>
    </div>
  );
}

function ProductDetail({
  product,
  edits,
  onChange,
}: {
  product: Product;
  edits: Partial<Product>;
  onChange: (key: string, value: unknown) => void;
}) {
  const [tab, setTab] = useState<"general" | "media" | "variants" | "seo" | "schedule">("general");
  const [isUploading, setIsUploading] = useState(false);

  const handleUpload = async (file: File) => {
    try {
      setIsUploading(true);
      const { uploadUrl, asset, publicUrl } = await apiClient.post<{
        uploadUrl: { url: string; fields: Record<string, string> };
        asset: { id: string };
        publicUrl: string;
      }>("/assets/upload-url", {
        filename: file.name,
        mimeType: file.type,
        size: file.size,
      });

      const formData = new FormData();
      Object.entries(uploadUrl.fields).forEach(([k, v]) => formData.append(k, v));
      formData.append("file", file);

      const res = await fetch(uploadUrl.url, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");

      await apiClient.patch(`/assets/${asset.id}/confirm`);

      const newImages = [...(edits.images || [product.image].filter(Boolean)), publicUrl];
      onChange("images", newImages);
      if (!product.image && !edits.image) onChange("image", publicUrl);
    } catch (err) {
      console.error("Upload failed", err);
      alert("Failed to upload image. Check console for details.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-2">
        {(edits.images || [product.image].filter(Boolean))
          .slice(0, 3)
          .map((src: string, i: number) => (
            <div
              key={i}
              className={`relative aspect-[4/5] overflow-hidden border ${i === 0 ? "border-ink" : "border-line"}`}
            >
              <img
                src={src || "https://placehold.co/400x500/f5f3ee/0d0d0d?text=No+Image"}
                alt=""
                className="h-full w-full object-cover"
              />
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
          <FieldRow
            label="Name"
            value={edits.name ?? product.name ?? ""}
            onChange={(e) => onChange("name", e.target.value)}
          />
          <div className="grid grid-cols-2 gap-3">
            <FieldRow
              label="Price"
              prefix="₹"
              type="number"
              value={edits.price ?? product.price ?? 0}
              onChange={(e) => onChange("price", e.target.value ? Number(e.target.value) : 0)}
            />
            <FieldRow
              label="Compare at"
              prefix="₹"
              type="number"
              value={edits.compareAt ?? product.compareAt ?? ""}
              onChange={(e) =>
                onChange("compareAt", e.target.value ? Number(e.target.value) : undefined)
              }
              placeholder="Optional"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FieldRow
              label="SKU"
              value={edits.sku ?? product.sku ?? ""}
              onChange={(e) => onChange("sku", e.target.value)}
            />
            <FieldRow
              label="Stock"
              type="number"
              value={edits.stock ?? product.stock ?? 0}
              onChange={(e) => onChange("stock", e.target.value ? Number(e.target.value) : 0)}
            />
          </div>
          <ToggleRow
            label="Visible on storefront"
            checked={edits.visible ?? product.visible ?? false}
            onChange={(v) => onChange("visible", v)}
          />
          <ToggleRow
            label="Featured"
            checked={edits.featured ?? product.featured ?? false}
            onChange={(v) => onChange("featured", v)}
            hint="Surfaces on home and category pages"
          />
        </div>
      )}

      {tab === "media" && (
        <div className="grid grid-cols-3 gap-2">
          {(edits.images || [product.image].filter(Boolean)).map((src: string, i: number) => (
            <div key={i} className="relative aspect-[4/5] overflow-hidden border border-line group">
              <img src={src} alt="" className="h-full w-full object-cover" />
              <button
                onClick={() =>
                  onChange(
                    "images",
                    (edits.images || [product.image].filter(Boolean)).filter(
                      (_: string, idx: number) => idx !== i,
                    ),
                  )
                }
                className="absolute top-1 right-1 bg-paper/90 p-1 text-accent opacity-0 transition group-hover:opacity-100 hover:bg-paper"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          <label
            className={`flex aspect-[4/5] cursor-pointer items-center justify-center border border-dashed border-line text-mute transition hover:border-ink hover:text-ink ${isUploading ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            {isUploading ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-mute border-t-ink" />
            ) : (
              <Plus className="h-5 w-5" />
            )}
            <input
              type="file"
              className="hidden"
              accept="image/*"
              disabled={isUploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleUpload(file);
                }
              }}
            />
          </label>
        </div>
      )}

      {tab === "variants" &&
        (() => {
          const variants = edits.variantsData || product.variantsData || [];
          return (
            <div className="space-y-3">
              {variants.map(
                (v: { size: string; color: string; stock: number; sku: string }, i: number) => (
                  <div
                    key={i}
                    className="grid grid-cols-[1fr_1fr_80px_120px_auto] items-center gap-3 border border-line bg-paper p-3 text-[12px]"
                  >
                    <input
                      value={v.size}
                      onChange={(e) => {
                        onChange(
                          "variantsData",
                          variants.map((it, idx) =>
                            idx === i ? { ...it, size: e.target.value } : it,
                          ),
                        );
                      }}
                      className="w-full bg-transparent outline-none"
                      placeholder="Size"
                    />
                    <input
                      value={v.color}
                      onChange={(e) => {
                        onChange(
                          "variantsData",
                          variants.map((it, idx) =>
                            idx === i ? { ...it, color: e.target.value } : it,
                          ),
                        );
                      }}
                      className="w-full bg-transparent outline-none text-mute"
                      placeholder="Color"
                    />
                    <input
                      type="number"
                      value={v.stock}
                      onChange={(e) => {
                        onChange(
                          "variantsData",
                          variants.map((it, idx) =>
                            idx === i
                              ? { ...it, stock: e.target.value ? Number(e.target.value) : 0 }
                              : it,
                          ),
                        );
                      }}
                      className="w-full bg-transparent outline-none text-right font-mono tabular-nums"
                    />
                    <input
                      value={v.sku}
                      onChange={(e) => {
                        onChange(
                          "variantsData",
                          variants.map((it, idx) =>
                            idx === i ? { ...it, sku: e.target.value } : it,
                          ),
                        );
                      }}
                      className="w-full bg-transparent outline-none text-right font-mono text-[10px] uppercase tracking-[0.18em] text-mute"
                      placeholder="SKU"
                    />
                    <button
                      onClick={() =>
                        onChange(
                          "variantsData",
                          variants.filter((_: unknown, idx: number) => idx !== i),
                        )
                      }
                      className="text-accent hover:opacity-70"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ),
              )}
              <button
                onClick={() =>
                  onChange("variantsData", [
                    ...variants,
                    { size: "", color: "", stock: 0, sku: "" },
                  ])
                }
                className="flex w-full items-center justify-center gap-1.5 border border-dashed border-line bg-fog/20 py-2 text-[11px] uppercase tracking-[0.18em] text-mute hover:border-ink hover:text-ink"
              >
                <Plus className="h-3.5 w-3.5" /> Add variant
              </button>
            </div>
          );
        })()}

      {tab === "seo" && (
        <div className="space-y-4">
          <FieldRow
            label="Meta title"
            value={edits.metaTitle ?? `${edits.name ?? product.name ?? ""} — Ink Studio`}
            onChange={(e) => onChange("metaTitle", e.target.value)}
          />
          <FieldRow
            label="Meta description"
            value={edits.metaDesc ?? `${edits.name ?? product.name ?? ""} — heavyweight cotton.`}
            onChange={(e) => onChange("metaDesc", e.target.value)}
          />
          <FieldRow
            label="URL slug"
            prefix="/p/"
            value={
              edits.slug ??
              (edits.sku ?? product.sku ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-")
            }
            onChange={(e) => onChange("slug", e.target.value)}
          />
          <div className="border border-line bg-fog/40 p-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-mute">Preview</p>
            <p className="mt-1 text-[14px] text-ink">
              {edits.metaTitle ?? `${edits.name ?? product.name ?? "Untitled"} — Ink Studio`}
            </p>
            <p className="font-mono text-[11px] text-mute">
              inkstudio.cc/p/
              {edits.slug ??
                (edits.sku ?? product.sku ?? "slug").toLowerCase().replace(/[^a-z0-9]+/g, "-")}
            </p>
            <p className="mt-1 text-[12px] text-mute">
              {edits.metaDesc ??
                `${edits.name ?? product.name ?? "Untitled"} — heavyweight cotton.`}
            </p>
          </div>
        </div>
      )}

      {tab === "schedule" && (
        <div className="space-y-4">
          <ToggleRow
            label="Schedule publish"
            checked={!!(edits.scheduledFor ?? product.scheduledFor)}
            onChange={(v) => {
              if (!v) onChange("scheduledFor", undefined);
            }}
          />
          <FieldRow
            label="Publish at"
            value={
              (edits.scheduledFor ?? product.scheduledFor)?.slice(0, 16).replace("T", " ") ?? ""
            }
            onChange={(e) =>
              onChange(
                "scheduledFor",
                e.target.value ? new Date(e.target.value).toISOString() : undefined,
              )
            }
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
