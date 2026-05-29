import { createFileRoute, Link } from "@tanstack/react-router";
import { Reveal } from "@/components/ui/reveal";
import { creators } from "@/lib/data/editorials";
import { Instagram } from "lucide-react";

export const Route = createFileRoute("/creators")({
  head: () => ({
    meta: [
      { title: "Creators — Ink Studio Collective" },
      {
        name: "description",
        content: "Stylists, photographers, and directors who shape the studio.",
      },
      { property: "og:title", content: "Creators — Ink Studio" },
      { property: "og:url", content: "/creators" },
    ],
    links: [{ rel: "canonical", href: "/creators" }],
  }),
  component: CreatorsPage,
});

function CreatorsPage() {
  return (
    <div className="bg-paper">
      <header className="mx-auto max-w-[1480px] px-5 pt-16 lg:px-10 lg:pt-24">
        <p className="text-[11px] uppercase tracking-[0.22em] text-mute">The collective</p>
        <h1 className="mt-3 max-w-3xl font-display text-6xl leading-[0.92] lg:text-[8vw]">
          The creators who <span className="italic">wear</span> it.
        </h1>
        <p className="mt-6 max-w-xl text-mute">
          Stylists, photographers, and directors we collaborate with. Every drop passes through
          their hands.
        </p>
      </header>

      <div className="mx-auto max-w-[1480px] px-5 py-20 lg:px-10 lg:py-28">
        <ul className="grid grid-cols-1 gap-12 md:grid-cols-2 lg:grid-cols-3 lg:gap-16">
          {creators.map((c, i) => (
            <Reveal key={c.name} delay={(i % 3) * 0.07}>
              <li>
                <div className="aspect-[4/5] overflow-hidden bg-fog">
                  <img
                    src={c.img}
                    alt={c.name}
                    loading="lazy"
                    className="h-full w-full object-cover transition duration-[1100ms] hover:scale-[1.04]"
                  />
                </div>
                <div className="mt-5 flex items-start justify-between gap-4">
                  <div>
                    <p className="font-display text-2xl leading-tight">{c.name}</p>
                    <p className="mt-1 text-[12px] uppercase tracking-[0.18em] text-mute">
                      {c.role}
                    </p>
                  </div>
                  <a className="flex items-center gap-1 text-[12px] uppercase tracking-[0.18em] text-mute">
                    <Instagram className="h-3.5 w-3.5" /> {c.followers}
                  </a>
                </div>
                <p className="mt-4 text-sm italic text-graphite">"{c.quote}"</p>
                <Link
                  to="/lookbook"
                  className="mt-4 inline-block border-b border-ink pb-1 text-[11px] uppercase tracking-[0.18em]"
                >
                  See their picks →
                </Link>
              </li>
            </Reveal>
          ))}
        </ul>
      </div>
    </div>
  );
}
