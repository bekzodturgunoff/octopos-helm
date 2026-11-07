import {createRootRouteWithContext, Outlet, LinkOptions} from "@tanstack/react-router";
import {QueryClient} from "@tanstack/react-query";
import {FixedFooterProvider} from "@yeahuz/kdsx-react";
import {router} from "@/router";

export type TRouteContext = {
  queryClient: QueryClient;
  backLink?: LinkOptions<typeof router, string, string>;
};

export let Route = createRootRouteWithContext<TRouteContext>()({
  component: () => (
    <FixedFooterProvider>
      <Outlet />
    </FixedFooterProvider>
  ),
});
