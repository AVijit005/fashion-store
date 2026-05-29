import { createFileRoute } from "@tanstack/react-router";
import { breadcrumbJsonLd, collectionJsonLd } from "@/lib/seo";
import { ProductGridShell } from "@/components/plp/product-grid-shell";
import { products } from "@/lib/data/products";
import { pct } from "@/lib/format";

export const Route = createFileRoute("/sale")({
  head: () => ({
    meta: [
      { title: "Sale — up to 40% off — Ink Studio" },
      {
        name: "description",
        content: "Selected pieces, marked down. Heavyweight cotton, anime drops, hoodies.",
      },
      { property: "og:title", content: "Sale — up to 40% off" },
      { property: "og:url", content: "/sale" },
    ],
    links: [{ rel: "canonical", href: "/sale" }],
    scripts: [
      breadcrumbJsonLd([
        { name: "Home", path: "/" },
        { name: "Sale", path: "/sale" },
      ]),
      collectionJsonLd({
        name: "Sale — Ink Studio",
        description: "Selected pieces, marked down.",
        path: "/sale",
      }),
    ],
  }),
  component: () => (
    <ProductGridShell
      eyebrow="Up to 40% off"
      title="Sale."
      description="A curated cut of the studio, marked down. Limited stock, no codes needed."
      base={products.filter((p) => pct(p.price, p.mrp) >= 25)}
    />
  ),
});
