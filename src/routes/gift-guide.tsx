import { createFileRoute, Link } from "@tanstack/react-router";
import { breadcrumbJsonLd, collectionJsonLd } from "@/lib/seo";
import { Reveal } from "@/components/ui/reveal";
import { Gift, Sparkles, Heart } from "lucide-react";
import { products } from "@/lib/data/products";
import { inr } from "@/lib/format";

export const Route = createFileRoute("/gift-guide")({
  head: () => ({
    meta: [
      { title: "Gift guide — Ink Studio" },
      {
        name: "description",
        content:
          "Picks for every kind of person on your list. Heavyweight cotton, anime, custom prints.",
      },
      { property: "og:title", content: "Gift guide — Ink Studio" },
      { property: "og:url", content: "/gift-guide" },
    ],
    links: [{ rel: "canonical", href: "/gift-guide" }],
    scripts: [
      breadcrumbJsonLd([
        { name: "Home", path: "/" },
        { name: "Gift Guide", path: "/gift-guide" },
      ]),
      collectionJsonLd({
        name: "Gift Guide — Ink Studio",
        description: "Picks for every kind of person on your list.",
        path: "/gift-guide",
      }),
    ],
  }),
  component: GiftGuidePage,
});

const buckets = [
  {
    title: "For the streetwear head",
    icon: Sparkles,
    blurb: "Heavyweight basics that earn their place in the rotation.",
    filter: (p: (typeof products)[number]) =>
      p.badges.includes("oversized") || p.badges.includes("bestseller"),
  },
  {
    title: "For the anime lover",
    icon: Heart,
    blurb: "Editorial collabs, screen-printed on heavyweight cotton.",
    filter: (p: (typeof products)[number]) => p.badges.includes("anime"),
  },
  {
    title: "Under ₹999",
    icon: Gift,
    blurb: "Small but mighty. Accessories, prints, and everyday carry.",
    filter: (p: (typeof products)[number]) => p.price < 999,
  },
];

function GiftGuidePage() {
  return (
    <div className="bg-paper">
      <header className="mx-auto max-w-[1480px] px-5 py-16 lg:px-10 lg:py-24">
        <p className="text-[11px] uppercase tracking-[0.22em] text-mute">Curated picks</p>
        <h1 className="mt-3 max-w-3xl font-display text-6xl leading-[0.9] lg:text-[8vw]">
          The gift <span className="italic">guide.</span>
        </h1>
        <p className="mt-6 max-w-xl text-mute">
          Picks for every person on your list. Free shipping over ₹999 and 15-day returns, no
          questions asked.
        </p>
      </header>

      <div className="mx-auto max-w-[1480px] space-y-24 px-5 pb-32 lg:px-10">
        {buckets.map((b) => {
          const items = products.filter(b.filter).slice(0, 4);
          return (
            <Reveal key={b.title}>
              <section>
                <div className="mb-8 flex items-center gap-3">
                  <b.icon className="h-5 w-5" />
                  <div>
                    <h2 className="font-display text-3xl">{b.title}</h2>
                    <p className="text-sm text-mute">{b.blurb}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">
                  {items.map((p) => (
                    <Link
                      key={p.id}
                      to="/p/$slug"
                      params={{ slug: p.slug }}
                      className="group block"
                    >
                      <div className="aspect-[3/4] overflow-hidden bg-fog">
                        <img
                          src={p.images[0]}
                          alt={p.name}
                          loading="lazy"
                          className="h-full w-full object-cover transition duration-[1100ms] group-hover:scale-105"
                        />
                      </div>
                      <p className="mt-3 truncate text-[14px]">{p.name}</p>
                      <p className="text-[12px] tabular-nums text-mute">{inr(p.price)}</p>
                    </Link>
                  ))}
                </div>
              </section>
            </Reveal>
          );
        })}
      </div>
    </div>
  );
}
