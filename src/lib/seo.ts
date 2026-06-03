// SEO JSON-LD helpers — keep small, type-light, plug straight into route head().

export const SITE_URL = "https://inkstudio.vercel.app";
export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    type: "application/ld+json" as const,
    children: JSON.stringify({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: items.map((it, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: it.name,
        item: it.path,
      })),
    }),
  };
}

export function collectionJsonLd(opts: {
  name: string;
  description: string;
  path: string;
  itemCount?: number;
}) {
  return {
    type: "application/ld+json" as const,
    children: JSON.stringify({
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: opts.name,
      description: opts.description,
      url: opts.path,
      ...(opts.itemCount
        ? {
            mainEntity: {
              "@type": "ItemList",
              numberOfItems: opts.itemCount,
            },
          }
        : {}),
    }),
  };
}
