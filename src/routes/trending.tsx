import { createFileRoute } from "@tanstack/react-router";
import { breadcrumbJsonLd, collectionJsonLd } from "@/lib/seo";
import { ProductGridShell } from "@/components/plp/product-grid-shell";
import { products } from "@/lib/data/products";

export const Route = createFileRoute("/trending")({
  head: () => ({
    meta: [
      { title: "Trending now — Ink Studio" },
      { name: "description", content: "What everyone's wearing this week, ranked." },
      { property: "og:title", content: "Trending now — Ink Studio" },
      { property: "og:url", content: "/trending" },
    ],
    links: [{ rel: "canonical", href: "/trending" }],
    scripts: [
      breadcrumbJsonLd([
        { name: "Home", path: "/" },
        { name: "Trending", path: "/trending" },
      ]),
      collectionJsonLd({
        name: "Trending — Ink Studio",
        description: "What everyone is wearing this week, ranked.",
        path: "/trending",
      }),
    ],
  }),
  component: () => (
    <ProductGridShell
      eyebrow="Most loved this week"
      title="Trending now."
      description="Ranked by what's in carts, on creators, and out the door."
      base={products.filter(
        (p) => p.badges.includes("trending") || p.badges.includes("bestseller"),
      )}
    />
  ),
});
