import { AnimatePresence, motion } from "framer-motion";
import { X, Plus, Heart, ArrowRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { Product } from "@/lib/data/products";
import { inr, pct } from "@/lib/format";
import { useCart } from "@/lib/store/cart";
import { useWishlist } from "@/lib/store/wishlist";
import { useFlyToCart } from "@/lib/store/fly-to-cart";
import { EASE } from "@/lib/motion";

export function QuickViewDialog({
  product,
  open,
  onClose,
}: {
  product: Product | null;
  open: boolean;
  onClose: () => void;
}) {
  const [size, setSize] = useState("M");
  const [color, setColor] = useState(product?.colors[0].name ?? "");
  const [imgIdx, setImgIdx] = useState(0);
  const add = useCart((s) => s.add);
  const { has, toggle } = useWishlist();
  const launch = useFlyToCart((s) => s.launch);
  const addRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (product) {
      setSize(product.sizes.includes("M") ? "M" : product.sizes[0]);
      setColor(product.colors[0].name);
      setImgIdx(0);
    }
  }, [product]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!product) return null;
  const discount = pct(product.price, product.mrp);
  const wished = has(product.id);

  const handleAdd = () => {
    const selectedVariant = product.variants?.find((v) => v.size === size && v.color === color);
    if (!selectedVariant) {
      toast("This variant is unavailable");
      return;
    }
    const rect = addRef.current?.getBoundingClientRect();
    if (rect) launch(product.images[0], rect);
    add({
      id: product.id,
      variantId: selectedVariant.id,
      slug: product.slug,
      name: product.name,
      image: product.images[0],
      price: product.price,
      mrp: product.mrp,
      size,
      color,
    });
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[58] flex items-end justify-center bg-ink/50 backdrop-blur-sm sm:items-center"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={{ duration: 0.45, ease: EASE }}
            onClick={(e) => e.stopPropagation()}
            className="relative grid w-full max-w-4xl grid-cols-1 overflow-hidden bg-paper sm:max-h-[90vh] sm:grid-cols-2"
          >
            <button
              onClick={onClose}
              aria-label="Close"
              className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center bg-paper/90 hover:bg-fog"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Gallery */}
            <div className="bg-fog">
              <div className="aspect-[4/5] overflow-hidden">
                <img
                  src={product.images[imgIdx] ?? product.images[0]}
                  alt={product.name}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="flex gap-2 p-3">
                {product.images.map((src, i) => (
                  <button
                    key={i}
                    onClick={() => setImgIdx(i)}
                    className={`aspect-[3/4] w-12 overflow-hidden border ${
                      imgIdx === i ? "border-ink" : "border-line"
                    }`}
                  >
                    <img src={src} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            </div>

            {/* Details */}
            <div className="overflow-y-auto p-6 sm:p-8">
              <p className="text-[11px] uppercase tracking-[0.22em] text-mute">{product.tagline}</p>
              <h3 className="mt-2 font-display text-3xl leading-tight">{product.name}</h3>
              <div className="mt-4 flex items-baseline gap-3">
                <p className="font-display text-2xl tabular-nums">{inr(product.price)}</p>
                {discount > 0 && (
                  <>
                    <p className="text-sm text-mute line-through tabular-nums">
                      {inr(product.mrp)}
                    </p>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-accent">
                      −{discount}%
                    </p>
                  </>
                )}
              </div>

              <div className="mt-6">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-mute">Color</p>
                  <p className="text-[12px]">{color}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {product.colors.map((c) => (
                    <button
                      key={c.name}
                      onClick={() => setColor(c.name)}
                      aria-label={c.name}
                      className={`flex h-9 w-9 items-center justify-center border ${
                        color === c.name ? "border-ink" : "border-line"
                      }`}
                    >
                      <span
                        className="h-5 w-5 rounded-full border border-line"
                        style={{ background: c.hex }}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-6">
                <p className="mb-2 text-[11px] uppercase tracking-[0.22em] text-mute">Size</p>
                <div className="grid grid-cols-6 gap-2">
                  {product.sizes.map((s) => (
                    <button
                      key={s}
                      onClick={() => setSize(s)}
                      className={`min-h-[40px] border py-2 text-[12px] uppercase tracking-[0.18em] ${
                        size === s ? "border-ink bg-ink text-paper" : "border-line hover:border-ink"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-6 grid grid-cols-[1fr_auto] gap-2">
                <button
                  ref={addRef}
                  onClick={handleAdd}
                  className="flex min-h-[48px] items-center justify-center gap-2 bg-ink py-3 text-[12px] uppercase tracking-[0.22em] text-paper"
                >
                  <Plus className="h-4 w-4" /> Add to bag
                </button>
                <button
                  onClick={() => {
                    toggle(product.id);
                    toast(wished ? "Removed from wishlist" : "Saved to wishlist");
                  }}
                  aria-label="Wishlist"
                  className="flex h-full w-12 items-center justify-center border border-ink"
                >
                  <Heart className={`h-5 w-5 ${wished ? "fill-ink" : ""}`} />
                </button>
              </div>

              <Link
                to="/p/$slug"
                params={{ slug: product.slug }}
                onClick={onClose}
                className="mt-4 inline-flex items-center gap-1.5 text-[12px] uppercase tracking-[0.22em] text-mute hover:text-ink"
              >
                View full details <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
