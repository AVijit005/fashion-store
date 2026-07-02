// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
//
// Phase 8: added @sentry/vite-plugin so production builds upload source
// maps to Sentry. The plugin only runs when:
//   - VITE_SENTRY_UPLOAD === 'true' (set in CI build step)
//   - SENTRY_AUTH_TOKEN / SENTRY_ORG / SENTRY_PROJECT are present
// Otherwise the build runs unchanged.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { sentryVitePlugin } from "@sentry/vite-plugin";

const shouldUploadSentry = process.env.VITE_SENTRY_UPLOAD === "true";
const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN;
const sentryOrg = process.env.SENTRY_ORG;
const sentryProject = process.env.SENTRY_PROJECT || "aura-frontend";

export default defineConfig({
  vite: {
    build: {
      chunkSizeWarningLimit: 1500,
      // Hidden source maps keep the `.map` files out of the public bundle
      // while still letting the @sentry/vite-plugin upload them to Sentry.
      // Stack traces in Sentry then show real `src/...` line numbers instead
      // of minified bundle offsets. Phase 8 (fixes H-S7).
      sourcemap: "hidden",
    },
    plugins: [
      // Sentry source-map uploader. Order matters: the plugin should run
      // AFTER Vite has emitted the bundle so it can read the .map files.
      ...(shouldUploadSentry && sentryAuthToken && sentryOrg
        ? [
            sentryVitePlugin({
              org: sentryOrg,
              project: sentryProject,
              authToken: sentryAuthToken,
              // Nitro / Vercel preset emits the static bundle to
              // `.vercel/output/static/`. We upload from there and delete
              // the .map files so they don't ship to users (the
              // sourcemap:'hidden' setting above means they're not
              // referenced from the bundle, but we belt-and-suspenders
              // delete them anyway).
              sourcemaps: {
                assets: [".vercel/output/static/**/*.js"],
                filesToDeleteAfterUpload: [".vercel/output/static/**/*.map"],
              },
              release: {
                name: process.env.GITHUB_SHA || process.env.npm_package_version,
              },
            }),
          ]
        : []),
    ],
  },
  nitro: {
    preset: "vercel",
    output: {
      dir: ".vercel/output",
      serverDir: ".vercel/output/functions/__server.func",
      publicDir: ".vercel/output/static",
    },
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
