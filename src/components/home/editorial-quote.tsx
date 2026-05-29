import { Reveal } from "@/components/ui/reveal";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

export function EditorialQuote() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["10%", "-10%"]);

  return (
    <section ref={ref} className="relative overflow-hidden bg-paper">
      <div className="mx-auto max-w-[1480px] px-5 py-28 lg:px-10 lg:py-40">
        <Reveal>
          <p className="text-[11px] uppercase tracking-[0.22em] text-mute">
            Studio Notes · Vol. 04
          </p>
        </Reveal>
        <motion.h2
          style={{ y }}
          className="mt-6 font-display text-balance text-[12vw] leading-[0.9] tracking-[-0.02em] lg:text-[8vw]"
        >
          <span className="italic text-mute/70">"</span>We don't chase the season.{" "}
          <span className="italic text-mute/70">We outwear it.</span>
          <span className="italic text-mute/70">"</span>
        </motion.h2>
        <Reveal delay={0.2}>
          <p className="mt-10 text-[12px] uppercase tracking-[0.22em] text-mute">
            — Ink Studio, est. 2021
          </p>
        </Reveal>
      </div>
    </section>
  );
}
