import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { ChevronRight, Heart, Plus, Share2, Gift, Flame, Star } from "lucide-react";
import { toast } from "sonner";
import { getProduct, products } from "@/lib/data/products";
import { inr, pct } from "@/lib/format";
import { useCart } from "@/lib/store/cart";
import { useWishlist } from "@/lib/store/wishlist";
import { useRecentlyViewed } from "@/lib/store/recently-viewed";
import { useFlyToCart } from "@/lib/store/fly-to-cart";
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

export const Route = createFileRoute("/p/$slug")({
  loader: async ({ params }) => {
    try {
      const product = await catalogApi.getProductBySlug(params.slug);
      return { product };
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
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Product",
            name: p.name,
            description: p.story,
            image: p.images,
            sku: p.id,
            brand: { "@type": "Brand", name: "Ink Studio" },
            aggregateRating: {
              "@type": "AggregateRating",
              ratingValue: p.rating,
              reviewCount: p.reviews,
            },
            offers: {
              "@type": "Offer",
              priceCurrency: "INR",
              price: p.price,
              availability: "https://schema.org/InStock",
              url,
            },
          }),
        },
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: "/" },
              { "@type": "ListItem", position: 2, name: "Shop", item: "/shop" },
              { "@type": "ListItem", position: 3, name: p.name, item: url },
            ],
          }),
        },
      ],
    };
  },
  component: ProductPage,
});

// deterministic low-stock pseudo-value, so it doesn't shimmer every render
function lowStockFor(id: string): number | null {
  const n = id.split("").reduce((s, c) => s + c.charCodeAt(0), 0);
  const stock = n % 14; // 0..13
  return stock <= 6 ? Math.max(2, stock) : null;
}

function ProductPage() {
  const { product } = Route.useLoaderData();
  const pushRecent = useRecentlyViewed((s) => s.push);

  useEffect(() => {
    if (product) pushRecent(product.id);
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [product, pushRecent]);

  if (!product) throw notFound();

  const [size, setSize] = useState("M");
  const [color, setColor] = useState(product.colors[0].name);
  const [guideOpen, setGuideOpen] = useState(false);
  const add = useCart((s) => s.add);
  const { has, toggle } = useWishlist();
  const launch = useFlyToCart((s) => s.launch);
  const addBtnRef = useRef<HTMLButtonElement>(null);
  const wished = has(product.id);

  const [related, setRelated] = useState<Product[]>([]);
  const [look, setLook] = useState<Product[]>([]);

  useEffect(() => {
    catalogApi
      .getProducts({ category: product.category, limit: 5 })
      .then((res) => {
        setRelated(res.products.filter((p) => p.id !== product.id).slice(0, 4));
      })
      .catch((err) => console.error(err));

    catalogApi
      .getProducts({ limit: 4 })
      .then((res) => {
        setLook(res.products.filter((p) => p.id !== product.id).slice(0, 3));
      })
      .catch((err) => console.error(err));
  }, [product]);

  const discount = pct(product.price, product.mrp);
  const lowStock = lowStockFor(product.id);

  const gallery = [
    product.images[0],
    product.images[1] ?? product.images[0],
    product.images[0],
    product.images[1] ?? product.images[0],
  ];

  const handleAdd = () => {
    const rect = addBtnRef.current?.getBoundingClientRect();
    if (rect) launch(product.images[0], rect);
    // Find the matching variant to get its backend UUID for cart sync
    const selectedVariant = product.variants?.find(
      (v) => v.size === size && v.color === color,
    );
    add({
      id: product.id,
      variantId: selectedVariant?.id,
      slug: product.slug,
      name: product.name,
      image: product.images[0],
      price: product.price,
      mrp: product.mrp,
      size,
      color,
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
                    i < Math.round(product.rating) ? "fill-ink text-ink" : "text-line"
                  }`}
                />
              ))}
            </div>
            <p className="text-[12px] text-mute">
              {product.rating.toFixed(1)} · {product.reviews} reviews
            </p>
          </div>

          <div className="mt-6 flex items-baseline gap-3">
            <p className="font-display text-4xl tabular-nums">{inr(product.price)}</p>
            {discount > 0 && (
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
              className="flex min-h-[56px] items-center justify-center gap-3 bg-ink py-4 text-[12px] uppercase tracking-[0.22em] text-paper transition hover:bg-graphite"
            >
              <Plus className="h-4 w-4" /> Add to bag — {inr(product.price)}
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

          <div className="mt-4 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.18em] text-mute">
            <button
              onClick={() => {
                if (navigator.share) {
                  navigator
                    .share({ title: product.name, url: window.location.href })
                    .catch(() => {});
                } else {
                  navigator.clipboard.writeText(window.location.href);
                  toast("Link copied");
                }
              }}
              className="flex items-center gap-1.5 hover:text-ink"
            >
              <Share2 className="h-3.5 w-3.5" /> Share
            </button>
            <span className="text-line">·</span>
            <button
              onClick={() => toast("Hint sent — link copied to clipboard")}
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
              100% combed cotton, 240gsm. Machine wash cold, inside out. Tumble dry low. Iron
              reverse only.
            </p>
          </details>
          <details className="border-b border-line py-4">
            <summary className="cursor-pointer list-none text-[12px] uppercase tracking-[0.22em]">
              Origin
            </summary>
            <p className="mt-3 text-sm text-graphite">
              Cut and sewn in Tirupur, India. Garment-dyed in small batches by hand.
            </p>
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
              alt=""
              className="h-full w-full object-cover"
            />
          </div>
        </div>
      </section>

      <CompleteTheLook items={look} />

      <ReviewsBlock rating={product.rating} count={product.reviews} />

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
        price={product.price}
        sizes={product.sizes}
        size={size}
        onSize={setSize}
        onAdd={handleAdd}
      />

      <SizeGuideModal open={guideOpen} onClose={() => setGuideOpen(false)} currentSize={size} />
    </article>
  );
}
