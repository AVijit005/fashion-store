/**
 * Single source of truth for the production domain and backend API URL.
 *
 * All SEO meta tags, canonical URLs, OpenGraph tags, sitemap.xml, JSON-LD
 * `url` fields, admin previews, and email link generation must import
 * from this module. NEVER hard-code a hostname anywhere else in src/.
 *
 * In Vite / TanStack Start, env vars prefixed with `VITE_` are inlined
 * into the client bundle at build time (read via `import.meta.env`).
 * Plain `process.env` is NOT available on the client and silently
 * returns undefined — which is what caused the original sitemap bug
 * (it always fell back to the hard-coded aurastreetwear.com string).
 */

function readPublicEnv(name: string, fallback: string): string {
  // Build-time inlined value from Vite. On the server route, the value
  // is the same — Vite inlines the same string into both bundles.
  const fromMeta = (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.[
    name
  ];
  if (fromMeta && fromMeta.length > 0) return fromMeta;
  return fallback;
}

export const SITE_URL = readPublicEnv(
  "VITE_SITE_URL",
  // Safe local default — never accidentally ship a placeholder domain.
  "http://localhost:5173",
);

export const API_URL = readPublicEnv("VITE_API_URL", "http://localhost:3000");

export const RAZORPAY_KEY_ID = readPublicEnv("VITE_RAZORPAY_KEY_ID", "");

export const SENTRY_DSN = readPublicEnv("VITE_SENTRY_DSN", "");

export const IS_PRODUCTION = import.meta.env.PROD === true;

/**
 * Convenience: build an absolute URL on the current site origin. Use
 * this for canonical / OG / JSON-LD / sitemap <loc> entries.
 *
 * @example getAbsoluteUrl('/p/cool-tee') === 'https://aurastreetwear.com/p/cool-tee'
 */
export function getAbsoluteUrl(path: string): string {
  const normalised = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_URL}${normalised}`;
}
