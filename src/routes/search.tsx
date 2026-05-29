import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { useCommandPalette } from "@/lib/store/command-palette";
import { type Product } from "@/lib/data/products";
import { ProductCard } from "@/components/product/product-card";
import { catalogApi } from "@/lib/api/catalog";
import { LoadingState } from "@/components/state/loading";

export const Route = createFileRoute("/search")({
  head: () => ({
    meta: [
      { title: "Search — Ink Studio" },
      {
        name: "description",
        content: "Search every drop, collab, and staple in the Ink Studio catalog.",
      },
    ],
  }),
  component: SearchPage,
});

function SearchPage() {
  const openPalette = useCommandPalette((s) => s.setOpen);
  const [list, setList] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Auto-open the canonical command palette when arriving on this route.
  useEffect(() => {
    openPalette(true);
  }, [openPalette]);

  useEffect(() => {
    catalogApi
      .getProducts({ featured: true, limit: 8 })
      .then((res) => {
        setList(res.products);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  return (
    <div className="mx-auto max-w-[1480px] px-5 py-12 lg:px-10 lg:py-16">
      <p className="text-[11px] uppercase tracking-[0.22em] text-mute">Search</p>
      <button
        onClick={() => openPalette(true)}
        className="mt-3 flex w-full items-center gap-4 border-b border-ink pb-3 text-left"
      >
        <Search className="mb-1 h-5 w-5" />
        <span className="w-full font-display text-3xl text-mute/60 lg:text-5xl">
          Try “anime hoodie” &nbsp;
          <span className="ml-2 align-middle text-[11px] uppercase tracking-[0.22em] text-mute">
            ⌘K
          </span>
        </span>
      </button>
      <p className="mt-4 text-[12px] text-mute">Featured pieces</p>

      {loading ? (
        <LoadingState label="Loading featured pieces" />
      ) : (
        <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:gap-x-6 xl:grid-cols-4">
          {list.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
