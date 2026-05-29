import { useMemo, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SlidersHorizontal, X, ChevronDown } from "lucide-react";
import { ProductCard } from "@/components/product/product-card";
import { Reveal } from "@/components/ui/reveal";
import { products as ALL, type Product } from "@/lib/data/products";

const SIZE_OPTS = ["S", "M", "L", "XL", "XXL"];
const COLOR_OPTS = [
  { name: "Bone", hex: "#f5f3ee" },
  { name: "Fog", hex: "#e8e4dd" },
  { name: "Graphite", hex: "#2d2d2d" },
  { name: "Ink", hex: "#0d0d0d" },
  { name: "Ember", hex: "#c84b1e" },
];
const SORTS = [
  "Featured",
  "Newest",
  "Price: low → high",
  "Price: high → low",
  "Top rated",
] as const;

type SortKey = (typeof SORTS)[number];

export function ProductGridShell({
  title,
  eyebrow,
  description,
  base,
  hero,
}: {
  title: string;
  eyebrow: string;
  description?: string;
  base: Product[];
  hero?: ReactNode;
}) {
  const [sizes, setSizes] = useState<string[]>([]);
  const [colors, setColors] = useState<string[]>([]);
  const [maxPrice, setMaxPrice] = useState(5000);
  const [sort, setSort] = useState<SortKey>("Featured");
  const [mobileOpen, setMobileOpen] = useState(false);

  const list = useMemo(() => {
    let r = base.filter((p) => p.price <= maxPrice);
    if (sizes.length) r = r.filter((p) => p.sizes.some((s) => sizes.includes(s)));
    if (colors.length) r = r.filter((p) => p.colors.some((c) => colors.includes(c.name)));
    switch (sort) {
      case "Newest":
        r = [...r].reverse();
        break;
      case "Price: low → high":
        r = [...r].sort((a, b) => a.price - b.price);
        break;
      case "Price: high → low":
        r = [...r].sort((a, b) => b.price - a.price);
        break;
      case "Top rated":
        r = [...r].sort((a, b) => b.rating - a.rating);
        break;
    }
    return r;
  }, [base, sizes, colors, maxPrice, sort]);

  const activeChips = [
    ...sizes.map((s) => ({
      k: `size:${s}`,
      label: `Size ${s}`,
      clear: () => setSizes(sizes.filter((x) => x !== s)),
    })),
    ...colors.map((c) => ({
      k: `color:${c}`,
      label: c,
      clear: () => setColors(colors.filter((x) => x !== c)),
    })),
    ...(maxPrice < 5000
      ? [{ k: "price", label: `Under ₹${maxPrice}`, clear: () => setMaxPrice(5000) }]
      : []),
  ];

  return (
    <div>
      <header className="border-b border-line bg-paper">
        <div className="mx-auto max-w-[1480px] px-5 py-12 lg:px-10 lg:py-16">
          <p className="text-[11px] uppercase tracking-[0.22em] text-mute">{eyebrow}</p>
          <h1 className="mt-2 font-display text-5xl leading-[0.95] lg:text-7xl">{title}</h1>
          {description && <p className="mt-4 max-w-xl text-mute">{description}</p>}
          {hero}
        </div>
      </header>

      <div className="mx-auto grid max-w-[1480px] grid-cols-1 gap-8 px-5 py-10 lg:grid-cols-[240px_1fr] lg:gap-10 lg:px-10 lg:py-12">
        {/* Sidebar (desktop) */}
        <aside className="hidden lg:block">
          <FilterPanel
            sizes={sizes}
            setSizes={setSizes}
            colors={colors}
            setColors={setColors}
            maxPrice={maxPrice}
            setMaxPrice={setMaxPrice}
          />
        </aside>

        <div>
          <div className="mb-6 flex items-center justify-between gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              aria-label="Open filters"
              className="press icon-btn flex items-center gap-2 border border-line bg-paper px-3 py-2 text-[12px] uppercase tracking-[0.18em] lg:hidden"
            >
              <SlidersHorizontal className="h-4 w-4" /> Filters
            </button>
            <p className="hidden text-[12px] text-mute lg:block">{list.length} items</p>
            <div className="relative ml-auto">
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="appearance-none border border-line bg-paper py-2 pl-3 pr-9 text-[12px] uppercase tracking-[0.18em] outline-none"
              >
                {SORTS.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2" />
            </div>
          </div>

          {activeChips.length > 0 && (
            <div className="mb-6 flex flex-wrap gap-2">
              {activeChips.map((c) => (
                <button
                  key={c.k}
                  onClick={c.clear}
                  aria-label={`Remove filter ${c.label}`}
                  className="press flex items-center gap-2 border border-ink bg-paper px-3 py-1 text-[11px] uppercase tracking-[0.18em] transition hover:bg-ink hover:text-paper"
                >
                  {c.label}
                  <X className="h-3 w-3" aria-hidden="true" />
                </button>
              ))}
            </div>
          )}

          {list.length === 0 ? (
            <div className="flex min-h-[40vh] flex-col items-center justify-center text-center">
              <p className="font-display text-3xl">No matches</p>
              <p className="mt-2 text-mute">Try removing a filter or two.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:gap-x-6 xl:grid-cols-4">
              {list.map((p, i) => (
                <Reveal key={p.id} delay={(i % 4) * 0.05}>
                  <ProductCard product={p} />
                </Reveal>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Mobile filter sheet */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-ink/40 lg:hidden"
            onClick={() => setMobileOpen(false)}
          >
            <motion.aside
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.4 }}
              onClick={(e) => e.stopPropagation()}
              className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-xl bg-paper p-6"
            >
              <div className="mb-4 flex items-center justify-between">
                <p className="font-display text-2xl">Filters</p>
                <button
                  onClick={() => setMobileOpen(false)}
                  aria-label="Close filters"
                  className="icon-btn press"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
              <FilterPanel
                sizes={sizes}
                setSizes={setSizes}
                colors={colors}
                setColors={setColors}
                maxPrice={maxPrice}
                setMaxPrice={setMaxPrice}
              />
              <button
                onClick={() => setMobileOpen(false)}
                className="mt-6 block w-full bg-ink py-4 text-[12px] uppercase tracking-[0.22em] text-paper"
              >
                Show {list.length} results
              </button>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FilterPanel({
  sizes,
  setSizes,
  colors,
  setColors,
  maxPrice,
  setMaxPrice,
}: {
  sizes: string[];
  setSizes: (v: string[]) => void;
  colors: string[];
  setColors: (v: string[]) => void;
  maxPrice: number;
  setMaxPrice: (v: number) => void;
}) {
  const toggle = <T,>(arr: T[], v: T, setter: (v: T[]) => void) =>
    setter(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  return (
    <div className="space-y-8">
      <div>
        <p className="mb-3 text-[11px] uppercase tracking-[0.22em] text-mute">Size</p>
        <div className="grid grid-cols-3 gap-2">
          {SIZE_OPTS.map((s) => {
            const on = sizes.includes(s);
            return (
              <button
                key={s}
                onClick={() => toggle(sizes, s, setSizes)}
                className={`border py-2 text-[12px] uppercase tracking-[0.18em] transition ${on ? "border-ink bg-ink text-paper" : "border-line bg-paper hover:border-ink"}`}
              >
                {s}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="mb-3 text-[11px] uppercase tracking-[0.22em] text-mute">Color</p>
        <ul className="space-y-2">
          {COLOR_OPTS.map((c) => {
            const on = colors.includes(c.name);
            return (
              <li key={c.name}>
                <button
                  onClick={() => toggle(colors, c.name, setColors)}
                  className="flex w-full items-center gap-3 text-[13px]"
                >
                  <span
                    className={`flex h-5 w-5 items-center justify-center border ${on ? "border-ink" : "border-line"}`}
                  >
                    <span className="h-3 w-3 rounded-full" style={{ background: c.hex }} />
                  </span>
                  <span>{c.name}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[11px] uppercase tracking-[0.22em] text-mute">Price</p>
          <p className="text-[12px] tabular-nums">Up to ₹{maxPrice}</p>
        </div>
        <input
          type="range"
          min={500}
          max={5000}
          step={100}
          value={maxPrice}
          onChange={(e) => setMaxPrice(Number(e.target.value))}
          className="w-full accent-ink"
        />
      </div>
    </div>
  );
}
