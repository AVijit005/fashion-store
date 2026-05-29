import { Link } from "@tanstack/react-router";
import { Reveal } from "@/components/ui/reveal";
import { Instagram } from "lucide-react";

const creators = [
  {
    name: "Aanya Patel",
    handle: "@aanya.ink",
    role: "Stylist · Mumbai",
    img: "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=800&q=80&auto=format&fit=crop",
    followers: "412k",
  },
  {
    name: "Kenji Mori",
    handle: "@kenji.frames",
    role: "Photographer · Tokyo",
    img: "https://images.unsplash.com/photo-1492447166138-50c3889fccb1?w=800&q=80&auto=format&fit=crop",
    followers: "318k",
  },
  {
    name: "Sara Cole",
    handle: "@saracole",
    role: "Creative Director",
    img: "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=800&q=80&auto=format&fit=crop",
    followers: "276k",
  },
  {
    name: "Devon Hart",
    handle: "@dhart",
    role: "Designer · Berlin",
    img: "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=800&q=80&auto=format&fit=crop",
    followers: "201k",
  },
];

export function CreatorSpotlight() {
  return (
    <section className="bg-paper">
      <div className="mx-auto max-w-[1480px] px-5 py-20 lg:px-10 lg:py-28">
        <Reveal>
          <div className="mb-10 flex items-end justify-between gap-6">
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-mute">Wear it like</p>
              <h2 className="mt-2 max-w-2xl font-display text-5xl leading-[0.95] lg:text-6xl">
                Creators in the studio.
              </h2>
            </div>
            <Link
              to="/creators"
              className="hidden shrink-0 text-[12px] uppercase tracking-[0.2em] underline-offset-4 hover:underline md:inline"
            >
              Meet the collective →
            </Link>
          </div>
        </Reveal>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">
          {creators.map((c, i) => (
            <Reveal key={c.name} delay={i * 0.06}>
              <div className="group relative">
                <div className="relative aspect-[4/5] overflow-hidden bg-fog">
                  <img
                    src={c.img}
                    alt={c.name}
                    loading="lazy"
                    className="h-full w-full object-cover transition duration-[1100ms] group-hover:scale-[1.05]"
                  />
                  <div className="absolute inset-x-3 bottom-3 flex items-center justify-between text-paper">
                    <p className="text-[11px] uppercase tracking-[0.22em] mix-blend-difference">
                      {c.followers}
                    </p>
                    <Instagram className="h-4 w-4 mix-blend-difference" />
                  </div>
                </div>
                <p className="mt-3 text-[14px]">{c.name}</p>
                <p className="text-[12px] text-mute">{c.role}</p>
                <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-mute">{c.handle}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
