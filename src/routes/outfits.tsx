import { createFileRoute, Link } from "@tanstack/react-router";
import { breadcrumbJsonLd, collectionJsonLd } from "@/lib/seo";
import { Reveal } from "@/components/ui/reveal";
import { outfits } from "@/lib/data/editorials";
import { inr } from "@/lib/format";

export const Route = createFileRoute("/outfits")({
  head: () => ({
    meta: [
      { title: "Curated outfits — Ink Studio" },
      {
        name: "description",
        content: "Complete the fit. Stylist-curated outfit pairings from the studio.",
      },
      { property: "og:title", content: "Curated outfits — Ink Studio" },
      { property: "og:url", content: "/outfits" },
    ],
    links: [{ rel: "canonical", href: "/outfits" }],
    scripts: [
      breadcrumbJsonLd([
        { name: "Home", path: "/" },
        { name: "Outfits", path: "/outfits" },
      ]),
      collectionJsonLd({
        name: "Outfits — Ink Studio",
        description: "Stylist-curated outfit pairings from the studio.",
        path: "/outfits",
      }),
    ],
  }),
  component: OutfitsPage,
});

function OutfitsPage() {
  return (
    <div className="bg-paper">
      <header className="mx-auto max-w-[1480px] px-5 py-16 lg:px-10 lg:py-24">
        <p className="text-[11px] uppercase tracking-[0.22em] text-mute">Complete the fit</p>
        <h1 className="mt-3 font-display text-6xl leading-[0.9] lg:text-[8vw]">
          Curated <span className="italic">outfits.</span>
        </h1>
      </header>

      <div className="mx-auto max-w-[1480px] space-y-16 px-5 pb-32 lg:px-10">
        {outfits.map((o, i) => (
          <Reveal key={o.slug}>
            <article
              className={`grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-16 ${i % 2 ? "lg:[&>*:first-child]:order-2" : ""}`}
            >
              <div className="aspect-[4/5] overflow-hidden bg-fog">
                <img
                  src={o.img}
                  alt={o.title}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="flex flex-col justify-center">
                <p className="text-[11px] uppercase tracking-[0.22em] text-mute">
                  Outfit {String(i + 1).padStart(2, "0")}
                </p>
                <h2 className="mt-3 font-display text-5xl leading-[0.95]">{o.title}</h2>
                <ul className="mt-8 space-y-3">
                  {o.pieces.map((p) => (
                    <li
                      key={p}
                      className="flex items-center justify-between border-b border-line pb-3 text-[14px]"
                    >
                      <span>{p}</span>
                      <span className="text-[11px] uppercase tracking-[0.18em] text-mute">
                        In stock
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-8 flex items-center justify-between">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.22em] text-mute">
                      Bundle total
                    </p>
                    <p className="mt-1 font-display text-4xl tabular-nums">{inr(o.price)}</p>
                  </div>
                  <Link
                    to="/shop"
                    className="bg-ink px-6 py-4 text-[12px] uppercase tracking-[0.22em] text-paper"
                  >
                    Shop the fit →
                  </Link>
                </div>
              </div>
            </article>
          </Reveal>
        ))}
      </div>
    </div>
  );
}
