import { Link } from "@tanstack/react-router";
import { Reveal } from "@/components/ui/reveal";
import anime from "@/assets/campaign-anime.jpg";
import { products } from "@/lib/data/products";
import { inr } from "@/lib/format";

export function AnimeBand() {
  const items = products.filter((p) => p.badges.includes("anime")).slice(0, 3);
  return (
    <section className="bg-ink text-paper">
      <div className="mx-auto grid max-w-[1480px] grid-cols-1 gap-10 px-5 py-20 lg:grid-cols-[1fr_1.1fr] lg:gap-16 lg:px-10 lg:py-32">
        <div className="relative aspect-[3/4] overflow-hidden">
          <img
            src={anime}
            alt="Anime collection"
            loading="lazy"
            className="h-full w-full object-cover"
          />
          <div className="absolute left-6 top-6 text-[11px] uppercase tracking-[0.22em] text-paper/70">
            Vol. 03
          </div>
        </div>
        <div className="flex flex-col justify-center">
          <Reveal>
            <p className="text-[11px] uppercase tracking-[0.28em] text-paper/60">
              Anime collection
            </p>
            <h2 className="mt-3 font-display text-6xl leading-[0.92] lg:text-8xl">
              Stories you
              <br />
              <span className="italic text-paper/70">wear.</span>
            </h2>
            <p className="mt-6 max-w-md text-paper/70">
              An editorial collaboration with original artists. Heavyweight cotton, poster-grade
              screen prints, numbered editions.
            </p>
          </Reveal>
          <div className="mt-10 grid grid-cols-3 gap-4">
            {items.map((p, i) => (
              <Reveal key={p.id} delay={i * 0.08}>
                <Link to="/p/$slug" params={{ slug: p.slug }} className="group block">
                  <div className="aspect-[3/4] overflow-hidden bg-graphite">
                    <img
                      src={p.images[0]}
                      alt={p.name}
                      loading="lazy"
                      className="h-full w-full object-cover transition duration-[900ms] group-hover:scale-105"
                    />
                  </div>
                  <p className="mt-2 truncate text-[13px]">{p.name}</p>
                  <p className="text-[12px] text-paper/60 tabular-nums">{inr(p.price)}</p>
                </Link>
              </Reveal>
            ))}
          </div>
          <div className="mt-10">
            <Link
              to="/c/$category"
              params={{ category: "anime" }}
              className="inline-block border-b border-paper pb-1 text-[12px] uppercase tracking-[0.22em]"
            >
              Explore the collection →
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
