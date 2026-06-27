import { createFileRoute } from "@tanstack/react-router";
import { breadcrumbJsonLd, collectionJsonLd, SITE_URL } from "@/lib/seo";
import { ProductGridShell } from "@/components/plp/product-grid-shell";
import { useState, useEffect } from "react";
import { catalogApi } from "@/lib/api/catalog";
import { type Product } from "@/lib/api/catalog";
import { LoadingState } from "@/components/state/loading";

export const Route = createFileRoute("/trending")({
  loader: async () => {
    const res = await catalogApi.getProducts({ limit: 100 });
    return {
      products: res.products.filter(
        (p: Product) => p.badges.includes("trending") || p.badges.includes("bestseller")
      ),
    };
  },
  head: () => ({
    meta: [
      { title: "Trending now — Ink Studio" },
      { name: "description", content: "What everyone's wearing this week, ranked." },
      { property: "og:title", content: "Trending now — Ink Studio" },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/trending` }],
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
  const { products } = Route.useLoaderData();

  return (
    <ProductGridShell
      eyebrow="Most loved this week"
      title="Trending now."
      description="Ranked by what's in carts, on creators, and out the door."
      base={products}
      isLoading={false}
    />
  );
}
