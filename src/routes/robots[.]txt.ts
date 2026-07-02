import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { SITE_URL } from "@/lib/env";

/**
 * Dynamic robots.txt.
 *
 * Phase 5: previously this was a static file at /public/robots.txt that
 * (a) hard-coded the production host name and (b) didn't include a
 * Sitemap: directive. Crawlers (especially Google) can't discover the
 * sitemap without that line, which means new products don't get
 * re-crawled promptly after a deploy.
 *
 * TanStack Start can serve this from a route file with the bracket-
 * escaped name `robots[.]txt.ts` — see also sitemap[.]xml.ts.
 *
 * The route is plain text so any crawler (Google, Bing, DuckDuckGo,
 * GPTBot, etc.) can parse it without rendering JS.
 */
export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: async () => {
        const body = [
          "# Aura Streetwear & Ink Studio — robots.txt",
          "# Last updated: 2026-07-02",
          "",
          "User-agent: *",
          "Allow: /",
          "",
          "# Private areas — never index",
          "Disallow: /account",
          "Disallow: /checkout",
          "Disallow: /cart",
          "Disallow: /admin",
          "Disallow: /studio",
          "Disallow: /api/",
          "",
          "# Sitemap — absolute URL derived from VITE_SITE_URL so it",
          "# always matches the canonical host (Phase 4 fix).",
          `Sitemap: ${SITE_URL.replace(/\/$/, "")}/sitemap.xml`,
          "",
        ].join("\n");

        return new Response(body, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            // Cache at the edge for 1 hour; safe because the body is
            // regenerated on every deploy (the SITE_URL changes only
            // when the canonical host changes).
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
