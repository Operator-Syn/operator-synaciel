import { createContext } from "react";
import type { NavigateFunction, NavigateOptions, To } from "react-router-dom";
import { isReducedMotionEnabled } from "../../preferences/sitePreferences";
import {
  PAGE_TRANSITION_DURATION_MS,
  PAGE_TRANSITION_NAVIGATION_DELAY_MS,
} from "./routeTransition";

export type PageTransitionNavigationCoordinator = (
  navigate: NavigateFunction,
  fromPathname: string,
  to: To,
  options?: NavigateOptions,
) => void | Promise<void>;

export const PageTransitionNavigationContext =
  createContext<PageTransitionNavigationCoordinator | null>(null);

export type PageTransitionTimerScheduler = {
  setTimeout(callback: () => void, delayMs: number): number;
  clearTimeout(timerId: number): void;
};

export function schedulePageTransitionNavigation(
  scheduler: PageTransitionTimerScheduler,
  navigateAtHandoff: () => void,
  finishTransition: () => void,
) {
  const handoffTimerId = scheduler.setTimeout(
    navigateAtHandoff,
    PAGE_TRANSITION_NAVIGATION_DELAY_MS,
  );
  const finishTimerId = scheduler.setTimeout(finishTransition, PAGE_TRANSITION_DURATION_MS);

  return () => {
    scheduler.clearTimeout(handoffTimerId);
    scheduler.clearTimeout(finishTimerId);
  };
}

export function prefersReducedMotion() {
  return isReducedMotionEnabled();
}

export function getDestinationPath(to: To, currentPathname: string) {
  if (typeof to === "number") return null;

  const pathname = typeof to === "string" ? to : to.pathname || currentPathname;
  const url = new URL(pathname, window.location.origin);
  return url.pathname + url.search + url.hash;
}

export function navigateWithoutTransition(
  navigate: NavigateFunction,
  to: To,
  options: NavigateOptions = {},
) {
  return navigate(to, { ...options, viewTransition: false });
}
