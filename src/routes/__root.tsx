import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
  Navigate,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { AnnouncementBar } from "@/components/layout/announcement-bar";
import { BottomTabBar } from "@/components/layout/bottom-tab-bar";
import { FlyToCartPortal } from "@/components/ui/fly-to-cart-portal";
import { Toaster } from "@/components/ui/sonner";
import { PaperGrain } from "@/components/ui/paper-grain";
import { RouteTransition } from "@/components/layout/route-transition";
import React, { useEffect, Suspense } from "react";
import { useAuthStore } from "@/lib/store/auth";
import * as Sentry from "@sentry/react";

const CartDrawer = React.lazy(() => import("@/components/cart/cart-drawer").then(m => ({ default: m.CartDrawer })));
const AuthModal = React.lazy(() => import("@/components/layout/auth-modal").then(m => ({ default: m.AuthModal })));
const WelcomeModal = React.lazy(() => import("@/components/welcome-modal").then(m => ({ default: m.WelcomeModal })));
const CommandPalette = React.lazy(() => import("@/components/search/command-palette").then(m => ({ default: m.CommandPalette })));

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-6 text-center">
      <div className="max-w-md">
        <p className="text-[11px] uppercase tracking-[0.22em] text-mute">404</p>
        <h1 className="mt-2 font-display text-6xl">Lost in the stockroom.</h1>
        <p className="mt-3 text-mute">The page you wanted has moved or never existed.</p>
        <Link
          to="/"
          className="mt-8 inline-block bg-ink px-6 py-4 text-[12px] uppercase tracking-[0.22em] text-paper"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-6 text-center">
      <div className="max-w-md">
        <p className="text-[11px] uppercase tracking-[0.22em] text-mute">Error</p>
        <h1 className="mt-2 font-display text-5xl">This page didn't load.</h1>
        <p className="mt-3 text-mute">Try again, or head back home.</p>
        <div className="mt-8 flex justify-center gap-3">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="bg-ink px-6 py-4 text-[12px] uppercase tracking-[0.22em] text-paper"
          >
            Try again
          </button>
          <a
            href="/"
            className="border border-ink px-6 py-4 text-[12px] uppercase tracking-[0.22em]"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Ink Studio — Heavyweight streetwear & custom prints" },
      {
        name: "description",
        content:
          "Heavyweight cotton tees, anime drops, hoodies, jackets, and a print studio for one-of-one pieces.",
      },
      { name: "author", content: "Ink Studio" },
      { property: "og:title", content: "Ink Studio — Heavyweight streetwear & custom prints" },
      {
        property: "og:description",
        content:
          "Heavyweight cotton tees, anime drops, hoodies, jackets, and a print studio for one-of-one pieces.",
      },
      { property: "og:type", content: "website" },
      { property: "og:image", content: "https://raw.githubusercontent.com/AVijit005/fashion-store/main/public/og-image.jpg" },
      { name: "twitter:image", content: "https://raw.githubusercontent.com/AVijit005/fashion-store/main/public/og-image.jpg" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "stylesheet", href: appCss }
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "Ink Studio",
          description:
            "Heavyweight cotton tees, anime drops, hoodies, jackets, and a print studio for one-of-one pieces.",
          url: "/",
        }),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isAdmin = pathname.startsWith("/admin");
  const initializeAuth = useAuthStore((state) => state.initialize);
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isLoading = useAuthStore((state) => state.isLoading);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    initializeAuth();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <Sentry.ErrorBoundary fallback={<div className="flex min-h-screen items-center justify-center text-center p-8 bg-paper text-ink"><p className="text-xl border border-ink p-8">Critical App Error: Something went wrong and the UI crashed. Please refresh.</p></div>}>
        <div className="flex min-h-screen flex-col">
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:bg-ink focus:px-4 focus:py-2 focus:text-paper"
          >
            Skip to content
          </a>
          {!isAdmin && <AnnouncementBar />}
          {!isAdmin && <Navbar />}
          <main id="main-content" className={isAdmin ? "flex-1" : "flex-1 pb-20 lg:pb-0"}>
            {!isAdmin ? (
              <RouteTransition>
                <Outlet />
              </RouteTransition>
            ) : (
              <Outlet />
            )}
          </main>
          {!isAdmin && <Footer />}
          {!isAdmin && <BottomTabBar />}
          
          <Suspense fallback={null}>
            <CartDrawer />
            <AuthModal />
            <WelcomeModal />
            <CommandPalette />
          </Suspense>
          
          {!isAdmin && <FlyToCartPortal />}
          <PaperGrain />
          <Toaster position={isAdmin ? "bottom-right" : "bottom-center"} />
        </div>
      </Sentry.ErrorBoundary>
    </QueryClientProvider>
  );
}
