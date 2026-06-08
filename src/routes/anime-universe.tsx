import { createFileRoute, Link } from "@tanstack/react-router";
import { breadcrumbJsonLd, collectionJsonLd } from "@/lib/seo";
import { Reveal } from "@/components/ui/reveal";
import { ProductCard } from "@/components/product/product-card";
import { products } from "@/lib/api/catalog";

export const Route = createFileRoute("/anime-universe")({
  head: () => ({
    meta: [
      { title: "Anime Universe — Ink Studio" },
      {
        name: "description",
        content: "Editorial anime drops, screen-printed in numbered editions.",
      },
      { property: "og:title", content: "Anime Universe — Ink Studio" },
      { property: "og:url", content: "/anime-universe" },
    ],
    links: [{ rel: "canonical", href: "/anime-universe" }],
    scripts: [
      breadcrumbJsonLd([
        { name: "Home", path: "/" },
        { name: "Anime Universe", path: "/anime-universe" },
      ]),
      collectionJsonLd({
        name: "Anime Universe — Ink Studio",
        description: "Editorial anime drops, screen-printed in numbered editions.",
        path: "/anime-universe",
      }),
    ],
  }),
  component: AnimeUniverse,
});

function AnimeUniverse() {
  const items = products.filter((p) => p.badges.includes("anime"));
  return (
    <div className="bg-ink text-paper">
      <header className="relative overflow-hidden border-b border-paper/15">
        <img
          src="https://images.unsplash.com/photo-1578632767115-351597cf2477?w=1920&q=80&auto=format&fit=crop"
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-30"
        />
        <div className="relative mx-auto max-w-[1480px] px-5 py-24 lg:px-10 lg:py-40">
          <p className="text-[11px] uppercase tracking-[0.28em] text-paper/60">
            Vol. 03 · numbered editions
          </p>
          <h1 className="mt-3 font-display text-7xl leading-[0.9] lg:text-[10vw]">
            Anime <span className="italic text-paper/70">universe.</span>
          </h1>
          <p className="mt-6 max-w-xl text-paper/70">
            Original poster art from our favorite series, screen-printed on heavyweight cotton. Each
            piece is numbered and signed by the studio.
          </p>
          <Link
            to="/c/$category"
            params={{ category: "anime" }}
            className="mt-10 inline-block bg-paper px-6 py-4 text-[12px] uppercase tracking-[0.22em] text-ink"
          >
            Shop the collection →
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-[1480px] px-5 py-20 lg:px-10 lg:py-28">
        <Reveal>
          <p className="text-[11px] uppercase tracking-[0.22em] text-paper/60">Featured pieces</p>
          <h2 className="mt-2 font-display text-5xl">Drops in rotation</h2>
        </Reveal>
        <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-4 lg:gap-x-6 [&_p]:text-paper [&_.text-mute]:text-paper/60">
          {items.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </div>
    </div>
  );
}
