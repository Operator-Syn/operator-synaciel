import { createContext } from "react";
import type { NavigateFunction, NavigateOptions, To } from "react-router-dom";
import { isReducedMotionEnabled } from "../../preferences/sitePreferences";

export type PageTransitionNavigationCoordinator = (
  navigate: NavigateFunction,
  fromPathname: string,
  to: To,
  options?: NavigateOptions,
) => void | Promise<void>;

export const PageTransitionNavigationContext =
  createContext<PageTransitionNavigationCoordinator | null>(null);
export const PageTransitionActiveContext = createContext(false);

export type PageTransitionTimerScheduler = {
  setTimeout(callback: () => void, delayMs: number): number;
  clearTimeout(timerId: number): void;
};

export function schedulePageTransitionHandoff(
  scheduler: PageTransitionTimerScheduler,
  delayMs: number,
  revealDestination: () => void,
) {
  const handoffTimerId = scheduler.setTimeout(revealDestination, delayMs);
  return () => scheduler.clearTimeout(handoffTimerId);
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
