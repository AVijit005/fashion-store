import { createFileRoute, notFound } from "@tanstack/react-router";
import { ProductGridShell } from "@/components/plp/product-grid-shell";
import { useState, useEffect } from "react";
import { catalogApi } from "@/lib/api/catalog";
import { type Product } from "@/lib/api/catalog";

import { LoadingState } from "@/components/state/loading";
import * as Sentry from "@sentry/react";

export const Route = createFileRoute("/c/$category")({
  loader: async ({ params }) => {
    try {
      const cats = await catalogApi.getCategories();
      const normalizedCategory = params.category.replace(/ /g, "-");
      const cat = cats.find(
        (c: any) => c.slug === normalizedCategory || c.slug === params.category,
      );
      
      let list: Product[] = [];
      if (params.category === "new") {
        const res = await catalogApi.getProducts({ limit: 100 });
        list = res.products.filter(
          (p: Product) => p.badges.includes("new") || p.badges.includes("limited"),
        );
      } else if (params.category === "sale") {
        const res = await catalogApi.getProducts({ limit: 100 });
        list = res.products.filter((p: Product) => p.mrp - p.price >= 400);
      } else {
        const res = await catalogApi.getProducts({ category: normalizedCategory, limit: 100 });
        list = res.products;
      }

      return { categoryInfo: cat, categorySlug: params.category, list };
    } catch (err) {
      Sentry.captureException(err);
      return { categoryInfo: null, categorySlug: params.category, list: [] };
    }
  },
  head: ({ loaderData }) => {
    const cat = loaderData?.categoryInfo;
    const name =
      cat?.name ??
      (loaderData?.categorySlug
        ? loaderData.categorySlug.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
        : "Shop");
    const desc = cat?.description ?? "Premium streetwear piece. Browse our latest drops.";
    const url = `/c/${loaderData?.categorySlug}`;

    return {
      meta: [
        { title: `${name} — Ink Studio` },
        { name: "description", content: desc },
        { property: "og:title", content: `${name} — Ink Studio` },
        { property: "og:description", content: desc },
        { property: "og:type", content: "website" },
        { property: "og:url", content: url },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  component: CategoryPage,
});

function CategoryPage() {
  const { categorySlug: category, categoryInfo, list } = Route.useLoaderData();

  const catName =
    categoryInfo?.name ?? category.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  const catBlurb = categoryInfo?.description ?? "Explore our collection.";

  if (category === "new") {
    return (
      <ProductGridShell
        eyebrow="Just landed"
        title="New arrivals."
        description="The latest from the studio."
        base={list}
        isLoading={false}
      />
    );
  }

  if (category === "sale") {
    return (
      <ProductGridShell
        eyebrow="On sale"
        title="Up to 40% off."
        description="Selected pieces, while stocks last."
        base={list}
        isLoading={false}
      />
    );
  }

  return (
    <ProductGridShell
      eyebrow="Category"
      title={catName ? catName + "." : ""}
      description={catBlurb}
      base={list}
      isLoading={false}
    />
  );
}
