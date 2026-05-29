import { createFileRoute, Link } from "@tanstack/react-router";
import { Reveal } from "@/components/ui/reveal";
import { lookbookStories } from "@/lib/data/editorials";

export const Route = createFileRoute("/lookbook")({
  head: () => ({
    meta: [
      { title: "Lookbook — Ink Studio" },
      {
        name: "description",
        content: "An editorial study in heavyweight cotton, anime drops, and studio basics.",
      },
      { property: "og:title", content: "Lookbook — Ink Studio" },
      { property: "og:url", content: "/lookbook" },
    ],
    links: [{ rel: "canonical", href: "/lookbook" }],
  }),
  component: LookbookPage,
});

function LookbookPage() {
  return (
    <div className="bg-paper">
      <header className="mx-auto max-w-[1480px] px-5 pt-16 lg:px-10 lg:pt-24">
        <p className="text-[11px] uppercase tracking-[0.22em] text-mute">Lookbook · Vol. 04</p>
        <h1 className="mt-3 font-display text-6xl leading-[0.92] lg:text-[9vw]">
          A study in <span className="italic">drape.</span>
        </h1>
      </header>

      <div className="mx-auto max-w-[1480px] px-5 py-20 lg:px-10 lg:py-28">
        <ul className="space-y-24 lg:space-y-32">
          {lookbookStories.map((s, i) => (
            <li key={s.slug}>
              <Reveal>
                <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-12">
                  <div
                    className={`relative aspect-[4/5] overflow-hidden bg-fog lg:col-span-8 ${i % 2 ? "lg:order-2 lg:col-start-5" : ""}`}
                  >
                    <img
                      src={s.img}
                      alt={s.title}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div
                    className={`flex flex-col justify-end lg:col-span-4 ${i % 2 ? "lg:order-1" : ""}`}
                  >
                    <p className="text-[11px] uppercase tracking-[0.22em] text-mute">
                      Story {String(i + 1).padStart(2, "0")}
                    </p>
                    <h2 className="mt-3 font-display text-5xl leading-[0.95]">{s.title}</h2>
                    <p className="mt-3 text-graphite">{s.sub}</p>
                    <p className="mt-6 text-[11px] uppercase tracking-[0.22em] text-mute">
                      {s.credits}
                    </p>
                    <Link
                      to="/shop"
                      className="mt-6 inline-block w-fit border-b border-ink pb-1 text-[12px] uppercase tracking-[0.22em]"
                    >
                      Shop the story →
                    </Link>
                  </div>
                </div>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
