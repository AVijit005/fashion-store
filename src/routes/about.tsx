import { createFileRoute, Link } from "@tanstack/react-router";
import { Reveal } from "@/components/ui/reveal";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — Ink Studio" },
      {
        name: "description",
        content:
          "A small-batch streetwear studio. Heavyweight cotton, editorial prints, made with care.",
      },
      { property: "og:title", content: "About — Ink Studio" },
      { property: "og:url", content: "/about" },
    ],
    links: [{ rel: "canonical", href: "/about" }],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <div className="bg-paper">
      <header className="mx-auto max-w-[1480px] px-5 py-20 lg:px-10 lg:py-32">
        <p className="text-[11px] uppercase tracking-[0.22em] text-mute">
          Est. 2021 · Mumbai & Tokyo
        </p>
        <h1 className="mt-4 max-w-4xl font-display text-6xl leading-[0.9] lg:text-[9vw]">
          We make clothes that <span className="italic">outwear</span> the trend.
        </h1>
      </header>

      <section className="mx-auto grid max-w-[1480px] grid-cols-1 gap-10 px-5 pb-20 lg:grid-cols-2 lg:gap-16 lg:px-10 lg:pb-32">
        <Reveal>
          <div className="aspect-[4/5] overflow-hidden bg-fog">
            <img
              src="https://images.unsplash.com/photo-1483985988355-763728e1935b?w=1200&q=80&auto=format&fit=crop"
              alt=""
              className="h-full w-full object-cover"
            />
          </div>
        </Reveal>
        <Reveal delay={0.1}>
          <div className="flex flex-col justify-center">
            <p className="text-[11px] uppercase tracking-[0.22em] text-mute">The studio</p>
            <h2 className="mt-3 font-display text-5xl">A small room, two cities.</h2>
            <p className="mt-6 text-graphite">
              Ink Studio started in a one-room workshop in Bandra in 2021. Four years later, we
              still make everything in small batches, garment-dye in-house, and ship our pieces with
              a hand-written thank-you.
            </p>
            <p className="mt-4 text-graphite">
              We work with original artists, screen-print every collab by hand, and number our anime
              drops. No mass production. No fast fashion. Just heavyweight cotton, made with care.
            </p>
          </div>
        </Reveal>
      </section>

      <section className="bg-ink text-paper">
        <div className="mx-auto grid max-w-[1480px] grid-cols-2 gap-8 px-5 py-16 lg:grid-cols-4 lg:gap-12 lg:px-10 lg:py-24">
          {[
            { v: "240gsm", l: "Cotton weight" },
            { v: "100%", l: "Combed cotton" },
            { v: "0", l: "Synthetic blends" },
            { v: "62", l: "Cities shipped" },
          ].map((s) => (
            <div key={s.l} className="border-t border-paper/20 pt-6">
              <p className="font-display text-5xl lg:text-6xl">{s.v}</p>
              <p className="mt-2 text-[11px] uppercase tracking-[0.22em] text-paper/60">{s.l}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[1480px] px-5 py-20 text-center lg:px-10 lg:py-28">
        <p className="font-display text-4xl italic text-graphite lg:text-6xl">
          "Built to outlast the trend. Designed to outlive the season."
        </p>
        <Link
          to="/shop"
          className="mt-10 inline-block bg-ink px-6 py-4 text-[12px] uppercase tracking-[0.22em] text-paper"
        >
          Shop the studio →
        </Link>
      </section>
    </div>
  );
}
