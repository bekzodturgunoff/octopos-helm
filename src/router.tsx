import {routeTree} from "./routeTree.gen.ts";
import {createRouter} from "@tanstack/react-router";
import {QueryClient} from "@tanstack/react-query";
import {DefaultErrorComponent} from "./components/error.tsx";

// Helm is always online — it is a console, not a till — so queries use the default network mode
// rather than the dash's offlineFirst, and a short staleTime keeps a list from refetching on
// every hop between a client and back.
export const queryClient = new QueryClient({defaultOptions: {queries: {staleTime: 15_000, retry: 1}}});

export const router = createRouter({
  scrollRestoration: true,
  routeTree,
  context: {
    queryClient,
  },
  defaultPreloadStaleTime: 0,
  defaultPendingMinMs: 0,
  defaultErrorComponent: DefaultErrorComponent,
});
