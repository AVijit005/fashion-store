import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { catalogApi } from "@/lib/api/catalog";

const BASE_URL = process.env.VITE_SITE_URL || "https://aurastreetwear.com";

interface SitemapEntry {
  path: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const staticPaths = [
          "/",
          "/shop",
          "/new-arrivals",
          "/trending",
          "/sale",
          "/drops",
          "/anime-universe",
          "/lookbook",
          "/outfits",
          "/gift-guide",
          "/creators",
          "/studio",
          "/membership",
          "/blog",
          "/about",
          "/contact",
          "/stores",
          "/help-center",
          "/shipping",
          "/returns",
          "/privacy",
          "/terms",
        ];

        const [categories, { products }] = await Promise.all([
          catalogApi.getCategories(),
          catalogApi.getProducts({ limit: 1000 }),
        ]);

        const entries: SitemapEntry[] = [
          ...staticPaths.map((path) => ({
            path,
            changefreq: "weekly" as const,
            priority: path === "/" ? "1.0" : "0.7",
          })),
          ...categories.map((c) => ({
            path: `/c/${c.slug}`,
            changefreq: "weekly" as const,
            priority: "0.7",
          })),
          ...products.map((p: any) => ({
            path: `/p/${p.slug}`,
            changefreq: "weekly" as const,
            priority: "0.6",
          })),
        ];

        const urls = entries.map((e) =>
          [
            `  <url>`,
            `    <loc>${BASE_URL}${e.path}</loc>`,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            `  </url>`,
          ]
            .filter(Boolean)
            .join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
