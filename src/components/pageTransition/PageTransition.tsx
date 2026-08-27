import { type MouseEvent, type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  getDestinationPath,
  navigateThroughTransition,
  prefersReducedMotion,
} from "./pageTransitionNavigation";
import {
  clearRouteTransitionIntent,
  getPageTransitionPlan,
  markRouteTransitionIntent,
  NESTED_TRANSITION_DURATION_MS,
  normalizeRoutePath,
  PAGE_TRANSITION_DURATION_MS,
  type PageTransitionPlan,
} from "./routeTransition";

type PageTransitionProps = {
  children: ReactNode;
};

type ActiveFallback = {
  id: string;
  plan: PageTransitionPlan;
};

function shouldProcessInternalClick(event: MouseEvent<HTMLDivElement>, anchor: HTMLAnchorElement) {
  return (
    event.button === 0 &&
    !event.defaultPrevented &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey &&
    !anchor.hasAttribute("download") &&
    !anchor.target &&
    anchor.origin === window.location.origin &&
    anchor.dataset.transitionManaged !== "true" &&
    anchor.dataset.transitionPreserveState !== "true"
  );
}

export default function PageTransition({ children }: PageTransitionProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const previousPathnameRef = useRef(location.pathname);
  const fallbackIdRef = useRef<string | null>(null);
  const fallbackTimerRef = useRef<number | null>(null);
  const [activeFallback, setActiveFallback] = useState<ActiveFallback | null>(null);

  const handleClickCapture = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const anchor = target.closest("a[href]");
      if (!anchor || !(anchor instanceof HTMLAnchorElement)) return;
      if (!shouldProcessInternalClick(event, anchor)) return;

      const destination = getDestinationPath(anchor.href, location.pathname);
      if (!destination) return;

      const destinationPathname = new URL(destination, window.location.origin).pathname;
      const plan = getPageTransitionPlan(location.pathname, destinationPathname);

      if (plan.scope === "none") return;

      event.preventDefault();
      navigateThroughTransition(navigate, location.pathname, destination, {});
    },
    [location.pathname, navigate],
  );

  useEffect(() => {
    return () => {
      if (fallbackTimerRef.current !== null) {
        window.clearTimeout(fallbackTimerRef.current);
      }
      clearRouteTransitionIntent(fallbackIdRef.current);
    };
  }, []);

  useEffect(() => {
    const previousPathname = previousPathnameRef.current;
    const previousPath = normalizeRoutePath(previousPathname);
    const currentPath = normalizeRoutePath(location.pathname);
    previousPathnameRef.current = location.pathname;

    if (previousPath === currentPath) return;

    if (fallbackTimerRef.current !== null) {
      window.clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
    clearRouteTransitionIntent(fallbackIdRef.current);
    fallbackIdRef.current = null;
    setActiveFallback(null);

    const plan = getPageTransitionPlan(previousPathname, location.pathname);

    if (plan.scope === "none" || prefersReducedMotion()) return;

    const id = document.documentElement.dataset.pageTransitionId
      ? document.documentElement.dataset.pageTransitionId
      : markRouteTransitionIntent(plan);

    if (!id) return;

    fallbackIdRef.current = id;
    setActiveFallback({ id, plan });

    fallbackTimerRef.current = window.setTimeout(
      () => {
        if (fallbackIdRef.current === id) {
          fallbackIdRef.current = null;
          fallbackTimerRef.current = null;
          setActiveFallback(null);
        }
        clearRouteTransitionIntent(id);
      },
      plan.scope === "nested" ? NESTED_TRANSITION_DURATION_MS : PAGE_TRANSITION_DURATION_MS,
    );
  }, [location.pathname]);

  const activePageTransition = activeFallback?.plan.scope === "page" ? activeFallback : null;

  return (
    <div
      className="page-transition-root"
      data-transition-direction={activeFallback?.plan.direction}
      data-transition-fallback={activeFallback?.plan.scope}
      data-transition-scope={activeFallback?.plan.scope}
      onClickCapture={handleClickCapture}
    >
      {children}
      {activePageTransition && (
        <div
          aria-hidden="true"
          className="page-transition-curtain"
          data-transition-direction={activePageTransition.plan.direction}
          data-transition-scope={activePageTransition.plan.scope}
          key={activePageTransition.id}
        />
      )}
    </div>
  );
}
