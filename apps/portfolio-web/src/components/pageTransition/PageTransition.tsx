import {
  type MouseEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  getDestinationPath,
  navigateWithoutTransition,
  PageTransitionNavigationContext,
  type PageTransitionNavigationCoordinator,
  prefersReducedMotion,
  schedulePageTransitionNavigation,
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
  phase: "cover" | "covered";
};

type PendingNavigation = {
  destinationPathname: string;
  id: string;
  navigating: boolean;
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
  const pendingNavigationRef = useRef<PendingNavigation | null>(null);
  const cancelScheduledNavigationRef = useRef<(() => void) | null>(null);
  const bypassPathnameRef = useRef<string | null>(null);
  const [activeFallback, setActiveFallback] = useState<ActiveFallback | null>(null);

  const cancelActiveTransition = useCallback(() => {
    cancelScheduledNavigationRef.current?.();
    cancelScheduledNavigationRef.current = null;
    pendingNavigationRef.current = null;

    if (fallbackTimerRef.current !== null) {
      window.clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }

    clearRouteTransitionIntent(fallbackIdRef.current);
    fallbackIdRef.current = null;
    setActiveFallback(null);
  }, []);

  const navigateWithTransition = useCallback<PageTransitionNavigationCoordinator>(
    (routerNavigate, fromPathname, to, options = {}) => {
      cancelActiveTransition();
      bypassPathnameRef.current = null;

      const destination = getDestinationPath(to, fromPathname);
      if (!destination) return routerNavigate(to, options);

      const destinationPathname = new URL(destination, window.location.origin).pathname;
      const plan = getPageTransitionPlan(fromPathname, destinationPathname);

      if (plan.scope === "none") return routerNavigate(to, options);

      if (options.viewTransition === false) {
        bypassPathnameRef.current = normalizeRoutePath(destinationPathname);
        return routerNavigate(to, options);
      }

      if (prefersReducedMotion()) return routerNavigate(to, options);

      if (plan.scope === "nested") {
        return navigateWithoutTransition(routerNavigate, to, options);
      }

      const id = markRouteTransitionIntent(plan);
      if (!id) return routerNavigate(to, options);

      const pendingNavigation: PendingNavigation = {
        destinationPathname: normalizeRoutePath(destinationPathname),
        id,
        navigating: false,
      };
      pendingNavigationRef.current = pendingNavigation;
      fallbackIdRef.current = id;
      setActiveFallback({ id, plan, phase: "cover" });

      cancelScheduledNavigationRef.current = schedulePageTransitionNavigation(
        {
          setTimeout: (callback, delayMs) => window.setTimeout(callback, delayMs),
          clearTimeout: (timerId) => window.clearTimeout(timerId),
        },
        () => {
          if (pendingNavigationRef.current?.id !== id) return;
          pendingNavigation.navigating = true;
          void navigateWithoutTransition(routerNavigate, to, options);
        },
        () => {
          if (pendingNavigationRef.current?.id === id) {
            pendingNavigationRef.current = null;
            cancelScheduledNavigationRef.current = null;
            fallbackIdRef.current = null;
            setActiveFallback((current) => (current?.id === id ? null : current));
          }
          clearRouteTransitionIntent(id);
        },
      );

      return;
    },
    [cancelActiveTransition],
  );

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
      void navigateWithTransition(navigate, location.pathname, destination, {});
    },
    [location.pathname, navigate, navigateWithTransition],
  );

  useLayoutEffect(() => {
    const previousPathname = previousPathnameRef.current;
    const previousPath = normalizeRoutePath(previousPathname);
    const currentPath = normalizeRoutePath(location.pathname);
    previousPathnameRef.current = location.pathname;

    if (previousPath === currentPath) return;

    const pendingNavigation = pendingNavigationRef.current;
    if (pendingNavigation?.navigating && pendingNavigation.destinationPathname === currentPath) {
      return;
    }

    if (bypassPathnameRef.current === currentPath) {
      bypassPathnameRef.current = null;
      return;
    }
    bypassPathnameRef.current = null;

    cancelActiveTransition();

    const plan = getPageTransitionPlan(previousPathname, location.pathname);
    if (plan.scope === "none" || prefersReducedMotion()) return;

    const id = markRouteTransitionIntent(plan);
    if (!id) return;

    fallbackIdRef.current = id;
    const phase = plan.scope === "page" ? "covered" : "cover";
    setActiveFallback({ id, plan, phase });

    fallbackTimerRef.current = window.setTimeout(
      () => {
        if (fallbackIdRef.current === id) {
          fallbackIdRef.current = null;
          fallbackTimerRef.current = null;
          setActiveFallback((current) => (current?.id === id ? null : current));
        }
        clearRouteTransitionIntent(id);
      },
      plan.scope === "nested" ? NESTED_TRANSITION_DURATION_MS : PAGE_TRANSITION_DURATION_MS,
    );
  }, [cancelActiveTransition, location.pathname]);

  useEffect(() => {
    return () => {
      cancelScheduledNavigationRef.current?.();
      if (fallbackTimerRef.current !== null) {
        window.clearTimeout(fallbackTimerRef.current);
      }
      clearRouteTransitionIntent(fallbackIdRef.current);
    };
  }, []);

  const activePageTransition = activeFallback?.plan.scope === "page" ? activeFallback : null;

  return (
    <PageTransitionNavigationContext.Provider value={navigateWithTransition}>
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
            data-transition-phase={activePageTransition.phase}
            data-transition-scope={activePageTransition.plan.scope}
            key={activePageTransition.id}
          />
        )}
      </div>
    </PageTransitionNavigationContext.Provider>
  );
}
