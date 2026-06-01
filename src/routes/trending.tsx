import { createFileRoute } from "@tanstack/react-router";
import { breadcrumbJsonLd, collectionJsonLd } from "@/lib/seo";
import { ProductGridShell } from "@/components/plp/product-grid-shell";
import { useState, useEffect } from "react";
import { catalogApi } from "@/lib/api/catalog";
import { type Product } from "@/lib/data/products";
import { LoadingState } from "@/components/state/loading";

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
  component: TrendingPage,
});

function TrendingPage() {
  const [list, setList] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    catalogApi
      .getProducts({ limit: 100 })
      .then((res) => {
        setList(
          res.products.filter(
            (p: Product) => p.badges.includes("trending") || p.badges.includes("bestseller"),
          ),
        );
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <LoadingState label="Loading trending items" />;
  }

  return (
    <ProductGridShell
      eyebrow="Most loved this week"
      title="Trending now."
      description="Ranked by what's in carts, on creators, and out the door."
      base={list}
    />
  );
}
