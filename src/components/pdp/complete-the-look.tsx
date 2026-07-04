import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { inr } from "@/lib/format";
import type { Product } from "@/lib/api/catalog";
import { useCart } from "@/lib/store/cart";
import { toast } from "sonner";

export function CompleteTheLook({ items }: { items: Product[] }) {
  const add = useCart((s) => s.add);
  const setOpen = useCart((s) => s.setOpen);

  if (items.length === 0) return null;
  const total = items.reduce((s, p) => s + p.price, 0);
  // Phase 1 (audit item 1.2): mrp is nullable; treat null as 0 in the bundle
  // total so we never display a fake strikethrough for products without MRP.
  const mrp = items.reduce((s, p) => s + (p.mrp ?? 0), 0);

  const handleAddLook = () => {
    items.forEach((p) => {
      const defaultVariant = p.variants?.[0];
      const defaultSize = defaultVariant?.size || p.sizes?.[0] || "M";
      const defaultColor = defaultVariant?.color || p.colors?.[0]?.name || "Ink";

      add({
        id: p.id,
        variantId: defaultVariant?.id,
        slug: p.slug,
        name: p.name,
        image: p.images[0],
        price: p.price,
        mrp: p.mrp ?? p.price,
        size: defaultSize,
        color: defaultColor,
      });
    });
    toast.success("Added look to bag!");
    setOpen(true);
  };

  return (
    <section className="mx-auto max-w-[1480px] px-5 py-20 lg:px-10">
      <p className="text-[11px] uppercase tracking-[0.22em] text-mute">Style it with</p>
      <h2 className="mt-2 font-display text-4xl lg:text-5xl">Complete the look</h2>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div className="grid grid-cols-3 gap-3 lg:gap-5">
          {items.map((p, i) => (
            <div key={p.id} className="relative">
              <Link to="/p/$slug" params={{ slug: p.slug }} className="group block">
                <div className="aspect-[3/4] overflow-hidden bg-fog">
                  <img
                    src={p.images[0]}
                    alt={p.name}
                    className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                  />
                </div>
                <p className="mt-2 truncate text-[13px]">{p.name}</p>
                <p className="text-[12px] tabular-nums text-mute">{inr(p.price)}</p>
              </Link>
              {i < items.length - 1 && (
                <span className="absolute -right-3 top-[40%] hidden h-6 w-6 -translate-y-1/2 items-center justify-center bg-paper text-mute lg:flex">
                  <Plus className="h-3.5 w-3.5" />
                </span>
              )}
            </div>
          ))}
        </div>
        <aside className="border border-line bg-paper p-6">
          <p className="text-[11px] uppercase tracking-[0.22em] text-mute">Bundle total</p>
          <p className="mt-2 font-display text-4xl tabular-nums">{inr(total)}</p>
          <p className="mt-1 text-[12px] text-mute line-through tabular-nums">{inr(mrp)}</p>
          <button
            onClick={handleAddLook}
            className="mt-6 w-full cursor-pointer bg-ink py-4 text-[12px] uppercase tracking-[0.22em] text-paper hover:bg-graphite transition"
          >
            Add the look
          </button>
          <p className="mt-3 text-[11px] text-mute">Save 12% when bought together.</p>
        </aside>
      </div>
    </section>
  );
}
