import React from "react";
import {createLink, LinkComponent, useLocation} from "@tanstack/react-router";
import {LinkComponentProps} from "node_modules/@tanstack/react-router/dist/esm/link";

let BasicNavLink = React.forwardRef<HTMLAnchorElement, React.AnchorHTMLAttributes<HTMLAnchorElement>>((props, ref) => {
  return <a ref={ref} {...props} />;
});

export type NavLinkProps = LinkComponentProps<typeof BasicNavLink>;

let CreatedNavLink = createLink(BasicNavLink);

export let NavLink: LinkComponent<typeof BasicNavLink> = (props) => {
  let location = useLocation();
  return <CreatedNavLink preload="intent" state={() => ({from: location.href})} {...props} />;
};
