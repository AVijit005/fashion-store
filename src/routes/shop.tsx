import { createFileRoute } from "@tanstack/react-router";
import { breadcrumbJsonLd, collectionJsonLd } from "@/lib/seo";
import { ProductGridShell } from "@/components/plp/product-grid-shell";
import { products } from "@/lib/data/products";

export const Route = createFileRoute("/shop")({
  head: () => ({
    meta: [
      { title: "Shop all — Ink Studio" },
      {
        name: "description",
        content: "Heavyweight tees, anime drops, hoodies, jackets and custom prints.",
      },
      { property: "og:title", content: "Shop all — Ink Studio" },
      { property: "og:url", content: "/shop" },
    ],
    links: [{ rel: "canonical", href: "/shop" }],
    scripts: [
      breadcrumbJsonLd([
        { name: "Home", path: "/" },
        { name: "Shop", path: "/shop" },
      ]),
      collectionJsonLd({
        name: "Shop — Ink Studio",
        description: "Heavyweight tees, anime drops, hoodies, jackets and custom prints.",
        path: "/shop",
      }),
    ],
  }),
  component: ShopPage,
});

function ShopPage() {
  return (
    <ProductGridShell
      eyebrow="All collections"
      title="Shop everything."
      description="Every drop, every collab, every staple. Filter your way in."
      base={products}
    />
  );
}
