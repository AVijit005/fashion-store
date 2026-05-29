import { createFileRoute } from "@tanstack/react-router";
import { breadcrumbJsonLd, collectionJsonLd } from "@/lib/seo";
import { ProductGridShell } from "@/components/plp/product-grid-shell";
import { products } from "@/lib/data/products";

export const Route = createFileRoute("/new-arrivals")({
  head: () => ({
    meta: [
      { title: "New arrivals — Ink Studio" },
      { name: "description", content: "Fresh drops, this week and last." },
      { property: "og:title", content: "New arrivals — Ink Studio" },
      { property: "og:url", content: "/new-arrivals" },
    ],
    links: [{ rel: "canonical", href: "/new-arrivals" }],
    scripts: [
      breadcrumbJsonLd([
        { name: "Home", path: "/" },
        { name: "New Arrivals", path: "/new-arrivals" },
      ]),
      collectionJsonLd({
        name: "New Arrivals — Ink Studio",
        description: "Fresh drops, this week and last.",
        path: "/new-arrivals",
      }),
    ],
  }),
  component: () => (
    <ProductGridShell
      eyebrow="Just landed"
      title="New arrivals."
      description="Fresh from the studio. Heavyweight cotton, new collabs, and limited editions."
      base={products.filter((p) => p.badges.includes("new"))}
    />
  ),
});
