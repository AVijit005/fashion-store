// SEO JSON-LD helpers — single source for every structured-data script.
//
// Phase 5 consolidation: previously the PDP and the __root route each
// inlined their own JSON-LD scripts with subtle drift (sometimes absolute
// URLs, sometimes relative, sometimes missing fields). All structured
// data for these entities now flows through the helpers in this file,
// and every URL goes through `getAbsoluteUrl()` so the site origin
// matches across sitemap / canonical / OG / JSON-LD.

import { SITE_URL, getAbsoluteUrl } from "./env";

// ---- Types ----

interface ProductLike {
  id: string;
  name: string;
  story: string;
  images: string[];
  price: number;
  // Phase 4: rating/reviews removed from JSON-LD until /reviews exists
  // (synthetic counts were a Google manual-action trigger).
}

interface CollectionLike {
  name: string;
  description: string;
  path: string;
  itemCount?: number;
}

interface BreadcrumbItem {
  name: string;
  /** Either an absolute URL or a path beginning with `/`. */
  path: string;
}

// ---- Output type ----
//
// Each helper returns `{ type, children }` so it can be passed straight
// into TanStack Router's `head().scripts` array. The `children` field is
// the pre-serialised JSON string — TanStack Router inserts the result as
// the script body.
export interface JsonLdScript {
  type: "application/ld+json";
  children: string;
}

function absoluteUrl(path: string): string {
  return path.startsWith("http") ? path : getAbsoluteUrl(path);
}

function stringified(payload: Record<string, unknown>): string {
  // Use a stable serialization (sorted keys) so the JSON-LD payload
  // is byte-for-byte identical between server-render and client-render.
  // Otherwise search engines and devtools can flag mismatched JSON.
  const sortKeys = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(sortKeys);
    if (value && typeof value === "object") {
      const obj = value as Record<string, unknown>;
      return Object.keys(obj)
        .sort()
        .reduce<Record<string, unknown>>((acc, k) => {
          acc[k] = sortKeys(obj[k]);
          return acc;
        }, {});
    }
    return value;
  };
  return JSON.stringify(sortKeys(payload));
}

// ---- Helpers ----

/**
 * Product structured data for /p/:slug pages.
 *
 * Phase 5 fix: previously inlined in p.$slug.tsx with `url: url` (relative)
 * which search engines then resolved inconsistently. Now every field is
 * absolute and routed through getAbsoluteUrl().
 *
 * AggregateRating is intentionally omitted until /reviews ships real
 * ratings — fake AggregateRating is a Google manual-action trigger.
 */
export function productJsonLd(p: ProductLike): JsonLdScript {
  const url = getAbsoluteUrl(`/p/${(p as { slug?: string }).slug ?? p.id}`);
  return {
    type: "application/ld+json",
    children: stringified({
      "@context": "https://schema.org",
      "@type": "Product",
      name: p.name,
      description: p.story,
      image: p.images.map(absoluteUrl),
      sku: p.id,
      brand: { "@type": "Brand", name: "Ink Studio" },
      offers: {
        "@type": "Offer",
        priceCurrency: "INR",
        price: p.price,
        availability: "https://schema.org/InStock",
        url,
        seller: { "@type": "Organization", name: "Ink Studio", url: SITE_URL },
      },
    }),
  };
}

/**
 * Organization structured data — emitted once in __root.tsx so every
 * page carries the brand identity schema. Google uses this for the
 * knowledge-panel / brand search result.
 */
export function organizationJsonLd(): JsonLdScript {
  return {
    type: "application/ld+json",
    children: stringified({
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Ink Studio",
      alternateName: "Aura Streetwear",
      description:
        "Heavyweight cotton tees, anime drops, hoodies, jackets, and a print studio for one-of-one pieces.",
      url: SITE_URL,
      logo: getAbsoluteUrl("/favicon.svg"),
      contactPoint: {
        "@type": "ContactPoint",
        contactType: "customer support",
        url: getAbsoluteUrl("/contact"),
      },
      sameAs: [
        // Add real social URLs here as the brand grows.
        "https://www.instagram.com/inkstudio",
      ],
    }),
  };
}

/**
 * WebSite structured data with a SearchAction — emitted once in
 * __root.tsx so Google can render the sitelinks search box.
 */
export function websiteJsonLd(): JsonLdScript {
  return {
    type: "application/ld+json",
    children: stringified({
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "Ink Studio",
      url: SITE_URL,
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${SITE_URL}/search?q={search_term_string}`,
        },
        // OGP expects the property "query-input" — must be a literal
        // string with the {search_term_string} placeholder.
        "query-input": "required name=search_term_string",
      },
    }),
  };
}

export function breadcrumbJsonLd(items: BreadcrumbItem[]): JsonLdScript {
  return {
    type: "application/ld+json",
    children: stringified({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: items.map((it, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: it.name,
        item: absoluteUrl(it.path),
      })),
    }),
  };
}

export function collectionJsonLd(c: CollectionLike): JsonLdScript {
  return {
    type: "application/ld+json",
    children: stringified({
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: c.name,
      description: c.description,
      url: absoluteUrl(c.path),
      ...(c.itemCount
        ? {
            mainEntity: {
              "@type": "ItemList",
              numberOfItems: c.itemCount,
            },
          }
        : {}),
    }),
  };
}

// Re-export the env helpers so existing callers of `seo.ts` (like the
// sitemap route) can pull them from a single import.
export { SITE_URL, getAbsoluteUrl } from "./env";
