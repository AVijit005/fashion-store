import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useRecentlyViewed } from "@/lib/store/recently-viewed";
import { catalogApi } from "@/lib/api/catalog";
import { useQuery } from "@tanstack/react-query";
import { inr } from "@/lib/format";
import type { Product } from "@/lib/api/catalog";

export function RecentlyViewed() {
  const ids = useRecentlyViewed((s) => s.ids);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || ids.length === 0) return null;
  const { data } = useQuery({
    queryKey: ["products", "recently-viewed", ids],
    queryFn: () => catalogApi.getProducts({ ids, limit: 10 }),
    enabled: ids.length > 0,
  });
  const items = data?.products || [];
  if (items.length === 0) return null;

  return (
    <section className="border-t border-line bg-paper">
      <div className="mx-auto max-w-[1480px] px-5 py-16 lg:px-10 lg:py-20">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-mute">
              Picked up where you left off
            </p>
            <h2 className="mt-2 font-display text-3xl lg:text-4xl">Recently viewed</h2>
          </div>
        </div>
        <div className="flex gap-4 overflow-x-auto pb-2 hide-scrollbar lg:gap-5">
          {items.map((p: Product, i: number) => (
            <Link
              key={p.id}
              to="/p/$slug"
              params={{ slug: p.slug }}
              className="group block w-[160px] shrink-0 lg:w-[200px]"
            >
              <div className="aspect-[3/4] overflow-hidden bg-fog">
                <img
                  src={p.images[0]}
                  alt={p.name}
                  loading="lazy"
                  className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.05]"
                />
              </div>
              <p className="mt-2 truncate text-[13px]">{p.name}</p>
              <p className="text-[12px] tabular-nums text-mute">{inr(p.price)}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
