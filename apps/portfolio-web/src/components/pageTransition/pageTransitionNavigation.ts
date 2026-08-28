import type { NavigateFunction, NavigateOptions, To } from "react-router-dom";
import { isReducedMotionEnabled } from "../../preferences/sitePreferences";
import {
  clearRouteTransitionIntent,
  getPageTransitionPlan,
  markRouteTransitionIntent,
  NESTED_TRANSITION_DURATION_MS,
  PAGE_TRANSITION_DURATION_MS,
  type PageTransitionPlan,
} from "./routeTransition";

export function prefersReducedMotion() {
  return isReducedMotionEnabled();
}

export function getDestinationPath(to: To, currentPathname: string) {
  if (typeof to === "number") return null;

  const pathname = typeof to === "string" ? to : to.pathname || currentPathname;
  const url = new URL(pathname, window.location.origin);
  return url.pathname + url.search + url.hash;
}

function navigateWithoutTransition(navigate: NavigateFunction, to: To, options: NavigateOptions) {
  return navigate(to, { ...options, viewTransition: false });
}

function finishAfterFallback(id: string | null, plan: PageTransitionPlan) {
  if (!id || typeof window === "undefined") return;

  window.setTimeout(
    () => clearRouteTransitionIntent(id),
    plan.scope === "nested" ? NESTED_TRANSITION_DURATION_MS : PAGE_TRANSITION_DURATION_MS,
  );
}

export function navigateThroughTransition(
  navigate: NavigateFunction,
  fromPathname: string,
  to: To,
  options: NavigateOptions = {},
) {
  const destination = getDestinationPath(to, fromPathname);
  if (!destination) return navigate(to, options);

  const destinationPathname = new URL(destination, window.location.origin).pathname;
  const plan = getPageTransitionPlan(fromPathname, destinationPathname);

  if (plan.scope === "none" || options.viewTransition === false || prefersReducedMotion()) {
    return navigate(to, options);
  }

  const id = markRouteTransitionIntent(plan);
  const result = navigateWithoutTransition(navigate, to, options);
  finishAfterFallback(id, plan);
  return result;
}
