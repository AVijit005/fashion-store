import { motion, useInView } from "framer-motion";
import { useRef, type ReactNode } from "react";
import { EASE } from "@/lib/motion";

type Props = {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: "div" | "span" | "h1" | "h2" | "h3" | "p";
};

// "Ink spread" reveal — radial clip-path mask that expands into view.
export function InkReveal({ children, className, delay = 0, as = "div" }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const Tag = motion[as] as typeof motion.div;

  return (
    <Tag
      ref={ref}
      initial={{ clipPath: "circle(0% at 0% 100%)", opacity: 0 }}
      animate={
        inView
          ? { clipPath: "circle(150% at 0% 100%)", opacity: 1 }
          : { clipPath: "circle(0% at 0% 100%)", opacity: 0 }
      }
      transition={{ duration: 1.1, ease: EASE, delay }}
      className={className}
    >
      {children}
    </Tag>
  );
}
