import { createFileRoute, notFound } from "@tanstack/react-router";
import { ProductGridShell } from "@/components/plp/product-grid-shell";
import { products, getByCategory } from "@/lib/data/products";
import { categories } from "@/lib/data/categories";

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

  // Virtual categories
  if (category === "new") {
    return (
      <ProductGridShell
        eyebrow="Just landed"
        title="New arrivals."
        description="The latest from the studio."
        base={products.filter((p) => p.badges.includes("new") || p.badges.includes("limited"))}
      />
    );
  }
  if (category === "sale") {
    return (
      <ProductGridShell
        eyebrow="On sale"
        title="Up to 40% off."
        description="Selected pieces, while stocks last."
        base={products.filter((p) => p.mrp - p.price >= 400)}
      />
    );
  }

  if (!cat) throw notFound();
  const list = getByCategory(category);

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
