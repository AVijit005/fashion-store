// SEO JSON-LD helpers — keep small, type-light, plug straight into route head().
//
// Phase 4 fix: SITE_URL used to be hard-coded to "https://inkstudio.vercel.app"
// while the sitemap used "https://aurastreetwear.com" and admin pages used
// "inkstudio.cc" — three different production hostnames shipping simultaneously.
// We now re-export SITE_URL from the single source of truth in env.ts.
export { SITE_URL, getAbsoluteUrl } from "./env";

import { SITE_URL as _SITE_URL } from "./env";

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
        item: it.path.startsWith("http")
          ? it.path
          : `${_SITE_URL}${it.path.startsWith("/") ? "" : "/"}${it.path}`,
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
      url: opts.path.startsWith("http")
        ? opts.path
        : `${_SITE_URL}${opts.path.startsWith("/") ? "" : "/"}${opts.path}`,
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
