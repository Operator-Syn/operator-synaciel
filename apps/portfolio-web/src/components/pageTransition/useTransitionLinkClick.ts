import { type MouseEventHandler, useCallback } from "react";
import { flushSync } from "react-dom";
import type { NavigateOptions, To } from "react-router-dom";
import usePageNavigate from "./usePageNavigate";

export type TransitionLinkClickOptions = Pick<
  NavigateOptions,
  "preventScrollReset" | "relative" | "replace" | "state" | "viewTransition"
> & {
  onBeforeNavigate?: () => void;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
  reloadDocument?: boolean;
  to: To;
};

export default function useTransitionLinkClick({
  onBeforeNavigate,
  onClick,
  preventScrollReset,
  relative,
  reloadDocument,
  replace,
  state,
  to,
  viewTransition,
}: TransitionLinkClickOptions) {
  const navigate = usePageNavigate();

  return useCallback<MouseEventHandler<HTMLAnchorElement>>(
    (event) => {
      const anchor = event.currentTarget;
      onClick?.(event);

      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        reloadDocument ||
        anchor.hasAttribute("download") ||
        anchor.target ||
        anchor.origin !== window.location.origin
      ) {
        return;
      }

      event.preventDefault();
      if (onBeforeNavigate) {
        flushSync(() => onBeforeNavigate());
      }

      void navigate(to, {
        preventScrollReset,
        relative,
        replace,
        state,
        viewTransition,
      });
    },
    [
      navigate,
      onBeforeNavigate,
      onClick,
      preventScrollReset,
      relative,
      reloadDocument,
      replace,
      state,
      to,
      viewTransition,
    ],
  );
}
