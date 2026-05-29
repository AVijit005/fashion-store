import { Link } from "@tanstack/react-router";
import { Reveal } from "@/components/ui/reveal";

const moods = [
  {
    label: "Late night",
    sub: "Inkwell tones",
    to: "anime",
    img: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=900&q=80&auto=format&fit=crop",
  },
  {
    label: "Off-duty",
    sub: "Heavyweight basics",
    to: "oversized-tees",
    img: "https://images.unsplash.com/photo-1485518882345-15568b007407?w=900&q=80&auto=format&fit=crop",
  },
  {
    label: "Studio days",
    sub: "Workwear edits",
    to: "jackets",
    img: "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=900&q=80&auto=format&fit=crop",
  },
  {
    label: "Weekend run",
    sub: "Soft fleece",
    to: "hoodies",
    img: "https://images.unsplash.com/photo-1542295669297-4d352b042bca?w=900&q=80&auto=format&fit=crop",
  },
];

export function ShopByMood() {
  return (
    <section className="mx-auto max-w-[1480px] px-5 py-20 lg:px-10 lg:py-28">
      <Reveal>
        <div className="mb-10 flex items-end justify-between gap-6">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-mute">Style by mood</p>
            <h2 className="mt-2 max-w-2xl font-display text-5xl leading-[0.95] lg:text-7xl">
              Dress for the <span className="italic">feeling.</span>
            </h2>
          </div>
        </div>
      </Reveal>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-5">
        {moods.map((m, i) => (
          <Reveal key={m.label} delay={i * 0.07}>
            <Link
              to="/c/$category"
              params={{ category: m.to }}
              className="group relative block aspect-[3/4] overflow-hidden bg-fog"
            >
              <img
                src={m.img}
                alt={m.label}
                loading="lazy"
                className="h-full w-full object-cover transition duration-[1100ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.06]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-ink/10 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-5 text-paper">
                <p className="text-[11px] uppercase tracking-[0.22em] opacity-70">{m.sub}</p>
                <p className="mt-1 font-display text-3xl leading-tight">{m.label}</p>
                <p className="mt-2 inline-block text-[11px] uppercase tracking-[0.22em] opacity-0 transition group-hover:opacity-100">
                  Shop now →
                </p>
              </div>
            </Link>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
