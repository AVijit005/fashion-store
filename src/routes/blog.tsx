import { createFileRoute, Link } from "@tanstack/react-router";
import { Reveal } from "@/components/ui/reveal";

const posts = [
  {
    slug: "how-we-dye",
    title: "How we garment-dye our heavyweight cotton",
    read: "6 min",
    date: "Mar 18",
    img: "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=1200&q=80&auto=format&fit=crop",
    excerpt: "Inside the small-batch process behind our bone and fog colorways.",
  },
  {
    slug: "anime-vol-03-notes",
    title: "Studio notes: Anime Vol. 03",
    read: "4 min",
    date: "Mar 11",
    img: "https://images.unsplash.com/photo-1554568218-0f1715e72254?w=1200&q=80&auto=format&fit=crop",
    excerpt: "Three new collabs, the artists behind them, and how we screen-print every piece.",
  },
  {
    slug: "fit-of-the-week",
    title: "Fit of the week · Aanya Patel",
    read: "3 min",
    date: "Mar 04",
    img: "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=1200&q=80&auto=format&fit=crop",
    excerpt: "A stylist breakdown of the Void tee, Atlas hoodie, and Field coach.",
  },
  {
    slug: "why-240gsm",
    title: "Why 240gsm matters",
    read: "5 min",
    date: "Feb 26",
    img: "https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=1200&q=80&auto=format&fit=crop",
    excerpt: "The case for heavyweight cotton, and why we won't go lighter.",
  },
];

export const Route = createFileRoute("/blog")({
  head: () => ({
    meta: [
      { title: "Studio Notes — Ink Studio" },
      {
        name: "description",
        content: "Editorials, process, and creator interviews from the Ink Studio team.",
      },
      { property: "og:title", content: "Studio Notes — Ink Studio" },
      { property: "og:url", content: "/blog" },
    ],
    links: [{ rel: "canonical", href: "/blog" }],
  }),
  component: BlogPage,
});

function BlogPage() {
  const [hero, ...rest] = posts;
  return (
    <div className="bg-paper">
      <header className="mx-auto max-w-[1480px] px-5 py-16 lg:px-10 lg:py-24">
        <p className="text-[11px] uppercase tracking-[0.22em] text-mute">Studio Notes</p>
        <h1 className="mt-3 font-display text-6xl leading-[0.9] lg:text-[8vw]">
          On <span className="italic">process,</span> people, and prints.
        </h1>
      </header>

      <div className="mx-auto max-w-[1480px] px-5 lg:px-10">
        <Reveal>
          <Link to="/blog" className="group grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-12">
            <div className="aspect-[4/3] overflow-hidden bg-fog">
              <img
                src={hero.img}
                alt={hero.title}
                loading="lazy"
                className="h-full w-full object-cover transition duration-[1100ms] group-hover:scale-[1.04]"
              />
            </div>
            <div className="flex flex-col justify-center">
              <p className="text-[11px] uppercase tracking-[0.22em] text-mute">
                Featured · {hero.date} · {hero.read}
              </p>
              <h2 className="mt-3 font-display text-5xl leading-[0.95] lg:text-6xl">
                {hero.title}
              </h2>
              <p className="mt-4 max-w-md text-graphite">{hero.excerpt}</p>
              <p className="mt-6 inline-block w-fit border-b border-ink pb-1 text-[12px] uppercase tracking-[0.22em]">
                Read the note →
              </p>
            </div>
          </Link>
        </Reveal>

        <ul className="mt-20 grid grid-cols-1 gap-12 pb-32 md:grid-cols-3">
          {rest.map((p, i) => (
            <Reveal key={p.slug} delay={i * 0.07}>
              <li className="group">
                <div className="aspect-[4/5] overflow-hidden bg-fog">
                  <img
                    src={p.img}
                    alt={p.title}
                    loading="lazy"
                    className="h-full w-full object-cover transition duration-[1100ms] group-hover:scale-[1.04]"
                  />
                </div>
                <p className="mt-4 text-[11px] uppercase tracking-[0.22em] text-mute">
                  {p.date} · {p.read}
                </p>
                <h3 className="mt-2 font-display text-2xl leading-tight">{p.title}</h3>
                <p className="mt-2 text-sm text-mute">{p.excerpt}</p>
              </li>
            </Reveal>
          ))}
        </ul>
      </div>
    </div>
  );
}
