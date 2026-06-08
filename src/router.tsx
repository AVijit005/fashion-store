import { QueryClient, QueryCache, MutationCache } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
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
