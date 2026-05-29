import { Reveal } from "@/components/ui/reveal";
import { Marquee } from "@/components/ui/marquee";

const stats = [
  { v: "180k", l: "Pieces shipped" },
  { v: "4.8★", l: "Avg. rating" },
  { v: "62", l: "Cities reached" },
  { v: "24h", l: "Studio turnaround" },
];

const press = [
  "VOGUE",
  "HIGHSNOBIETY",
  "HYPEBEAST",
  "DAZED",
  "GQ",
  "i-D",
  "COMPLEX",
  "DESIGN MILK",
];

export function CommunityProof() {
  return (
    <section className="bg-ink text-paper">
      <div className="mx-auto max-w-[1480px] px-5 py-20 lg:px-10 lg:py-28">
        <Reveal>
          <div className="grid grid-cols-2 gap-6 lg:grid-cols-4 lg:gap-10">
            {stats.map((s) => (
              <div key={s.l} className="border-t border-paper/15 pt-6">
                <p className="font-display text-5xl tabular-nums lg:text-7xl">{s.v}</p>
                <p className="mt-2 text-[11px] uppercase tracking-[0.22em] text-paper/60">{s.l}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
      <div className="border-t border-paper/15 py-8">
        <Marquee speed={60}>
          {press.map((p) => (
            <span key={p} className="font-display text-3xl tracking-[0.05em] text-paper/40">
              {p} <span className="mx-8 opacity-30">·</span>
            </span>
          ))}
        </Marquee>
      </div>
    </section>
  );
}
