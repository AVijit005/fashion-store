import { createFileRoute, Link } from "@tanstack/react-router";
import { Reveal } from "@/components/ui/reveal";

const stores = [
  {
    city: "Mumbai",
    address: "Bandra West · 18A Pali Hill",
    hours: "11am — 9pm, daily",
    img: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1200&q=80&auto=format&fit=crop",
  },
  {
    city: "Bengaluru",
    address: "Indiranagar · 100ft Road",
    hours: "11am — 9pm, daily",
    img: "https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?w=1200&q=80&auto=format&fit=crop",
  },
  {
    city: "Tokyo",
    address: "Shibuya · Cat Street",
    hours: "12pm — 8pm, Tue — Sun",
    img: "https://images.unsplash.com/photo-1542051841857-5f90071e7989?w=1200&q=80&auto=format&fit=crop",
  },
];

export const Route = createFileRoute("/stores")({
  head: () => ({
    meta: [
      { title: "Stores — Ink Studio" },
      { name: "description", content: "Visit the studio in Mumbai, Bengaluru, or Tokyo." },
      { property: "og:title", content: "Stores — Ink Studio" },
      { property: "og:url", content: "/stores" },
    ],
    links: [{ rel: "canonical", href: "/stores" }],
  }),
  component: StoresPage,
});

function StoresPage() {
  return (
    <div className="bg-paper">
      <header className="mx-auto max-w-[1480px] px-5 py-16 lg:px-10 lg:py-24">
        <p className="text-[11px] uppercase tracking-[0.22em] text-mute">Visit us</p>
        <h1 className="mt-3 max-w-3xl font-display text-6xl leading-[0.9] lg:text-[8vw]">
          Three rooms, three <span className="italic">cities.</span>
        </h1>
      </header>

      <div className="mx-auto max-w-[1480px] space-y-16 px-5 pb-32 lg:px-10">
        {stores.map((s, i) => (
          <Reveal key={s.city}>
            <article
              className={`grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-12 ${i % 2 ? "lg:[&>*:first-child]:order-2 lg:[&>*:first-child]:col-start-7" : ""}`}
            >
              <div className="aspect-[4/3] overflow-hidden bg-fog lg:col-span-6">
                <img
                  src={s.img}
                  alt={s.city}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="flex flex-col justify-center lg:col-span-5">
                <p className="text-[11px] uppercase tracking-[0.22em] text-mute">
                  Store {String(i + 1).padStart(2, "0")}
                </p>
                <h2 className="mt-3 font-display text-6xl">{s.city}</h2>
                <p className="mt-4 text-graphite">{s.address}</p>
                <p className="mt-2 text-[12px] uppercase tracking-[0.18em] text-mute">{s.hours}</p>
                <Link
                  to="/"
                  className="mt-6 inline-block w-fit border-b border-ink pb-1 text-[12px] uppercase tracking-[0.22em]"
                >
                  Get directions →
                </Link>
              </div>
            </article>
          </Reveal>
        ))}
      </div>
    </div>
  );
}
