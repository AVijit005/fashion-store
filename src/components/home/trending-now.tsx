import { Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Reveal } from "@/components/ui/reveal";
import { TrendingUp, Flame } from "lucide-react";
import { ProductCardSkeleton } from "@/components/product/product-skeleton";
import { type Product } from "@/lib/data/products";
import { inr } from "@/lib/format";
import { catalogApi } from "@/lib/api/catalog";

export function TrendingNow() {
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    catalogApi
      .getProducts({ limit: 12 })
      .then((res) => {
        setItems(
          res.products
            .filter((p: Product) => p.badges.includes("trending") || p.badges.includes("new"))
            .slice(0, 8),
        );
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  return (
    <section className="border-y border-line bg-paper">
      <div className="mx-auto max-w-[1480px] px-5 py-20 lg:px-10 lg:py-28">
        <Reveal>
          <div className="mb-10 flex items-end justify-between gap-6">
            <div>
              <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-mute">
                <Flame className="h-3.5 w-3.5" /> Trending this week
              </p>
              <h2 className="mt-2 font-display text-5xl leading-[0.95] lg:text-6xl">
                What everyone's <span className="italic">wearing.</span>
              </h2>
            </div>
            <Link
              to="/trending"
              className="hidden shrink-0 items-center gap-2 text-[12px] uppercase tracking-[0.2em] underline-offset-4 hover:underline md:inline-flex"
            >
              <TrendingUp className="h-3.5 w-3.5" /> See all trending →
            </Link>
          </div>
        </Reveal>

        <div className="flex gap-4 overflow-x-auto pb-2 hide-scrollbar lg:gap-6">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="w-[200px] shrink-0 lg:w-[260px]">
                  <ProductCardSkeleton />
                </div>
              ))
            : items.map((p, i) => (
                <Reveal key={p.id} delay={i * 0.04} className="w-[200px] shrink-0 lg:w-[260px]">
                  <Link to="/p/$slug" params={{ slug: p.slug }} className="group block">
                    <div className="relative aspect-[3/4] overflow-hidden bg-fog">
                      <img
                        src={p.images[0]}
                        alt={p.name}
                        loading="lazy"
                        className="h-full w-full object-cover transition duration-[1100ms] group-hover:scale-105"
                      />
                      <div className="absolute left-3 top-3 flex h-8 w-8 items-center justify-center bg-paper/95 font-display text-base tabular-nums">
                        {String(i + 1).padStart(2, "0")}
                      </div>
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink/60 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />
                      <p className="absolute bottom-3 left-3 right-3 text-[11px] uppercase tracking-[0.18em] text-paper opacity-0 transition group-hover:opacity-100">
                        {p.reviews} reviews · ★ {p.rating.toFixed(1)}
                      </p>
                    </div>
                    <p className="mt-3 truncate text-[14px]">{p.name}</p>
                    <p className="text-[12px] tabular-nums text-mute">{inr(p.price)}</p>
                  </Link>
                </Reveal>
              ))}
        </div>
      </div>
    </section>
  );
}
