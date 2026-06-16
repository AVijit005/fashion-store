import { Link } from "@tanstack/react-router";
import { Reveal } from "@/components/ui/reveal";
import { catalogApi } from "@/lib/api/catalog";
import { useQuery } from "@tanstack/react-query";

export function CategoryRail() {
  const { data: categories = [] } = useQuery({
    queryKey: ["categories-rail"],
    queryFn: async () => {
      const res = await catalogApi.getCategories();
      return Array.isArray(res) ? res : [];
    },
  });

  if (categories.length === 0) return null;

  return (
    <section className="border-y border-line bg-paper py-12 lg:py-16">
      <div className="mx-auto max-w-[1480px] px-5 lg:px-10">
        <Reveal>
          <div className="mb-8 flex items-end justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-mute">Browse by</p>
              <h2 className="mt-1 font-display text-4xl lg:text-5xl">Categories</h2>
            </div>
            <Link
              to="/shop"
              className="hidden text-[12px] uppercase tracking-[0.2em] underline-offset-4 hover:underline md:inline-block"
            >
              View all →
            </Link>
          </div>
        </Reveal>

        <div className="flex gap-4 overflow-x-auto pb-2 hide-scrollbar lg:gap-6">
          {categories.map((c: any, i: number) => (
            <Reveal key={c.slug} delay={i * 0.04} className="shrink-0">
              <Link
                to="/c/$category"
                params={{ category: c.slug }}
                className="group block w-[180px] lg:w-[220px]"
              >
                <div className="relative aspect-square overflow-hidden bg-fog">
                  <img
                    src={
                      c.thumbnailUrl ||
                      "https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&q=80&w=600"
                    }
                    alt={c.name}
                    loading="lazy"
                    className="h-full w-full object-cover transition duration-[900ms] group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-ink/40 to-transparent opacity-0 transition group-hover:opacity-100" />
                </div>
                <p className="mt-3 text-[14px]">{c.name}</p>
                <p className="text-[12px] text-mute">{c.description || "Explore"}</p>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
