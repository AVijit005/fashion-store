import { Link } from "@tanstack/react-router";
import { Reveal } from "@/components/ui/reveal";
import { type Product } from "@/lib/api/catalog";
import { ProductCard } from "@/components/product/product-card";
import { catalogApi } from "@/lib/api/catalog";
import { useQuery } from "@tanstack/react-query";

export function DropFeature() {
  const { data } = useQuery({
    queryKey: ["products", "oversized-tees"],
    queryFn: () => catalogApi.getProducts({ category: "oversized-tees", limit: 4 }),
  });
  const items = data?.products || [];
  return (
    <section className="mx-auto max-w-[1480px] px-5 py-20 lg:px-10 lg:py-32">
      <Reveal>
        <div className="mb-10 flex items-end justify-between gap-8">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-mute">The drop</p>
            <h2 className="mt-2 max-w-2xl font-display text-5xl leading-[0.95] lg:text-7xl">
              Oversized, in <span className="italic">heavyweight</span> cotton.
            </h2>
          </div>
          <Link
            to="/c/$category"
            params={{ category: "oversized-tees" }}
            className="hidden shrink-0 text-[12px] uppercase tracking-[0.2em] underline-offset-4 hover:underline md:inline"
          >
            See the drop →
          </Link>
        </div>
      </Reveal>
      <div className="grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-4 lg:gap-x-6">
        {items.map((p: Product, i: number) => (
          <Reveal key={p.id} delay={i * 0.06}>
            <ProductCard product={p} />
          </Reveal>
        ))}
      </div>
    </section>
  );
}
