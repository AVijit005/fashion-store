import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Maximize2, X, ZoomIn } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { EASE } from "@/lib/motion";

type Props = {
  images: string[];
  alt: string;
  overlayBadges?: React.ReactNode;
};

export function PdpGallery({ images, alt, overlayBadges }: Props) {
  const [idx, setIdx] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const mainRef = useRef<HTMLDivElement>(null);

  const next = () => setIdx((i) => (i + 1) % images.length);
  const prev = () => setIdx((i) => (i - 1 + images.length) % images.length);

  // Keyboard nav in lightbox
  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "Escape") setLightbox(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightbox]);

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = mainRef.current?.getBoundingClientRect();
    if (!r) return;
    setPos({
      x: ((e.clientX - r.left) / r.width) * 100,
      y: ((e.clientY - r.top) / r.height) * 100,
    });
  };

  return (
    <>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[68px_1fr] lg:gap-4">
        {/* Thumbnail rail (desktop) */}
        <div className="hidden flex-col gap-3 lg:flex">
          {images.map((src, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              aria-label={`Image ${i + 1}`}
              className={`relative aspect-[3/4] overflow-hidden border transition ${
                idx === i ? "border-ink" : "border-transparent hover:border-line"
              }`}
            >
              <img
                src={src}
                alt={`${alt} - view ${i + 1}`}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>

        {/* Main */}
        <div className="relative">
          {/* Desktop main image with zoom lens */}
          <div
            ref={mainRef}
            role="button"
            aria-label="Zoom image"
            onMouseMove={onMove}
            onMouseLeave={() => setPos(null)}
            onDoubleClick={() => setLightbox(true)}
            onClick={() => setLightbox(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setLightbox(true);
              }
            }}
            tabIndex={0}
            className="group relative hidden aspect-[4/5] cursor-zoom-in overflow-hidden bg-fog lg:block focus:outline-none focus:ring-2 focus:ring-ink"
          >
            <AnimatePresence mode="wait">
              <motion.img
                key={idx}
                src={images[idx]}
                alt={`${alt} - view ${idx + 1}`}
                initial={{ opacity: 0, scale: 1.02 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.55, ease: EASE }}
                className="absolute inset-0 h-full w-full object-cover"
                style={
                  pos
                    ? {
                        transformOrigin: `${pos.x}% ${pos.y}%`,
                        transform: "scale(1.8)",
                        transition: "transform 0.1s linear",
                      }
                    : undefined
                }
              />
            </AnimatePresence>
            <div className="pointer-events-none absolute left-4 top-4 z-10 flex flex-col gap-1">
              {overlayBadges}
            </div>
            <div className="absolute right-3 top-3 z-10 flex items-center gap-1.5 bg-paper/80 px-2 py-1 text-[10px] uppercase tracking-[0.18em] opacity-0 backdrop-blur transition group-hover:opacity-100">
              <ZoomIn className="h-3 w-3" /> Hover to zoom
            </div>
            <button
              onClick={() => setLightbox(true)}
              aria-label="Open fullscreen"
              className="absolute bottom-3 right-3 z-10 flex h-9 w-9 items-center justify-center bg-paper/90 backdrop-blur transition hover:bg-paper"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
            <div className="absolute bottom-3 left-3 z-10 bg-paper/90 px-2 py-1 text-[10px] uppercase tracking-[0.22em] tabular-nums backdrop-blur">
              {idx + 1} / {images.length}
            </div>
          </div>

          {/* Mobile swipe pager */}
          <div className="lg:hidden">
            <div className="relative aspect-[4/5] overflow-hidden bg-fog">
              <div
                className="flex h-full snap-x snap-mandatory overflow-x-auto hide-scrollbar"
                onScroll={(e) => {
                  const w = e.currentTarget.clientWidth;
                  const i = Math.round(e.currentTarget.scrollLeft / w);
                  if (i !== idx) setIdx(i);
                }}
              >
                {images.map((src, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setLightbox(true)}
                    aria-label={`Open image ${i + 1} of ${images.length}`}
                    className="h-full w-full shrink-0 snap-center"
                  >
                    <img src={src} alt={`${alt} ${i + 1}`} loading={i === 0 ? "eager" : "lazy"} className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
              <div className="pointer-events-none absolute left-4 top-4 z-10 flex flex-col gap-1">
                {overlayBadges}
              </div>
              <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 gap-1.5">
                {images.map((_, i) => (
                  <span
                    key={i}
                    className={`h-1 rounded-full transition-all ${
                      i === idx ? "w-6 bg-ink" : "w-1.5 bg-ink/30"
                    }`}
                  />
                ))}
              </div>
            </div>
            <div className="mt-3 flex gap-2 overflow-x-auto hide-scrollbar">
              {images.map((src, i) => (
                <button
                  key={i}
                  onClick={() => setIdx(i)}
                  aria-label={`Show image ${i + 1}`}
                  aria-current={idx === i}
                  className={`aspect-[3/4] w-14 shrink-0 overflow-hidden border transition ${
                    idx === i ? "border-ink" : "border-line"
                  }`}
                >
                  <img
                    src={src}
                    alt={`${alt} - view ${i + 1}`}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightbox && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-center justify-center bg-ink/95"
            onClick={() => setLightbox(false)}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                setLightbox(false);
              }}
              className="absolute right-5 top-5 flex h-11 w-11 items-center justify-center bg-paper/10 text-paper hover:bg-paper/20"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                prev();
              }}
              className="absolute left-3 flex h-11 w-11 items-center justify-center bg-paper/10 text-paper hover:bg-paper/20 lg:left-8"
              aria-label="Previous"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                next();
              }}
              className="absolute right-3 flex h-11 w-11 items-center justify-center bg-paper/10 text-paper hover:bg-paper/20 lg:right-8"
              aria-label="Next"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
            <motion.img
              key={idx}
              src={images[idx]}
              alt={`${alt} - view ${idx + 1}`}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.35, ease: EASE }}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[90vh] max-w-[90vw] object-contain"
            />
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-paper/10 px-3 py-1 text-[11px] uppercase tracking-[0.22em] tabular-nums text-paper">
              {idx + 1} / {images.length}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
