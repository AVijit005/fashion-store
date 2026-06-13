import { createFileRoute, notFound } from "@tanstack/react-router";
import { ProductGridShell } from "@/components/plp/product-grid-shell";
import { useState, useEffect } from "react";
import { catalogApi } from "@/lib/api/catalog";
import { type Product } from "@/lib/api/catalog";
import { categories } from "@/lib/api/catalog";
import { LoadingState } from "@/components/state/loading";
import * as Sentry from "@sentry/react";

export const Route = createFileRoute("/c/$category")({
  head: ({ params }) => {
    const cat = categories.find((c) => c.slug === params.category);
    const name = cat?.name ?? "Shop";
    return {
      meta: [
        { title: `${name} — Ink Studio` },
        { name: "description", content: cat?.blurb ?? "Browse our latest drops." },
        { property: "og:title", content: `${name} — Ink Studio` },
      ],
    };
  },
  component: CategoryPage,
});

function CategoryPage() {
  const { category } = Route.useParams();

  const [list, setList] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [catName, setCatName] = useState("");
  const [catBlurb, setCatBlurb] = useState("");

  useEffect(() => {
    setLoading(true);
    
    // Normalize category slug if it contains spaces
    const normalizedCategory = category.replace(/ /g, '-');

    catalogApi.getCategories().then((cats) => {
      const found = cats.find((c: any) => c.slug === normalizedCategory || c.slug === category);
      if (found) {
        setCatName(found.name);
        setCatBlurb(found.description || "Premium streetwear piece.");
      } else {
        // Fallback formatting
        setCatName(category.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()));
        setCatBlurb("Explore our collection.");
      }
    }).catch((err) => {
      Sentry.captureException(err);
      setCatName(category.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()));
      setCatBlurb("Explore our collection.");
    });

    if (category === "new") {
      catalogApi
        .getProducts({ limit: 100 })
        .then((res) => {
          setList(
            res.products.filter((p: Product) => p.badges.includes("new") || p.badges.includes("limited")),
          );
          setLoading(false);
        })
        .catch((err) => {
          Sentry.captureException(err);
          console.error(err);
          setLoading(false);
        });
    } else if (category === "sale") {
      catalogApi
        .getProducts({ limit: 100 })
        .then((res) => {
          setList(res.products.filter((p: Product) => p.mrp - p.price >= 400));
          setLoading(false);
        })
        .catch((err) => {
          Sentry.captureException(err);
          console.error(err);
          setLoading(false);
        });
    } else {
      catalogApi
        .getProducts({ category: normalizedCategory, limit: 100 })
        .then((res) => {
          setList(res.products);
          setLoading(false);
        })
        .catch((err) => {
          Sentry.captureException(err);
          console.error(err);
          setLoading(false);
        });
    }
  }, [category]);

  if (category === "new") {
    if (loading) return <LoadingState label="Loading new arrivals" />;
    return (
      <ProductGridShell
        eyebrow="Just landed"
        title="New arrivals."
        description="The latest from the studio."
        base={list}
      />
    );
  }

  if (category === "sale") {
    if (loading) return <LoadingState label="Loading sale items" />;
    return (
      <ProductGridShell
        eyebrow="On sale"
        title="Up to 40% off."
        description="Selected pieces, while stocks last."
        base={list}
      />
    );
  }

  if (loading) return <LoadingState label="Loading" />;

  return (
    <ProductGridShell
      eyebrow="Category"
      title={catName ? catName + "." : ""}
      description={catBlurb}
      base={list}
    />
  );
}
