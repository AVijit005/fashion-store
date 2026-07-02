import { QueryClient, QueryCache, MutationCache } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { routeTree } from "./routeTree.gen";
import * as Sentry from "@sentry/react";

if (typeof window !== "undefined") {
  // Phase 8 fixes (H-S5 / H-S6):
  //   1. Skip init entirely when no DSN is configured — avoids noisy
  //      console output in local dev / preview environments.
  //   2. Cap prod sample rates at 10% so we don't blow the Sentry quota
  //      on traffic spikes. Errors are still always captured (full
  //      replaysOnErrorSampleRate).
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (dsn) {
    const isProd = import.meta.env.PROD;
    Sentry.init({
      dsn,
      integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration()],
      tracesSampleRate: isProd ? 0.1 : 1.0,
      replaysSessionSampleRate: isProd ? 0.1 : 1.0,
      replaysOnErrorSampleRate: 1.0,
      // Never send PII by default. If we later need user context
      // (email, IP), it must be explicitly set here AND scrubbed.
      sendDefaultPii: false,
    });
  }
}

export const getRouter = () => {
  const queryClient = new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        Sentry.captureException(error);
        // Prevent showing toast on automatic retries to avoid spam
        if (query.state.fetchFailureCount > 1) return;

        // Prevent showing toast if the query explicitly handles the error
        if (query.meta?.errorMessage) {
          toast.error(query.meta.errorMessage as string);
        } else if (!query.meta?.ignoreGlobalError) {
          toast.error(`Error: ${error.message || "Failed to fetch data"}`);
        }
      },
    }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        Sentry.captureException(error);
        if (mutation.meta?.errorMessage) {
          toast.error(mutation.meta.errorMessage as string);
        } else if (!mutation.meta?.ignoreGlobalError) {
          toast.error(`Action failed: ${error.message || "Something went wrong"}`);
        }
      },
    }),
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
