import { Link, useRouterState, useRouter } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { Heart, Search, ShoppingBag, User, Menu, X, ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { useCart } from "@/lib/store/cart";
import { useWishlist } from "@/lib/store/wishlist";
import { useCommandPalette } from "@/lib/store/command-palette";
import { useHydrated } from "@/hooks/use-hydrated";
import { catalogApi, type Product } from "@/lib/api/catalog";
import { useAuthStore } from "@/lib/store/auth";
import { useQuery } from "@tanstack/react-query";

type MegaKey = "Shop" | "Anime" | "Studio" | null;

const megaContent: Record<
  Exclude<MegaKey, null>,
  {
    title: string;
    blurb: string;
    cta: { label: string; to: string; params?: Record<string, string> };
    columns: {
      title: string;
      links: { l: string; to: string; params?: Record<string, string> }[];
    }[];
    featureSlug: string;
    featureLabel: string;
  }
> = {
  Shop: {
    title: "Shop the studio",
    blurb: "Heavyweight cotton, anime drops, hoodies, jackets and accessories.",
    cta: { label: "Shop all", to: "/shop" },
    columns: [
      {
        title: "Categories",
        links: [
          { l: "Oversized tees", to: "/c/$category", params: { category: "oversized-tees" } },
          { l: "Graphic tees", to: "/c/$category", params: { category: "graphic-tees" } },
          { l: "Hoodies", to: "/c/$category", params: { category: "hoodies" } },
          { l: "Sweatshirts", to: "/c/$category", params: { category: "sweatshirts" } },
          { l: "Jackets", to: "/c/$category", params: { category: "jackets" } },
        ],
      },
      {
        title: "Collections",
        links: [
          { l: "New arrivals", to: "/new-arrivals" },
          { l: "Trending now", to: "/trending" },
          { l: "Best sellers", to: "/shop" },
          { l: "Drops calendar", to: "/drops" },
          { l: "Sale", to: "/sale" },
        ],
      },
      {
        title: "Edits",
        links: [
          { l: "Curated outfits", to: "/outfits" },
          { l: "Gift guide", to: "/gift-guide" },
          { l: "Lookbook", to: "/lookbook" },
          { l: "Creators", to: "/creators" },
        ],
      },
    ],
    featureSlug: "void-oversized-tee",
    featureLabel: "The drop · Vol. 04",
  },
  Anime: {
    title: "Anime universe",
    blurb: "Editorial collabs, screen-printed in numbered editions.",
    cta: { label: "Enter the universe", to: "/anime-universe" },
    columns: [
      {
        title: "Capsules",
        links: [
          { l: "Shogun series", to: "/c/$category", params: { category: "anime" } },
          { l: "Ronin series", to: "/c/$category", params: { category: "anime" } },
          { l: "Kage series", to: "/c/$category", params: { category: "anime" } },
          { l: "Phantom series", to: "/c/$category", params: { category: "anime" } },
        ],
      },
      {
        title: "Pieces",
        links: [
          { l: "Anime tees", to: "/c/$category", params: { category: "anime" } },
          { l: "Anime hoodies", to: "/c/$category", params: { category: "hoodies" } },
          { l: "Mobile covers", to: "/c/$category", params: { category: "mobile-covers" } },
          { l: "Posters", to: "/c/$category", params: { category: "posters" } },
        ],
      },
      {
        title: "More",
        links: [
          { l: "Drop calendar", to: "/drops" },
          { l: "Artist collabs", to: "/creators" },
          { l: "Studio notes", to: "/blog" },
        ],
      },
    ],
    featureSlug: "shogun-anime-tee",
    featureLabel: "Anime · Vol. 03",
  },
  Studio: {
    title: "Print studio",
    blurb: "Upload your art, type your words. Live mockup, shipped in 48 hours.",
    cta: { label: "Open the studio", to: "/studio" },
    columns: [
      {
        title: "Customize",
        links: [
          { l: "Custom tees", to: "/studio" },
          { l: "Custom hoodies", to: "/studio" },
          { l: "Custom mugs", to: "/studio" },
          { l: "Custom totes", to: "/studio" },
          { l: "Custom posters", to: "/studio" },
        ],
      },
      {
        title: "Tools",
        links: [
          { l: "Open designer", to: "/studio" },
          { l: "Templates", to: "/studio" },
          { l: "Upload art", to: "/studio" },
        ],
      },
      {
        title: "Help",
        links: [
          { l: "How it works", to: "/help-center" },
          { l: "Bulk orders", to: "/help-center" },
          { l: "Gift cards", to: "/gift-guide" },
        ],
      },
    ],
    featureSlug: "studio-ceramic-mug",
    featureLabel: "Live mockup",
  },
};

const primary: {
  label: string;
  to: string;
  params?: Record<string, string>;
  mega?: Exclude<MegaKey, null>;
}[] = [
  { label: "Shop", to: "/shop", mega: "Shop" },
  { label: "New", to: "/new-arrivals" },
  { label: "Anime", to: "/anime-universe", mega: "Anime" },
  { label: "Drops", to: "/drops" },
  { label: "Lookbook", to: "/lookbook" },
  { label: "Studio", to: "/studio", mega: "Studio" },
  { label: "Sale", to: "/sale" },
];

export function Navbar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const hydrated = useHydrated();
  const cartCountRaw = useCart((s) => s.count());
  const wishCountRaw = useWishlist((s) => s.ids.length);
  const cartCount = hydrated ? cartCountRaw : 0;
  const wishCount = hydrated ? wishCountRaw : 0;
  const setCartOpen = useCart((s) => s.setOpen);
  const openPalette = useCommandPalette((s) => s.setOpen);
  const [scrolled, setScrolled] = useState(false);
  const [mega, setMega] = useState<MegaKey>(null);
  const [mobile, setMobile] = useState(false);
  const setSearchOpen = (_v: boolean) => openPalette(true);
  const searchOpen = false;

  const { isAuthenticated, user, setAuthModalOpen } = useAuthStore();
  const router = useRouter();

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const res = await catalogApi.getCategories();
      return Array.isArray(res) ? res : [];
    },
  });

  const { data: featuredProducts = [] } = useQuery({
    queryKey: ["navbar-featured-products"],
    queryFn: async () => {
      const res = await catalogApi.getProducts({ featured: true, limit: 10 });
      return res.products || [];
    },
  });

  const handleAccountClick = () => {
    if (isAuthenticated) {
      router.navigate({ to: "/account" });
    } else {
      setAuthModalOpen(true);
    }
  };

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMobile(false);
    setMega(null);
  }, [path]);

  const megaData = mega ? { ...megaContent[mega] } : null;
  
  if (megaData && mega === "Shop" && categories.length > 0) {
    megaData.columns = [
      {
        title: "Categories",
        links: categories.slice(0, 6).map((c: any) => ({ 
          l: c.name, 
          to: "/c/$category", 
          params: { category: c.slug } 
        }))
      },
      ...megaContent.Shop.columns.slice(1)
    ];
  }

  const featureProduct = megaData ? featuredProducts.find((p: Product) => p.slug === megaData.featureSlug) || featuredProducts[0] : null;

  return (
    <>
      <motion.header
        initial={false}
        animate={{
          backgroundColor: scrolled ? "rgba(245,243,238,0.82)" : "rgba(245,243,238,1)",
        }}
        transition={{ duration: 0.3 }}
        className={`sticky top-0 z-40 border-b backdrop-blur-xl transition-colors ${scrolled ? "border-line" : "border-transparent"}`}
      >
        <div className="mx-auto flex h-16 max-w-[1480px] items-center justify-between px-5 lg:h-[72px] lg:px-10">
          <button
            className="icon-btn lg:hidden"
            onClick={() => setMobile(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <Link to="/" className="flex items-center gap-2">
            <span className="font-display text-2xl leading-none tracking-tight">
              INK<span className="italic">·</span>STUDIO
            </span>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex" onMouseLeave={() => setMega(null)}>
            {primary.map((p) => (
              <Link
                key={p.label}
                to={p.to}
                onMouseEnter={() => setMega(p.mega ?? null)}
                activeProps={{ className: "text-ink" }}
                activeOptions={{ exact: true }}
                className="px-3 py-2 text-[13px] uppercase tracking-[0.18em] text-ink/80 transition hover:text-ink"
              >
                {p.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-1">
            <button className="icon-btn" onClick={() => setSearchOpen(true)} aria-label="Search">
              <Search className="h-[18px] w-[18px]" />
            </button>
            <Link
              to="/wishlist"
              className="icon-btn relative hidden md:inline-flex"
              aria-label={`Wishlist${wishCount > 0 ? `, ${wishCount} saved` : ""}`}
            >
              <Heart className="h-[18px] w-[18px]" />
              {wishCount > 0 && (
                <span
                  aria-hidden
                  className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-accent"
                />
              )}
            </Link>
            <button
              onClick={handleAccountClick}
              className="icon-btn relative hidden md:inline-flex"
              aria-label="Account"
            >
              <User className="h-[18px] w-[18px]" />
              {isAuthenticated && (
                <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-green-500" />
              )}
            </button>
            <button
              data-cart-target
              onClick={() => setCartOpen(true)}
              aria-label={`Open bag, ${cartCount} item${cartCount === 1 ? "" : "s"}`}
              className="press relative flex h-10 items-center gap-2 bg-ink px-4 text-[12px] uppercase tracking-[0.18em] text-paper transition hover:bg-graphite"
            >
              <ShoppingBag className="h-4 w-4" />
              <span className="hidden sm:inline">Cart</span>
              <motion.span
                key={cartCount}
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 500, damping: 18 }}
                className="tabular-nums"
              >
                ({cartCount})
              </motion.span>
            </button>
          </div>
        </div>

        {/* Mega menu — premium with feature product card */}
        <AnimatePresence>
          {megaData && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              onMouseEnter={() => setMega(mega)}
              onMouseLeave={() => setMega(null)}
              className="absolute left-0 right-0 hidden border-t border-line bg-paper/95 backdrop-blur-xl lg:block"
            >
              <div className="mx-auto grid max-w-[1480px] grid-cols-[1.1fr_2fr_1fr] gap-12 px-10 py-12">
                <div className="space-y-3">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-mute">Overview</p>
                  <p className="font-display text-4xl leading-tight">{megaData.title}</p>
                  <p className="max-w-xs text-sm text-mute">{megaData.blurb}</p>
                  <Link
                    {...(megaData.cta as { to: string })}
                    className="group mt-6 inline-flex items-center gap-2 border-b border-ink pb-1 text-[12px] uppercase tracking-[0.2em]"
                  >
                    {megaData.cta.label}
                    <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" />
                  </Link>
                </div>

                <div className="grid grid-cols-3 gap-8">
                  {megaData.columns.map((col) => (
                    <div key={col.title}>
                      <p className="mb-3 text-[11px] uppercase tracking-[0.22em] text-mute">
                        {col.title}
                      </p>
                      <ul className="space-y-2">
                        {col.links.map((l) => (
                          <li key={l.l}>
                            <Link
                              to={l.to}
                              {...(l.params ? { params: l.params } : {})}
                              className="text-[14px] text-ink/80 transition hover:text-ink"
                            >
                              {l.l}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>

                {featureProduct && (
                  <Link
                    to="/p/$slug"
                    params={{ slug: featureProduct.slug }}
                    className="group block"
                  >
                    <div className="relative aspect-[3/4] overflow-hidden bg-fog">
                      <img
                        src={featureProduct.images[0]}
                        alt={featureProduct.name}
                        className="h-full w-full object-cover transition duration-[900ms] group-hover:scale-105"
                      />
                      <span className="absolute left-3 top-3 bg-paper/95 px-2 py-1 text-[10px] uppercase tracking-[0.18em]">
                        {megaData.featureLabel}
                      </span>
                    </div>
                    <p className="mt-3 truncate text-[13px]">{featureProduct.name}</p>
                    <p className="text-[12px] text-mute">{featureProduct.tagline}</p>
                  </Link>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.header>

      {/* Search overlay */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-sm"
            onClick={() => setSearchOpen(false)}
          >
            <motion.div
              initial={{ y: -40 }}
              animate={{ y: 0 }}
              exit={{ y: -40 }}
              transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.4 }}
              onClick={(e) => e.stopPropagation()}
              className="relative bg-paper p-8 pt-24 lg:p-16"
            >
              <button
                onClick={() => setSearchOpen(false)}
                aria-label="Close search"
                className="icon-btn absolute right-6 top-6"
              >
                <X className="h-5 w-5" />
              </button>
              <div className="mx-auto max-w-4xl">
                <p className="text-[11px] uppercase tracking-[0.22em] text-mute">Search</p>
                <div className="mt-3 flex items-end gap-4 border-b border-ink pb-3">
                  <Search className="mb-1 h-5 w-5" />
                  <input
                    autoFocus
                    placeholder="Try 'anime hoodie'"
                    className="w-full bg-transparent font-display text-3xl outline-none placeholder:text-mute/40 lg:text-5xl"
                  />
                </div>
                <div className="mt-10 grid gap-10 md:grid-cols-[1fr_1fr_1.2fr]">
                  <div>
                    <p className="mb-3 text-[11px] uppercase tracking-[0.22em] text-mute">
                      Trending
                    </p>
                    <ul className="space-y-2">
                      {[
                        "Oversized tees",
                        "Anime drops",
                        "Heavyweight hoodies",
                        "Custom mugs",
                        "Field jacket",
                      ].map((t) => (
                        <li key={t}>
                          <button
                            onClick={() => setSearchOpen(false)}
                            className="text-lg hover:underline"
                          >
                            {t}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="mb-3 text-[11px] uppercase tracking-[0.22em] text-mute">
                      Categories
                    </p>
                    <ul className="grid grid-cols-1 gap-2">
                      {categories.slice(0, 8).map((c) => (
                        <li key={c.slug}>
                          <Link
                            to="/c/$category"
                            params={{ category: c.slug }}
                            onClick={() => setSearchOpen(false)}
                            className="text-[14px] hover:underline"
                          >
                            {c.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="mb-3 text-[11px] uppercase tracking-[0.22em] text-mute">
                      Suggested products
                    </p>
                    <ul className="space-y-3">
                      {featuredProducts.slice(0, 3).map((p: Product) => (
                        <li key={p.id}>
                          <Link
                            to="/p/$slug"
                            params={{ slug: p.slug }}
                            onClick={() => setSearchOpen(false)}
                            className="flex items-center gap-3"
                          >
                            <img
                              src={p.images[0]}
                              alt=""
                              className="h-14 w-12 shrink-0 object-cover"
                            />
                            <span>
                              <span className="block text-[14px]">{p.name}</span>
                              <span className="block text-[12px] text-mute">{p.tagline}</span>
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-ink/40 lg:hidden"
            onClick={() => setMobile(false)}
          >
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.45 }}
              onClick={(e) => e.stopPropagation()}
              className="flex h-full w-[88%] max-w-sm flex-col bg-paper"
            >
              <div className="flex items-center justify-between border-b border-line p-5">
                <span className="font-display text-xl">INK·STUDIO</span>
                <button
                  onClick={() => setMobile(false)}
                  aria-label="Close menu"
                  className="icon-btn"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <nav className="flex-1 overflow-y-auto p-5">
                <ul className="space-y-1">
                  {primary.map((p) => (
                    <li key={p.label}>
                      <Link
                        to={p.to}
                        className="block border-b border-line py-4 font-display text-3xl"
                      >
                        {p.label}
                      </Link>
                    </li>
                  ))}
                </ul>
                <p className="mt-8 text-[11px] uppercase tracking-[0.22em] text-mute">Account</p>
                <ul className="mt-3 space-y-1">
                  <li>
                    {isAuthenticated ? (
                      <Link
                        to="/account"
                        onClick={() => setMobile(false)}
                        className="block py-2 text-base font-semibold text-ink"
                      >
                        My Profile ({user?.email})
                      </Link>
                    ) : (
                      <button
                        onClick={() => {
                          setMobile(false);
                          setAuthModalOpen(true);
                        }}
                        className="block w-full text-left py-2 text-base font-semibold text-ink"
                      >
                        Sign In / Sign Up
                      </button>
                    )}
                  </li>
                </ul>
                <p className="mt-8 text-[11px] uppercase tracking-[0.22em] text-mute">Categories</p>
                <ul className="mt-3 space-y-1">
                  {categories.map((c) => (
                    <li key={c.slug}>
                      <Link
                        to="/c/$category"
                        params={{ category: c.slug }}
                        className="block py-2 text-base"
                      >
                        {c.name}
                      </Link>
                    </li>
                  ))}
                </ul>
                <p className="mt-8 text-[11px] uppercase tracking-[0.22em] text-mute">More</p>
                <ul className="mt-3 space-y-1">
                  {[
                    { l: "Lookbook", to: "/lookbook" as const },
                    { l: "Creators", to: "/creators" as const },
                    { l: "Gift guide", to: "/gift-guide" as const },
                    { l: "Membership", to: "/membership" as const },
                    { l: "Stores", to: "/stores" as const },
                    { l: "About", to: "/about" as const },
                  ].map((m) => (
                    <li key={m.l}>
                      <Link to={m.to} className="block py-2 text-base">
                        {m.l}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
