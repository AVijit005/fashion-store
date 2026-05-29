import { createFileRoute } from "@tanstack/react-router";
import { breadcrumbJsonLd, collectionJsonLd } from "@/lib/seo";
import { ProductGridShell } from "@/components/plp/product-grid-shell";
import { useState, useEffect } from "react";
import { catalogApi } from "@/lib/api/catalog";
import { type Product } from "@/lib/data/products";
import { LoadingState } from "@/components/state/loading";
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
  component: SalePage,
});

function SalePage() {
  const [list, setList] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    catalogApi
      .getProducts({ limit: 100 })
      .then((res) => {
        setList(res.products.filter((p) => pct(p.price, p.mrp) >= 25));
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <LoadingState label="Loading sale items" />;
  }

  return (
    <ProductGridShell
      eyebrow="Up to 40% off"
      title="Sale."
      description="A curated cut of the studio, marked down. Limited stock, no codes needed."
      base={list}
    />
  );
}
