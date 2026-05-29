import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { inr } from "@/lib/format";
import type { Product } from "@/lib/data/products";

export function CompleteTheLook({ items }: { items: Product[] }) {
  if (items.length === 0) return null;
  const total = items.reduce((s, p) => s + p.price, 0);
  const mrp = items.reduce((s, p) => s + p.mrp, 0);

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
          <button className="mt-6 w-full bg-ink py-4 text-[12px] uppercase tracking-[0.22em] text-paper">
            Add the look
          </button>
          <p className="mt-3 text-[11px] text-mute">Save 12% when bought together.</p>
        </aside>
      </div>
    </section>
  );
}
