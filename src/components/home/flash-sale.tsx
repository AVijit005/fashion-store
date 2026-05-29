import { useEffect, useState } from "react";
import { Reveal } from "@/components/ui/reveal";
import { useCountdown } from "@/hooks/use-countdown";
import { products } from "@/lib/data/products";
import { inr, pct } from "@/lib/format";
import { Link } from "@tanstack/react-router";

export function FlashSale() {
  // Initialize on client only to avoid SSR hydration mismatch.
  const [target, setTarget] = useState<number | null>(null);
  useEffect(() => {
    setTarget(Date.now() + 1000 * 60 * 60 * 8 + 1000 * 60 * 43);
  }, []);
  const { h, m, s } = useCountdown(target ?? 0);
  const items = products.filter((p) => pct(p.price, p.mrp) >= 30).slice(0, 6);

  return (
    <section className="bg-fog">
      <div className="mx-auto max-w-[1480px] px-5 py-16 lg:px-10 lg:py-24">
        <Reveal>
          <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-mute">Today, in studio</p>
              <h2 className="mt-2 font-display text-5xl lg:text-6xl">Flash sale</h2>
              <p className="mt-2 text-sm text-mute">Up to 40% off on selected pieces.</p>
            </div>
            <div className="flex items-center gap-3 text-ink" suppressHydrationWarning>
              {[
                { v: target ? h : 0, l: "Hrs" },
                { v: target ? m : 0, l: "Min" },
                { v: target ? s : 0, l: "Sec" },
              ].map((t) => (
                <div key={t.l} className="flex flex-col items-center bg-paper px-5 py-3">
                  <span className="font-display text-3xl tabular-nums">
                    {String(t.v).padStart(2, "0")}
                  </span>
                  <span className="text-[10px] uppercase tracking-[0.22em] text-mute">{t.l}</span>
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        <div className="mt-10 flex gap-4 overflow-x-auto pb-2 hide-scrollbar lg:gap-6">
          {items.map((p, i) => (
            <Reveal key={p.id} delay={i * 0.04} className="w-[240px] shrink-0 lg:w-[280px]">
              <Link to="/p/$slug" params={{ slug: p.slug }} className="block">
                <div className="relative aspect-[3/4] overflow-hidden bg-paper">
                  <img
                    src={p.images[0]}
                    alt={p.name}
                    loading="lazy"
                    className="h-full w-full object-cover transition duration-[900ms] hover:scale-105"
                  />
                  <span className="absolute left-3 top-3 bg-ink px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-paper">
                    −{pct(p.price, p.mrp)}%
                  </span>
                </div>
                <p className="mt-3 truncate text-[14px]">{p.name}</p>
                <p className="text-[12px] text-mute">{p.tagline}</p>
                <p className="mt-1 text-[13px]">
                  <span className="tabular-nums">{inr(p.price)}</span>
                  <span className="ml-2 text-mute line-through tabular-nums">{inr(p.mrp)}</span>
                </p>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
