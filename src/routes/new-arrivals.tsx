import { createFileRoute } from "@tanstack/react-router";
import { breadcrumbJsonLd, collectionJsonLd } from "@/lib/seo";
import { ProductGridShell } from "@/components/plp/product-grid-shell";
import { useState, useEffect } from "react";
import { catalogApi } from "@/lib/api/catalog";
import { type Product } from "@/lib/api/catalog";
import { LoadingState } from "@/components/state/loading";
import { useQuery } from "@tanstack/react-query";

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
  component: NewArrivalsPage,
});

function NewArrivalsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["products", "new-arrivals"],
    queryFn: () => catalogApi.getProducts({ limit: 50 }),
  });

  const items = (data?.products || []).filter(
    (p: Product) => p.badges.includes("new") || p.badges.includes("limited"),
  );

  return (
    <ProductGridShell
      eyebrow="Just landed"
      title="New arrivals."
      description="Fresh from the studio. Heavyweight cotton, new collabs, and limited editions."
      base={items}
      isLoading={isLoading}
    />
  );
}
