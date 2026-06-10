import { createFileRoute } from "@tanstack/react-router";
import { breadcrumbJsonLd, collectionJsonLd } from "@/lib/seo";
import { ProductGridShell } from "@/components/plp/product-grid-shell";
import { useState, useEffect } from "react";
import { catalogApi } from "@/lib/api/catalog";
import { type Product } from "@/lib/api/catalog";
import { LoadingState } from "@/components/state/loading";

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

import { useQuery } from "@tanstack/react-query";

function ShopPage() {
  const { data: list = [], isLoading, isError } = useQuery({
    queryKey: ["products", "all"],
    queryFn: async () => {
      const res = await catalogApi.getProducts({ limit: 100 });
      return res.products || [];
    },
  });

  if (isLoading) {
    return <LoadingState label="Loading products" />;
  }

  if (isError) {
    return (
      <div className="py-20 text-center">
        <p className="text-red-500">Failed to load products.</p>
      </div>
    );
  }

  return (
    <ProductGridShell
      eyebrow="All collections"
      title="Shop everything."
      description="Every drop, every collab, every staple. Filter your way in."
      base={list}
    />
  );
}
