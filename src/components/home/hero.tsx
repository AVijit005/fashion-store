import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import hero from "@/assets/hero-main.jpg";
import { Magnetic } from "@/components/ui/magnetic";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-paper">
      <div className="mx-auto grid max-w-[1480px] grid-cols-1 gap-10 px-5 pb-16 pt-12 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:px-10 lg:pb-24 lg:pt-20">
        <div className="flex flex-col justify-end">
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-[11px] uppercase tracking-[0.28em] text-mute"
          >
            Volume 04 — Autumn drop
          </motion.p>

          <h1 className="mt-4 font-display text-[16vw] leading-[0.85] tracking-[-0.03em] sm:text-[12vw] lg:text-[9vw]">
            {"Heavy".split("").map((c, i) => (
              <motion.span
                key={i}
                initial={{ y: "100%", opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.9, delay: 0.05 + i * 0.04, ease: [0.22, 1, 0.36, 1] }}
                className="inline-block"
              >
                {c}
              </motion.span>
            ))}
            <br />
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1, delay: 0.4 }}
              className="italic text-mute/80"
            >
              cotton.
            </motion.span>{" "}
            <motion.span
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.9, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="inline-block"
            >
              Soft
            </motion.span>{" "}
            <motion.span
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.9, delay: 0.58, ease: [0.22, 1, 0.36, 1] }}
              className="inline-block italic text-mute/80"
            >
              edges.
            </motion.span>
          </h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.8 }}
            className="mt-8 max-w-md text-balance text-base text-graphite"
          >
            A small-batch streetwear studio. Heavyweight cotton, editorial prints, and a print shop
            for one-of-one pieces.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.95 }}
            className="mt-10 flex flex-wrap items-center gap-4"
          >
            <Magnetic>
              <Link
                to="/c/$category"
                params={{ category: "oversized-tees" }}
                className="group flex items-center gap-3 bg-ink px-6 py-4 text-[12px] uppercase tracking-[0.22em] text-paper transition hover:bg-graphite"
              >
                Shop the drop
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
              </Link>
            </Magnetic>
            <Link
              to="/studio"
              className="border-b border-ink pb-1 text-[12px] uppercase tracking-[0.22em]"
            >
              Open the studio →
            </Link>
          </motion.div>

          <div className="mt-12 flex items-center gap-8 text-[11px] uppercase tracking-[0.22em] text-mute">
            <span>240gsm cotton</span>
            <span>·</span>
            <span>Made in small batches</span>
            <span className="hidden sm:inline">·</span>
            <span className="hidden sm:inline">Ships in 48h</span>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 1.04 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
          className="relative aspect-[4/5] overflow-hidden lg:aspect-auto"
        >
          <img
            src={hero}
            alt="Model wearing oversized cream graphic tee"
            className="h-full w-full object-cover"
            width={1920}
            height={1280}
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between p-6 text-paper mix-blend-difference">
            <p className="font-display text-xl">No. 04 / 24</p>
            <p className="text-[11px] uppercase tracking-[0.22em]">Drop 01</p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
