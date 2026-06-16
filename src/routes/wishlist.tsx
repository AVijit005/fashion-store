import { createFileRoute } from "@tanstack/react-router";
import { Heart } from "lucide-react";
import { useWishlist } from "@/lib/store/wishlist";
import { catalogApi } from "@/lib/api/catalog";
import { useQuery } from "@tanstack/react-query";
import { ProductCard } from "@/components/product/product-card";
import { EmptyState } from "@/components/state/empty";
import { useHydrated } from "@/hooks/use-hydrated";

export const Route = createFileRoute("/wishlist")({
  head: () => ({ meta: [{ title: "Wishlist — Ink Studio" }] }),
  component: Wishlist,
});

function Wishlist() {
  const hydrated = useHydrated();
  const _ids = useWishlist((s) => s.ids);
  const ids = hydrated ? _ids : [];
  const { data } = useQuery({
    queryKey: ["products", "wishlist", ids],
    queryFn: () => catalogApi.getProducts({ ids, limit: 100 }),
    enabled: ids.length > 0,
  });
  const items = data?.products || [];

  return (
    <div className="mx-auto max-w-[1480px] px-5 py-12 lg:px-10 lg:py-16">
      <p className="text-[11px] uppercase tracking-[0.22em] text-mute">Saved</p>
      <h1 className="mt-2 font-display text-5xl lg:text-6xl">Wishlist.</h1>

      {items.length === 0 ? (
        <EmptyState
          icon={<Heart className="h-10 w-10" />}
          eyebrow="Empty"
          title="Nothing saved yet."
          description="Tap the heart on any piece to save it for later."
          cta={{ label: "Start browsing", to: "/shop" }}
          secondary={{ label: "Open studio", to: "/studio" }}
        />
      ) : (
        <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:gap-x-6 xl:grid-cols-4">
          {items.map((p: any, i: number) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
