import { createFileRoute, Link } from "@tanstack/react-router";
import { breadcrumbJsonLd, collectionJsonLd } from "@/lib/seo";
import { Reveal } from "@/components/ui/reveal";
import { useCountdown } from "@/hooks/use-countdown";
import { drops } from "@/lib/data/editorials";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";

export const Route = createFileRoute("/drops")({
  head: () => ({
    meta: [
      { title: "Limited drops — Ink Studio" },
      {
        name: "description",
        content: "Limited edition product drops, numbered editions, and capsule collections.",
      },
      { property: "og:title", content: "Limited drops — Ink Studio" },
      { property: "og:url", content: "/drops" },
    ],
    links: [{ rel: "canonical", href: "/drops" }],
    scripts: [
      breadcrumbJsonLd([
        { name: "Home", path: "/" },
        { name: "Limited Drops", path: "/drops" },
      ]),
      collectionJsonLd({
        name: "Limited Drops — Ink Studio",
        description: "Limited edition product drops, numbered editions, and capsule collections.",
        path: "/drops",
      }),
    ],
  }),
  component: DropsPage,
});

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";

function DropsPage() {
  const { data: dynamicDrops } = useQuery({
    queryKey: ["drops"],
    queryFn: () => apiClient.get("/catalog/drops").then((res: any) => res.data),
  });

  const [target, setTarget] = useState<number | null>(null);
  useEffect(() => setTarget(Date.now() + 1000 * 60 * 60 * 62), []);
  const { h, m, s } = useCountdown(target ?? 0);

  // Fallback to imported drops if API fails or returns empty, but map dynamic otherwise
  const activeDrops = dynamicDrops?.length > 0 
    ? dynamicDrops.map((d: any) => ({
        slug: d.slug,
        title: d.name,
        date: new Date(d.releaseDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        blurb: "Exclusive limited release. Available for members early.",
        img: d.products?.[0]?.mediaUrls?.[0] || "https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&q=80&w=1600",
        units: "Limited Stock"
      }))
    : drops;

  return (
    <div className="bg-paper">
      <header className="border-b border-line">
        <div className="mx-auto max-w-[1480px] px-5 py-16 lg:px-10 lg:py-24">
          <p className="text-[11px] uppercase tracking-[0.22em] text-mute">The drop calendar</p>
          <h1 className="mt-3 font-display text-6xl leading-[0.92] lg:text-[9vw]">
            Limited <span className="italic">drops.</span>
          </h1>
          <p className="mt-6 max-w-xl text-mute">
            Small batches, numbered editions, and one-off collaborations. Once they're gone, they're
            gone.
          </p>
          <div className="mt-10 flex items-center gap-3" suppressHydrationWarning>
            <p className="text-[11px] uppercase tracking-[0.22em] text-mute">Next drop in</p>
            {[
              { v: target ? h : 0, l: "Hrs" },
              { v: target ? m : 0, l: "Min" },
              { v: target ? s : 0, l: "Sec" },
            ].map((t) => (
              <div key={t.l} className="flex flex-col items-center bg-ink px-4 py-2 text-paper">
                <span className="font-display text-2xl tabular-nums">
                  {String(t.v).padStart(2, "0")}
                </span>
                <span className="text-[9px] uppercase tracking-[0.22em] opacity-60">{t.l}</span>
              </div>
            ))}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1480px] px-5 py-20 lg:px-10 lg:py-28">
        <ul className="space-y-12 lg:space-y-20">
          {activeDrops.map((d: any, i: number) => (
            <Reveal key={d.slug}>
              <li className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-16">
                <div
                  className={`relative aspect-[4/5] overflow-hidden bg-fog ${i % 2 ? "lg:order-2" : ""}`}
                >
                  <img
                    src={d.img}
                    alt={d.title}
                    loading="lazy"
                    className="h-full w-full object-cover transition duration-[1100ms] hover:scale-[1.04]"
                  />
                  <div className="absolute left-5 top-5 bg-paper/95 px-3 py-1.5 text-[10px] uppercase tracking-[0.22em]">
                    {d.date}
                  </div>
                </div>
                <div className="flex flex-col justify-center">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-mute">
                    Drop {String(i + 1).padStart(2, "0")}
                  </p>
                  <h2 className="mt-3 font-display text-5xl leading-[0.95] lg:text-7xl">
                    {d.title}
                  </h2>
                  <p className="mt-4 max-w-md text-graphite">{d.blurb}</p>
                  <p className="mt-6 text-[12px] uppercase tracking-[0.22em] text-mute">
                    {d.units} · members get early access
                  </p>
                  <Link
                    to="/shop"
                    className="group mt-10 flex w-fit items-center gap-3 bg-ink px-6 py-4 text-[12px] uppercase tracking-[0.22em] text-paper transition hover:bg-graphite"
                  >
                    Notify me{" "}
                    <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                  </Link>
                </div>
              </li>
            </Reveal>
          ))}
        </ul>
      </div>
    </div>
  );
}
