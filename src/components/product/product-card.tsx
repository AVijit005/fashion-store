import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Eye, Heart } from "lucide-react";
import { memo, useRef, useState } from "react";
import { toast } from "sonner";
import { useWishlist } from "@/lib/store/wishlist";
import { useCart } from "@/lib/store/cart";
import { useFlyToCart } from "@/lib/store/fly-to-cart";
import { QuickViewDialog } from "@/components/product/quick-view-dialog";
import type { Product } from "@/lib/data/products";
import { inr, pct } from "@/lib/format";
import { EASE } from "@/lib/motion";

const badgeStyles: Record<string, string> = {
  new: "bg-ink text-paper",
  trending: "bg-paper text-ink border border-ink",
  limited: "bg-accent text-accent-foreground",
  oversized: "bg-fog text-ink",
  anime: "bg-ink text-paper",
  bestseller: "bg-paper text-ink border border-ink",
};

// deterministic low-stock for psychology
function stockHint(id: string): "low" | "trending" | null {
  const n = id.split("").reduce((s, c) => s + c.charCodeAt(0), 0);
  if (n % 9 === 0) return "low";
  if (n % 5 === 0) return "trending";
  return null;
}

export const ProductCard = memo(function ProductCard({
  product,
  priority = false,
}: {
  product: Product;
  priority?: boolean;
}) {
  const [hover, setHover] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const { has, toggle } = useWishlist();
  const add = useCart((s) => s.add);
  const launch = useFlyToCart((s) => s.launch);
  const cardRef = useRef<HTMLDivElement>(null);
  const wished = has(product.id);
  const discount = pct(product.price, product.mrp);
  const hint = stockHint(product.id);

  const quickAdd = (size: string) => {
    const color = product.colors[0].name;
    const selectedVariant = product.variants?.find((v) => v.size === size && v.color === color);
    if (!selectedVariant || selectedVariant.stockQuantity <= 0) {
      toast.error("This size/color combination is out of stock");
      return;
    }
    const rect = cardRef.current?.getBoundingClientRect();
    if (rect) launch(product.images?.[0] || "https://placehold.co/600x800/f5f3ee/0d0d0d?text=No+Image", rect);
    add({
      id: product.id,
      variantId: selectedVariant.id,
      slug: product.slug,
      name: product.name,
      image: product.images?.[0] || "https://placehold.co/600x800/f5f3ee/0d0d0d?text=No+Image",
      price: product.price,
      mrp: product.mrp,
      size,
      color,
    });
  };

  return (
    <>
      <div
        ref={cardRef}
        className="group relative"
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        <Link to="/p/$slug" params={{ slug: product.slug }} className="block">
          <div className="relative aspect-[3/4] overflow-hidden bg-fog">
            <img
              src={product.images?.[0] || "https://placehold.co/600x800/f5f3ee/0d0d0d?text=No+Image"}
              alt={product.name}
              loading={priority ? "eager" : "lazy"}
              className={`absolute inset-0 h-full w-full object-cover transition-all duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
                hover && product.images?.[1] ? "scale-105 opacity-0" : "scale-100 opacity-100"
              }`}
            />
            {product.images?.[1] && (
              <img
                src={product.images[1]}
                alt=""
                loading="lazy"
                className={`absolute inset-0 h-full w-full object-cover transition-all duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
                  hover ? "scale-100 opacity-100" : "scale-110 opacity-0"
                }`}
              />
            )}

            <div className="absolute left-3 top-3 flex flex-col gap-1">
              {product.badges.map((b) => (
                <span
                  key={b}
                  className={`px-2 py-1 text-[10px] uppercase tracking-[0.18em] ${badgeStyles[b]}`}
                >
                  {b}
                </span>
              ))}
              {discount > 0 && (
                <span className="bg-ink px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-paper">
                  −{discount}%
                </span>
              )}
            </div>

            {/* Top-right actions */}
            <div className="absolute right-3 top-3 flex flex-col gap-2">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  toggle(product.id);
                  toast(wished ? "Removed from wishlist" : "Saved to wishlist");
                }}
                aria-label={
                  wished
                    ? `Remove ${product.name} from wishlist`
                    : `Save ${product.name} to wishlist`
                }
                aria-pressed={wished}
                className="press flex h-9 w-9 items-center justify-center bg-paper/90 backdrop-blur transition hover:bg-paper"
              >
                <Heart
                  className={`h-4 w-4 transition ${wished ? "fill-ink text-ink" : "text-ink"}`}
                />
              </button>
              <motion.button
                initial={false}
                animate={{ opacity: hover ? 1 : 0, x: hover ? 0 : 6 }}
                transition={{ duration: 0.25, ease: EASE }}
                onClick={(e) => {
                  e.preventDefault();
                  setQuickOpen(true);
                }}
                aria-label={`Quick view ${product.name}`}
                className="press hidden h-9 w-9 items-center justify-center bg-paper/90 backdrop-blur transition hover:bg-paper md:flex"
              >
                <Eye className="h-4 w-4" />
              </motion.button>
            </div>

            {/* Bottom: size pills on hover (desktop) */}
            <motion.div
              initial={false}
              animate={{ y: hover ? 0 : 70, opacity: hover ? 1 : 0 }}
              transition={{ duration: 0.35, ease: EASE }}
              className="absolute bottom-3 left-3 right-3 hidden gap-1.5 md:flex"
              onClick={(e) => e.preventDefault()}
            >
              {product.sizes.slice(0, 5).map((s) => (
                <button
                  key={s}
                  onClick={() => quickAdd(s)}
                  aria-label={`Add ${product.name} in size ${s} to bag`}
                  className="press flex h-9 flex-1 items-center justify-center bg-paper/95 text-[11px] uppercase tracking-[0.18em] backdrop-blur transition hover:bg-ink hover:text-paper"
                >
                  {s}
                </button>
              ))}
            </motion.div>

            {/* Low-stock / trending pill at bottom-left */}
            {hint && (
              <div className="absolute bottom-3 left-3 md:hidden">
                <span
                  className={`px-2 py-1 text-[10px] uppercase tracking-[0.18em] backdrop-blur ${
                    hint === "low" ? "bg-accent/90 text-accent-foreground" : "bg-paper/90 text-ink"
                  }`}
                >
                  {hint === "low" ? "Low stock" : "Trending"}
                </span>
              </div>
            )}
          </div>

          <div className="mt-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-[14px]">{product.name}</p>
              <p className="mt-0.5 text-[12px] text-mute">{product.tagline}</p>
            </div>
            <div className="text-right">
              <p className="text-[14px] tabular-nums">{inr(product.price)}</p>
              {discount > 0 && (
                <p className="text-[11px] tabular-nums text-mute line-through">
                  {inr(product.mrp)}
                </p>
              )}
            </div>
          </div>

          <div className="mt-2 flex items-center gap-1.5">
            {product.colors.slice(0, 5).map((c) => (
              <span
                key={c.name}
                className="h-3 w-3 rounded-full border border-line"
                style={{ background: c.hex }}
                title={c.name}
              />
            ))}
            <span className="ml-2 text-[11px] text-mute">
              ★ {(product.rating || 0).toFixed(1)} ({product.reviews || 0})
            </span>
            {hint === "low" && (
              <span className="ml-auto text-[10px] uppercase tracking-[0.18em] text-accent">
                Low stock
              </span>
            )}
          </div>
        </Link>
      </div>

      <QuickViewDialog
        product={quickOpen ? product : null}
        open={quickOpen}
        onClose={() => setQuickOpen(false)}
      />
    </>
  );
});
