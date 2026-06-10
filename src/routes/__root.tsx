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
import { CartDrawer } from "@/components/cart/cart-drawer";
import { FlyToCartPortal } from "@/components/ui/fly-to-cart-portal";
import { WelcomeModal } from "@/components/welcome-modal";
import { Toaster } from "@/components/ui/sonner";
import { CommandPalette } from "@/components/search/command-palette";
import { PaperGrain } from "@/components/ui/paper-grain";
import { RouteTransition } from "@/components/layout/route-transition";
import { useEffect } from "react";
import { useAuthStore } from "@/lib/store/auth";
import { AuthModal } from "@/components/layout/auth-modal";

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

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  if (isAdmin) {
    if (isLoading) {
      return <div className="flex h-screen items-center justify-center">Loading...</div>;
    }
    
    if (!isAuthenticated || user?.role !== "ADMIN") {
      return <Navigate to="/" />;
    }

    return (
      <QueryClientProvider client={queryClient}>
        <Outlet />
        <PaperGrain />
        <Toaster position="bottom-right" />
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex min-h-screen flex-col">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:bg-ink focus:px-4 focus:py-2 focus:text-paper"
        >
          Skip to content
        </a>
        <AnnouncementBar />
        <Navbar />
        <main id="main-content" className="flex-1 pb-20 lg:pb-0">
          <RouteTransition>
            <Outlet />
          </RouteTransition>
        </main>
        <Footer />
        <BottomTabBar />
        <CartDrawer />
        <AuthModal />
        <FlyToCartPortal />
        <WelcomeModal />
        <CommandPalette />
        <PaperGrain />
        <Toaster position="bottom-center" />
      </div>
    </QueryClientProvider>
  );
}
