import { Reveal } from "@/components/ui/reveal";
import { ProductCard } from "@/components/product/product-card";
import { products } from "@/lib/data/products";

export function BestSellers() {
  const items = products
    .filter((p) => p.badges.includes("bestseller") || p.badges.includes("trending"))
    .slice(0, 8);
  return (
    <section className="mx-auto max-w-[1480px] px-5 py-20 lg:px-10 lg:py-28">
      <Reveal>
        <div className="mb-10 flex items-end justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-mute">Most loved</p>
            <h2 className="mt-2 font-display text-5xl lg:text-6xl">Best sellers</h2>
          </div>
        </div>
      </Reveal>
      <div className="grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-4 lg:gap-x-6">
        {items.map((p, i) => (
          <Reveal key={p.id} delay={i * 0.05}>
            <ProductCard product={p} />
          </Reveal>
        ))}
      </div>
    </section>
  );
}
