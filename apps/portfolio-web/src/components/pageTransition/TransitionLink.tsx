import type { MouseEventHandler } from "react";
import { Link, type LinkProps } from "react-router-dom";
import useTransitionLinkClick from "./useTransitionLinkClick";

type TransitionLinkProps = Omit<LinkProps, "onClick"> & {
  onBeforeNavigate?: () => void;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
};

export default function TransitionLink({
  onBeforeNavigate,
  onClick,
  ...props
}: TransitionLinkProps) {
  const handleClick = useTransitionLinkClick({
    ...props,
    onBeforeNavigate,
    onClick,
  });

  return <Link {...props} data-transition-managed="true" onClick={handleClick} />;
}
