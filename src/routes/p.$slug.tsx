import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useEffect, useRef, useState, useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { Bell, ChevronRight, Heart, Plus, Share2, Gift, Flame, Star } from "lucide-react";
import { toast } from "sonner";
import type { Product } from "@/lib/api/catalog";
import { inr, pct } from "@/lib/format";
import { useCart } from "@/lib/store/cart";
import { useWishlist } from "@/lib/store/wishlist";
import { useHydrated } from "@/hooks/use-hydrated";
import { useRecentlyViewed } from "@/lib/store/recently-viewed";
import { useFlyToCart } from "@/lib/store/fly-to-cart";
import { restockNotificationsApi } from "@/lib/api/restock-notifications";
import { ProductCard } from "@/components/product/product-card";
import { Reveal } from "@/components/ui/reveal";
import { PdpGallery } from "@/components/pdp/gallery";
import { SizeGuideModal } from "@/components/pdp/size-guide-modal";
import { StickyBuyBar } from "@/components/pdp/sticky-buy-bar";
import { PdpTrustRow } from "@/components/pdp/trust-row";
import { CompleteTheLook } from "@/components/pdp/complete-the-look";
import { ReviewsBlock } from "@/components/pdp/reviews-block";
import { EASE } from "@/lib/motion";
import { catalogApi } from "@/lib/api/catalog";
import { SITE_URL } from "@/lib/env";
import { productJsonLd, breadcrumbJsonLd } from "@/lib/seo";

export const Route = createFileRoute("/p/$slug")({
  loader: async ({ params }) => {
    try {
      const product = await catalogApi.getProductBySlug(params.slug);
      const [relatedRes, lookRes] = await Promise.all([
        catalogApi.getProducts({ category: product.category, limit: 5 }),
        catalogApi.getProducts({ limit: 4 }),
      ]);
      const related = relatedRes.products.filter((p: Product) => p.id !== product.id).slice(0, 4);
      const look = lookRes.products.filter((p: Product) => p.id !== product.id).slice(0, 3);
      return { product, related, look };
    } catch (err) {
      throw notFound();
    }
  },
  head: ({ loaderData }) => {
    const p = loaderData?.product;
    if (!p) return { meta: [{ title: "Product — Ink Studio" }] };
    const url = `/p/${p.slug}`;
    return {
      meta: [
        { title: `${p.name} — Ink Studio` },
        { name: "description", content: p.story },
        { property: "og:title", content: `${p.name} — Ink Studio` },
        { property: "og:description", content: p.story },
        { property: "og:type", content: "product" },
        { property: "og:url", content: url },
        { property: "og:image", content: p.images[0] },
        { name: "twitter:image", content: p.images[0] },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        productJsonLd(p),
        breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Shop", path: "/shop" },
          { name: p.name, path: `/p/${(p as { slug?: string }).slug ?? p.id}` },
        ]),
      ],
    };
  },
  component: ProductPage,
});

// Real stock computation handled in component

function ProductPage() {
  const { product, related, look } = Route.useLoaderData() as {
    product: Product;
    related: Product[];
    look: Product[];
  };
  const pushRecent = useRecentlyViewed((s) => s.push);

  useEffect(() => {
    if (product) pushRecent(product.id);
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [product, pushRecent]);

  if (!product) throw notFound();

  const [size, setSize] = useState("M");
  const [color, setColor] = useState(product.colors[0].name);
  const [guideOpen, setGuideOpen] = useState(false);
  // Phase 3 (audit item 3.1): back-in-stock notify-me form state.
  // Email is preserved across size/color changes so users don't have to
  // re-type it while browsing other variants of the same product.
  const [notifyEmail, setNotifyEmail] = useState("");
  const [notifySubscribed, setNotifySubscribed] = useState(false);

  const notifyMutation = useMutation({
    mutationFn: () =>
      restockNotificationsApi.subscribe(product.slug, {
        variantId: selectedVariant?.id ?? "",
        email: notifyEmail,
      }),
    onSuccess: () => {
      setNotifySubscribed(true);
      toast.success("We'll email you the moment it's back.");
    },
    onError: (e: Error) => toast.error(e.message || "Couldn't subscribe. Please try again."),
  });
  const add = useCart((s) => s.add);
  const hydrated = useHydrated();
  const { has, toggle } = useWishlist();
  const _wished = has(product.id);
  const wished = hydrated ? _wished : false;
  const launch = useFlyToCart((s) => s.launch);
  const addBtnRef = useRef<HTMLButtonElement>(null);

  const selectedVariant = product.variants?.find((v) => v.size === size && v.color === color);
  const displayPrice = selectedVariant?.priceOverride
    ? Number(selectedVariant.priceOverride)
    : product.price;
  const discount = pct(displayPrice, product.mrp);

  const totalStock = product.variants?.reduce((s, v) => s + (v.stockQuantity || 0), 0) || 0;
  const lowStock = totalStock > 0 && totalStock <= 10 ? totalStock : null;

  const gallery = useMemo(
    () =>
      product.images && product.images.length > 0
        ? product.images
        : ["https://placehold.co/800x1000/f5f3ee/0d0d0d?text=No+Image"],
    [product.images],
  );

  const handleAdd = () => {
    const rect = addBtnRef.current?.getBoundingClientRect();
    if (rect) launch(product.images[0], rect);
    if (!selectedVariant || selectedVariant.stockQuantity <= 0) {
      toast.error("This size/color combination is out of stock");
      return;
    }
    add({
      id: product.id,
      variantId: selectedVariant.id,
      slug: product.slug,
      name: product.name,
      image: product.images[0],
      price: displayPrice,
      mrp: product.mrp ?? 0,
      size,
      color,
      maxQty: selectedVariant.stockQuantity,
    });
  };

  return (
    <article className="bg-paper pb-24 lg:pb-0">
      <nav className="mx-auto flex max-w-[1480px] items-center gap-2 px-5 py-4 text-[12px] text-mute lg:px-10">
        <Link to="/">Home</Link>
        <ChevronRight className="h-3 w-3" />
        <Link to="/shop">Shop</Link>
        <ChevronRight className="h-3 w-3" />
        <Link to="/c/$category" params={{ category: product.category }}>
          {product.category.replace("-", " ")}
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-ink">{product.name}</span>
      </nav>

      <section className="mx-auto grid max-w-[1480px] grid-cols-1 gap-10 px-5 pb-16 lg:grid-cols-[1fr_460px] lg:gap-16 lg:px-10 lg:pb-24">
        <PdpGallery
          images={gallery}
          alt={product.name}
          overlayBadges={
            <>
              {discount > 0 && (
                <span className="bg-ink px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-paper">
                  −{discount}%
                </span>
              )}
              {product.badges.includes("limited") && (
                <span className="bg-accent px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-accent-foreground">
                  Limited
                </span>
              )}
              {product.badges.includes("trending") && (
                <span className="flex items-center gap-1 bg-paper/95 px-2 py-1 text-[10px] uppercase tracking-[0.18em] backdrop-blur">
                  <Flame className="h-3 w-3" /> Trending
                </span>
              )}
            </>
          }
        />

        {/* Details */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <p className="text-[11px] uppercase tracking-[0.22em] text-mute">{product.tagline}</p>
          <h1 className="mt-2 font-display text-5xl leading-[0.95] lg:text-6xl">{product.name}</h1>

          <div className="mt-4 flex items-center gap-3">
            <div className="flex items-center gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={`h-3.5 w-3.5 ${
                    i < Math.round(product.rating ?? 0) ? "fill-ink text-ink" : "text-line"
                  }`}
                />
              ))}
            </div>
            <p className="text-[12px] text-mute">
              {(product.rating ?? 0).toFixed(1)} · {product.reviews ?? 0} reviews
            </p>
          </div>

          <div className="mt-6 flex items-baseline gap-3">
            <p className="font-display text-4xl tabular-nums">{inr(displayPrice)}</p>
            {discount > 0 && product.mrp != null && (
              <>
                <p className="text-mute line-through tabular-nums">{inr(product.mrp)}</p>
                <p className="text-[12px] uppercase tracking-[0.18em] text-accent">
                  Save {discount}%
                </p>
              </>
            )}
          </div>
          <p className="mt-1 text-[11px] text-mute">Incl. of all taxes</p>

          {lowStock !== null && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: EASE }}
              className="mt-4 inline-flex items-center gap-2 bg-accent/10 px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-accent"
            >
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
              </span>
              Only {lowStock} left
            </motion.div>
          )}

          <div className="mt-8">
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
                  className={`flex h-11 w-11 items-center justify-center border transition ${
                    color === c.name ? "border-ink" : "border-line hover:border-ink"
                  }`}
                >
                  <span
                    className="h-6 w-6 rounded-full border border-line"
                    style={{ background: c.hex }}
                  />
                </button>
              ))}
            </div>
          </div>

          <div className="mt-8">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[11px] uppercase tracking-[0.22em] text-mute">Size</p>
              <button
                onClick={() => setGuideOpen(true)}
                className="text-[11px] uppercase tracking-[0.18em] underline-offset-4 hover:underline"
              >
                Size guide
              </button>
            </div>
            <div className="grid grid-cols-6 gap-2">
              {product.sizes.map((s) => (
                <button
                  key={s}
                  onClick={() => setSize(s)}
                  className={`min-h-[44px] border py-3 text-[12px] uppercase tracking-[0.18em] transition ${
                    size === s
                      ? "border-ink bg-ink text-paper"
                      : "border-line bg-paper hover:border-ink"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-8 grid grid-cols-[1fr_auto] gap-3">
            <motion.button
              ref={addBtnRef}
              whileTap={{ scale: 0.98 }}
              onClick={handleAdd}
              disabled={
                !product.variants?.find((v) => v.size === size && v.color === color) ||
                (product.variants?.find((v) => v.size === size && v.color === color)
                  ?.stockQuantity || 0) <= 0
              }
              className="flex min-h-[56px] items-center justify-center gap-3 bg-ink py-4 text-[12px] uppercase tracking-[0.22em] text-paper transition hover:bg-graphite disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="h-4 w-4" /> Add to bag — {inr(displayPrice)}
            </motion.button>
            <button
              onClick={() => {
                toggle(product.id);
                toast(wished ? "Removed from wishlist" : "Saved to wishlist");
              }}
              aria-label="Wishlist"
              className="flex h-full w-14 items-center justify-center border border-ink"
            >
              <Heart className={`h-5 w-5 transition ${wished ? "fill-ink" : ""}`} />
            </button>
          </div>

          {/* Phase 3 (audit item 3.1): Notify-me form shown only when the
              selected size+color variant is sold out. One email per
              variant — repeat submits are deduped server-side. */}
          {selectedVariant && selectedVariant.stockQuantity <= 0 && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!notifyEmail.includes("@")) {
                  toast.error("Please enter a valid email");
                  return;
                }
                notifyMutation.mutate();
              }}
              className="mt-3 border border-line bg-fog/40 p-4"
            >
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-mute">
                <Bell className="h-3.5 w-3.5" />
                <span>
                  Out of stock · {size} / {color}
                </span>
              </div>
              {notifySubscribed ? (
                <p className="mt-3 text-sm text-ink">
                  ✓ You're on the list. We'll email{" "}
                  <span className="font-medium">{notifyEmail}</span> as soon as it's back.
                </p>
              ) : (
                <>
                  <p className="mt-2 text-sm">Notify me when this size is back in stock.</p>
                  <div className="mt-3 flex gap-2">
                    <input
                      type="email"
                      required
                      value={notifyEmail}
                      onChange={(e) => setNotifyEmail(e.target.value)}
                      placeholder="you@email.com"
                      disabled={notifyMutation.isPending}
                      className="flex-1 border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-ink disabled:opacity-60"
                    />
                    <button
                      type="submit"
                      disabled={notifyMutation.isPending}
                      className="bg-ink px-4 py-2 text-[11px] uppercase tracking-[0.22em] text-paper disabled:opacity-50"
                    >
                      {notifyMutation.isPending ? "…" : "Notify me"}
                    </button>
                  </div>
                </>
              )}
            </form>
          )}

          <div className="mt-4 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.18em] text-mute">
            <button
              onClick={() => {
                if (navigator.share) {
                  navigator
                    .share({ title: product.name, url: window.location.href })
                    .catch((e) => console.error("Share failed", e));
                } else {
                  navigator.clipboard
                    .writeText(window.location.href)
                    .then(() => toast("Link copied"))
                    .catch(() => toast.error("Failed to copy link"));
                }
              }}
              className="flex items-center gap-1.5 hover:text-ink"
            >
              <Share2 className="h-3.5 w-3.5" /> Share
            </button>
            <span className="text-line">·</span>
            <button
              onClick={() => {
                const hintText = `Hey! I've been eyeing the ${product.name} at Ink Studio. Hint hint 😉: ${window.location.href}`;
                if (navigator.share) {
                  navigator
                    .share({ title: "Gift hint", text: hintText, url: window.location.href })
                    .catch((e) => console.error("Share failed", e));
                } else {
                  navigator.clipboard
                    .writeText(hintText)
                    .then(() => toast.success("Hint text & link copied to clipboard"))
                    .catch(() => toast.error("Failed to copy hint"));
                }
              }}
              className="flex items-center gap-1.5 hover:text-ink"
            >
              <Gift className="h-3.5 w-3.5" /> Drop a hint
            </button>
          </div>

          <PdpTrustRow />

          <details className="mt-6 border-b border-line py-4" open>
            <summary className="cursor-pointer list-none text-[12px] uppercase tracking-[0.22em]">
              The story
            </summary>
            <p className="mt-3 text-sm text-graphite">{product.story}</p>
          </details>
          <details className="border-b border-line py-4">
            <summary className="cursor-pointer list-none text-[12px] uppercase tracking-[0.22em]">
              Fabric & care
            </summary>
            <p className="mt-3 text-sm text-graphite">
              {(product as any).tags && (product as any).tags.includes("heavyweight")
                ? "100% combed cotton, 240gsm. Machine wash cold, inside out. Tumble dry low. Iron reverse only."
                : "Premium materials. Follow label instructions for care."}
            </p>
          </details>
          <details className="border-b border-line py-4">
            <summary className="cursor-pointer list-none text-[12px] uppercase tracking-[0.22em]">
              Origin
            </summary>
            <p className="mt-3 text-sm text-graphite">Cut and sewn in Tirupur, India.</p>
          </details>
          <details className="border-b border-line py-4">
            <summary className="cursor-pointer list-none text-[12px] uppercase tracking-[0.22em]">
              Shipping & returns
            </summary>
            <p className="mt-3 text-sm text-graphite">
              Free shipping over ₹999. 7-day no-questions returns with free pickup.
            </p>
          </details>
        </div>
      </section>

      {/* Story block */}
      <section className="bg-fog">
        <div className="mx-auto grid max-w-[1480px] grid-cols-1 gap-10 px-5 py-20 lg:grid-cols-2 lg:px-10 lg:py-28">
          <Reveal>
            <p className="text-[11px] uppercase tracking-[0.22em] text-mute">In the studio</p>
            <h2 className="mt-2 font-display text-5xl leading-[0.95] lg:text-6xl">
              Made for <span className="italic">the long haul.</span>
            </h2>
            <p className="mt-4 max-w-md text-graphite">
              Garment-dyed in small batches, hand-finished, and built to outwear the trend.
              Heavyweight 240gsm combed cotton with a soft, lived-in hand-feel from day one.
            </p>
          </Reveal>
          <div className="aspect-[4/3] overflow-hidden bg-paper">
            <img
              src={product.images[1] ?? product.images[0]}
              alt={`Lifestyle shot of ${product.name}`}
              className="h-full w-full object-cover"
            />
          </div>
        </div>
      </section>

      <CompleteTheLook items={look} />

      <ReviewsBlock slug={product.slug} />

      <section className="mx-auto max-w-[1480px] px-5 py-20 lg:px-10">
        <Reveal>
          <p className="text-[11px] uppercase tracking-[0.22em] text-mute">You may also like</p>
          <h2 className="mt-2 font-display text-4xl lg:text-5xl">
            More from {product.category.replace("-", " ")}
          </h2>
        </Reveal>
        <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-4 lg:gap-x-6">
          {related.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>

      <StickyBuyBar
        name={product.name}
        image={product.images[0]}
        price={displayPrice}
        sizes={product.sizes}
        size={size}
        onSize={setSize}
        onAdd={handleAdd}
      />

      <SizeGuideModal open={guideOpen} onClose={() => setGuideOpen(false)} currentSize={size} />
    </article>
  );
}
