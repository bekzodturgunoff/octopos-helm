import {createFileRoute, Outlet} from "@tanstack/react-router";

export let Route = createFileRoute("/flows")({
  component: Layout,
});

/**
 * The dash's flows layout: on a phone the Save bar is fixed to the bottom, so the page leaves room
 * for it — its measured height (FixedFooter sets --fixed-footer-height) plus a little air — or the
 * last field would sit underneath it with no way to scroll to it.
 */
function Layout() {
  return (
    <div className="pb-[calc(var(--fixed-footer-height,4.25rem)+1.5rem)] md:pb-16">
      <Outlet />
    </div>
  );
}
