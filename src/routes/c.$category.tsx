import { createFileRoute, notFound } from "@tanstack/react-router";
import { ProductGridShell } from "@/components/plp/product-grid-shell";
import { useState, useEffect } from "react";
import { catalogApi } from "@/lib/api/catalog";
import { type Product } from "@/lib/data/products";
import { categories } from "@/lib/data/categories";
import { LoadingState } from "@/components/state/loading";

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
  const cat = categories.find((c) => c.slug === category);

  const [list, setList] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    if (category === "new") {
      catalogApi
        .getProducts({ limit: 100 })
        .then((res) => {
          setList(
            res.products.filter((p) => p.badges.includes("new") || p.badges.includes("limited")),
          );
          setLoading(false);
        })
        .catch((err) => {
          console.error(err);
          setLoading(false);
        });
    } else if (category === "sale") {
      catalogApi
        .getProducts({ limit: 100 })
        .then((res) => {
          setList(res.products.filter((p) => p.mrp - p.price >= 400));
          setLoading(false);
        })
        .catch((err) => {
          console.error(err);
          setLoading(false);
        });
    } else {
      catalogApi
        .getProducts({ category, limit: 100 })
        .then((res) => {
          setList(res.products);
          setLoading(false);
        })
        .catch((err) => {
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

  if (!cat) throw notFound();

  if (loading) return <LoadingState label={`Loading ${cat.name}`} />;

  return (
    <ProductGridShell
      eyebrow={
        cat.group === "apparel" ? "Apparel" : cat.group === "print" ? "Print shop" : "Accessories"
      }
      title={cat.name + "."}
      description={cat.blurb}
      base={list}
    />
  );
}
