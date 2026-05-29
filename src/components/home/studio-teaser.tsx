import { Link } from "@tanstack/react-router";
import { Reveal } from "@/components/ui/reveal";
import studio from "@/assets/studio-teaser.jpg";
import { ArrowRight } from "lucide-react";

export function StudioTeaser() {
  return (
    <section className="bg-paper">
      <div className="mx-auto grid max-w-[1480px] grid-cols-1 gap-10 px-5 py-20 lg:grid-cols-[1.1fr_1fr] lg:gap-16 lg:px-10 lg:py-32">
        <div className="flex flex-col justify-center">
          <Reveal>
            <p className="text-[11px] uppercase tracking-[0.22em] text-mute">Print studio</p>
            <h2 className="mt-3 font-display text-5xl leading-[0.95] lg:text-7xl">
              Make it
              <br />
              <span className="italic">yours.</span>
            </h2>
            <p className="mt-6 max-w-md text-graphite">
              Upload your art, type your words, drop it on a tee, hoodie, mug, or tote. Live mockup,
              no minimums, shipped in 48 hours.
            </p>
            <div className="mt-10 flex items-center gap-6">
              <Link
                to="/studio"
                className="group flex items-center gap-3 bg-ink px-6 py-4 text-[12px] uppercase tracking-[0.22em] text-paper transition hover:bg-graphite"
              >
                Open the studio
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
              </Link>
              <Link
                to="/shop"
                className="text-[12px] uppercase tracking-[0.22em] underline-offset-4 hover:underline"
              >
                Browse ready-made →
              </Link>
            </div>
            <ul className="mt-12 grid grid-cols-2 gap-4 text-[12px] uppercase tracking-[0.18em] text-mute md:grid-cols-4">
              <li>Tees</li>
              <li>Hoodies</li>
              <li>Mugs</li>
              <li>Totes</li>
            </ul>
          </Reveal>
        </div>
        <Reveal delay={0.1} className="relative aspect-[4/5] overflow-hidden bg-fog">
          <img
            src={studio}
            alt="Custom print teaser"
            loading="lazy"
            className="h-full w-full object-cover"
          />
          <div className="absolute right-5 top-5 bg-paper/90 px-3 py-2 text-[10px] uppercase tracking-[0.22em]">
            Live mockup
          </div>
        </Reveal>
      </div>
    </section>
  );
}
