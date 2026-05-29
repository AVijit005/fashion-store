import { Link } from "@tanstack/react-router";
import { Reveal } from "@/components/ui/reveal";
import lookbook from "@/assets/lookbook-1.jpg";
import drop from "@/assets/campaign-drop.jpg";

export function Lookbook() {
  return (
    <section className="mx-auto max-w-[1480px] px-5 py-20 lg:px-10 lg:py-32">
      <Reveal>
        <p className="text-[11px] uppercase tracking-[0.22em] text-mute">Lookbook</p>
        <h2 className="mt-2 max-w-2xl font-display text-5xl leading-[0.95] lg:text-7xl">
          A field guide to <span className="italic">wearing</span> it.
        </h2>
      </Reveal>

      <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">
        <Reveal className="lg:col-span-7">
          <div className="group relative aspect-[5/6] overflow-hidden bg-fog">
            <img
              src={lookbook}
              alt="Lookbook 01"
              loading="lazy"
              className="h-full w-full object-cover transition duration-[1200ms] group-hover:scale-[1.03]"
            />
            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-6 text-paper">
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] opacity-70">Story 01</p>
                <p className="font-display text-3xl">Golden hour, soft cotton.</p>
              </div>
              <Link
                to="/shop"
                className="border-b border-paper pb-1 text-[11px] uppercase tracking-[0.22em]"
              >
                Shop the story →
              </Link>
            </div>
          </div>
        </Reveal>
        <div className="space-y-6 lg:col-span-5 lg:space-y-8">
          <Reveal delay={0.1}>
            <div className="group relative aspect-[4/3] overflow-hidden bg-fog">
              <img
                src={drop}
                alt="Lookbook 02"
                loading="lazy"
                className="h-full w-full object-cover transition duration-[1200ms] group-hover:scale-[1.03]"
              />
              <div className="absolute inset-x-0 bottom-0 p-5 text-paper">
                <p className="text-[11px] uppercase tracking-[0.22em] opacity-70">Story 02</p>
                <p className="font-display text-2xl">Layering essentials.</p>
              </div>
            </div>
          </Reveal>
          <Reveal delay={0.2}>
            <div className="bg-ink p-8 text-paper">
              <p className="text-[11px] uppercase tracking-[0.22em] text-paper/60">Editorial</p>
              <p className="mt-2 font-display text-3xl">
                "Built to outlast the trend. Designed to outlive the season."
              </p>
              <p className="mt-6 text-[12px] uppercase tracking-[0.18em] text-paper/60">
                — Studio Notes, Vol. 04
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
