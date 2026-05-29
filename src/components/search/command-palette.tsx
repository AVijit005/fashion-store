import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search, ArrowRight, Clock, Flame, X } from "lucide-react";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import { useCommandPalette } from "@/lib/store/command-palette";
import { useRecentSearches } from "@/lib/store/recent-searches";
import { type Product } from "@/lib/data/products";
import { categories } from "@/lib/data/categories";
import { inr } from "@/lib/format";
import { catalogApi } from "@/lib/api/catalog";

const trending = [
  "Anime drops",
  "Oversized tees",
  "Heavyweight hoodies",
  "Field jacket",
  "Custom mugs",
];

const pages: { label: string; to: string; keywords?: string }[] = [
  { label: "New arrivals", to: "/new-arrivals", keywords: "fresh just dropped latest" },
  { label: "Trending now", to: "/trending", keywords: "popular hot" },
  { label: "Drops calendar", to: "/drops", keywords: "release schedule" },
  { label: "Anime universe", to: "/anime-universe", keywords: "anime collab capsule" },
  { label: "Lookbook", to: "/lookbook", keywords: "editorial styled outfits" },
  { label: "Print studio", to: "/studio", keywords: "custom design create" },
  { label: "Gift guide", to: "/gift-guide", keywords: "presents gifting" },
  { label: "Sale", to: "/sale", keywords: "discount off" },
  { label: "Membership", to: "/membership", keywords: "club perks rewards" },
  { label: "Wishlist", to: "/wishlist", keywords: "saved hearts" },
  { label: "Account", to: "/account", keywords: "profile orders" },
  { label: "Cart", to: "/cart", keywords: "bag checkout" },
  { label: "Help center", to: "/help-center", keywords: "faq support contact" },
];

export function CommandPalette() {
  const { open, setOpen } = useCommandPalette();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const recents = useRecentSearches((s) => s.items);
  const pushRecent = useRecentSearches((s) => s.push);
  const clearRecents = useRecentSearches((s) => s.clear);

  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

  // Global hotkey
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  // Query Backend Search API
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      // Default to 5 featured products when search is empty
      catalogApi
        .getProducts({ featured: true, limit: 5 })
        .then((res) => setResults(res.products))
        .catch((err) => console.error(err));
      return;
    }

    setLoading(true);
    const timer = setTimeout(() => {
      catalogApi
        .search(q, { limit: 6 })
        .then((res) => {
          setResults(res);
          setLoading(false);
        })
        .catch((err) => {
          console.error(err);
          setLoading(false);
        });
    }, 250); // Debounce

    return () => clearTimeout(timer);
  }, [query]);

  const go = (to: string, label?: string) => {
    if (label) pushRecent(label);
    setOpen(false);
    setQuery("");
    navigate({ to: to as never });
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Search products, collections, or pages…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList className="max-h-[60vh]">
        <CommandEmpty>
          <div className="px-4 py-8 text-center">
            <p className="font-display text-2xl">No matches.</p>
            <p className="mt-1 text-[12px] text-mute">Try “anime”, “oversized”, or “hoodie”.</p>
          </div>
        </CommandEmpty>

        {query.trim() === "" && recents.length > 0 && (
          <>
            <CommandGroup heading="Recent">
              {recents.map((r) => (
                <CommandItem key={r} value={`recent ${r}`} onSelect={() => setQuery(r)}>
                  <Clock className="h-4 w-4 text-mute" />
                  <span>{r}</span>
                </CommandItem>
              ))}
              <button
                onClick={() => clearRecents()}
                className="ml-2 mt-1 inline-flex items-center gap-1 px-2 py-1 text-[11px] uppercase tracking-[0.18em] text-mute hover:text-ink"
              >
                <X className="h-3 w-3" /> Clear
              </button>
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {query.trim() === "" && (
          <>
            <CommandGroup heading="Trending">
              {trending.map((t) => (
                <CommandItem key={t} value={`trending ${t}`} onSelect={() => setQuery(t)}>
                  <Flame className="h-4 w-4 text-accent" />
                  <span>{t}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {results.length > 0 && (
          <CommandGroup heading="Products">
            {results.map((p) => (
              <CommandItem
                key={p.id}
                value={`${p.name} ${p.tagline} ${p.category}`}
                onSelect={() => go(`/p/${p.slug}`, p.name)}
              >
                <img src={p.images[0]} alt="" className="h-10 w-8 shrink-0 object-cover" />
                <div className="flex-1 truncate">
                  <p className="truncate text-[13px]">{p.name}</p>
                  <p className="truncate text-[11px] text-mute">{p.tagline}</p>
                </div>
                <span className="ml-auto text-[12px] tabular-nums text-mute">{inr(p.price)}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        <CommandSeparator />
        <CommandGroup heading="Categories">
          {categories.slice(0, 8).map((c) => (
            <CommandItem
              key={c.slug}
              value={`category ${c.name}`}
              onSelect={() => go(`/c/${c.slug}`, c.name)}
            >
              <span className="inline-block h-2 w-2 rounded-full bg-ink" />
              <span>{c.name}</span>
              <ArrowRight className="ml-auto h-3.5 w-3.5 text-mute" />
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />
        <CommandGroup heading="Pages">
          {pages.map((p) => (
            <CommandItem
              key={p.to}
              value={`${p.label} ${p.keywords ?? ""}`}
              onSelect={() => go(p.to, p.label)}
            >
              <Search className="h-4 w-4 text-mute" />
              <span>{p.label}</span>
              <ArrowRight className="ml-auto h-3.5 w-3.5 text-mute" />
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
      <div className="flex items-center justify-between border-t border-line px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-mute">
        <span>↑↓ Navigate</span>
        <span>↵ Open</span>
        <span>⌘K Toggle</span>
      </div>
    </CommandDialog>
  );
}
