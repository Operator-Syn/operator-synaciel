import type { MouseEventHandler } from "react";
import { NavLink, type NavLinkProps } from "react-router-dom";
import useTransitionLinkClick from "./useTransitionLinkClick";

type TransitionNavLinkProps = Omit<NavLinkProps, "onClick"> & {
  onBeforeNavigate?: () => void;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
};

export default function TransitionNavLink({
  onBeforeNavigate,
  onClick,
  ...props
}: TransitionNavLinkProps) {
  const handleClick = useTransitionLinkClick({
    ...props,
    onBeforeNavigate,
    onClick,
  });

  return <NavLink {...props} data-transition-managed="true" onClick={handleClick} />;
}
