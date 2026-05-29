import { Reveal } from "@/components/ui/reveal";
import { Play, Heart } from "lucide-react";

const reels = [
  {
    img: "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=600&q=80&auto=format&fit=crop",
    caption: "Fit check · Void tee",
    likes: "12.4k",
  },
  {
    img: "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=600&q=80&auto=format&fit=crop",
    caption: "Layering studio basics",
    likes: "8.1k",
  },
  {
    img: "https://images.unsplash.com/photo-1620799139507-2a76f79a2f4d?w=600&q=80&auto=format&fit=crop",
    caption: "Atlas hoodie · gold hour",
    likes: "21.6k",
  },
  {
    img: "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=600&q=80&auto=format&fit=crop",
    caption: "Field coach jacket",
    likes: "7.9k",
  },
  {
    img: "https://images.unsplash.com/photo-1554568218-0f1715e72254?w=600&q=80&auto=format&fit=crop",
    caption: "Anime drop unboxing",
    likes: "34.2k",
  },
];

export function ReelsStrip() {
  return (
    <section className="bg-paper">
      <div className="mx-auto max-w-[1480px] px-5 py-20 lg:px-10 lg:py-24">
        <Reveal>
          <div className="mb-8 flex items-end justify-between gap-6">
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-mute">From the feed</p>
              <h2 className="mt-2 font-display text-5xl leading-[0.95] lg:text-6xl">
                Studio <span className="italic">in motion.</span>
              </h2>
            </div>
            <a className="hidden text-[12px] uppercase tracking-[0.2em] underline-offset-4 hover:underline md:inline">
              @inkstudio →
            </a>
          </div>
        </Reveal>

        <div className="flex gap-3 overflow-x-auto pb-2 hide-scrollbar lg:gap-5">
          {reels.map((r, i) => (
            <Reveal key={i} delay={i * 0.05} className="w-[200px] shrink-0 lg:w-[260px]">
              <div className="group relative aspect-[9/16] overflow-hidden bg-fog">
                <img
                  src={r.img}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover transition duration-[1100ms] group-hover:scale-[1.04]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-ink/60 via-transparent to-transparent" />
                <div className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center bg-paper/90 backdrop-blur">
                  <Play className="h-3.5 w-3.5 fill-ink text-ink" />
                </div>
                <div className="absolute inset-x-3 bottom-3 text-paper">
                  <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] opacity-90">
                    <Heart className="h-3 w-3 fill-paper" /> {r.likes}
                  </p>
                  <p className="mt-1 text-[13px] leading-tight">{r.caption}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
