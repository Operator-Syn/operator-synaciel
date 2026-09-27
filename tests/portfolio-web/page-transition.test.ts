import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";
import { schedulePageTransitionHandoff } from "../../apps/portfolio-web/src/components/pageTransition/pageTransitionNavigation.ts";
import {
  getPageTransitionPlan,
  getPageTransitionScope,
  getRouteRailIndex,
  NESTED_TRANSITION_DURATION_MS,
  normalizeRoutePath,
  PAGE_TRANSITION_COVER_DURATION_MS,
  PAGE_TRANSITION_DURATION_MS,
  PAGE_TRANSITION_HANDOFF_DURATION_MS,
  PAGE_TRANSITION_PRE_REVEAL_DURATION_MS,
  PAGE_TRANSITION_REVEAL_DURATION_MS,
} from "../../apps/portfolio-web/src/components/pageTransition/routeTransition.ts";

const repositoryRoot = resolve(import.meta.dirname, "../../apps/portfolio-web");
const transitionEnginePath = resolve(
  repositoryRoot,
  "src/components/pageTransition/pageTransitionNavigation.ts",
);
const transitionBoundaryPath = resolve(
  repositoryRoot,
  "src/components/pageTransition/PageTransition.tsx",
);
const routeIntentPath = resolve(repositoryRoot, "src/components/pageTransition/routeTransition.ts");
const transitionStylesPath = resolve(repositoryRoot, "src/styles/page-transition.css");
const motionTokensPath = resolve(repositoryRoot, "src/styles/tokens.css");
const appSourcePath = resolve(repositoryRoot, "src/App.tsx");
const loadingStylesPath = resolve(repositoryRoot, "src/styles/loading-state.css");
const homepageMotionPath = resolve(repositoryRoot, "src/components/homePage/useHomepageMotion.ts");
const asyncImagePath = resolve(repositoryRoot, "src/components/asyncImageLoader/AsyncImage.tsx");

test("normalizes route paths without changing the root", () => {
  assert.equal(normalizeRoutePath("/projects///"), "/projects");
  assert.equal(normalizeRoutePath("/"), "/");
});

test("keeps the intentional transition timing contract", () => {
  assert.equal(PAGE_TRANSITION_COVER_DURATION_MS, 250);
  assert.equal(PAGE_TRANSITION_DURATION_MS, 560);
  assert.equal(PAGE_TRANSITION_HANDOFF_DURATION_MS, 80);
  assert.equal(PAGE_TRANSITION_PRE_REVEAL_DURATION_MS, 330);
  assert.equal(PAGE_TRANSITION_REVEAL_DURATION_MS, 230);
  assert.equal(NESTED_TRANSITION_DURATION_MS, 220);
});

test("shows a responsive loading shell while lazy route modules load", async () => {
  const [appSource, loadingStyles] = await Promise.all([
    readFile(appSourcePath, "utf8"),
    readFile(loadingStylesPath, "utf8"),
  ]);

  assert.match(appSource, /<Suspense fallback={<RouteLoadingFallback \/>}>/);
  assert.match(
    appSource,
    /<LoadingRegion className="app-route-loading page-frame" label="Loading page">/,
  );
  assert.match(appSource, /app-route-loading-row/);
  assert.match(loadingStyles, /\.app-route-loading\s*\{[\s\S]*?min-height:/);
  assert.match(loadingStyles, /\.app-route-loading-title\s*\{[\s\S]*?height:/);
  assert.match(loadingStyles, /\.app-route-loading-row\s*\{[\s\S]*?grid-template-columns:/);
  assert.match(
    loadingStyles,
    /@media \(max-width: 760px\)[\s\S]*?\.app-route-loading-row\s*\{[\s\S]*?grid-template-columns:/,
  );
  assert.match(
    loadingStyles,
    /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.loading-region::before/,
  );
});

function createTransitionScheduler() {
  let now = 0;
  let nextId = 0;
  const timers = new Map<number, { callback: () => void; dueAt: number }>();

  return {
    setTimeout(callback: () => void, delayMs: number) {
      const id = ++nextId;
      timers.set(id, { callback, dueAt: now + delayMs });
      return id;
    },
    clearTimeout(id: number) {
      timers.delete(id);
    },
    advanceBy(durationMs: number) {
      const targetTime = now + durationMs;

      while (true) {
        const nextTimer = [...timers.entries()]
          .filter(([, timer]) => timer.dueAt <= targetTime)
          .sort((left, right) => left[1].dueAt - right[1].dueAt || left[0] - right[0])[0];

        if (!nextTimer) break;

        const [id, timer] = nextTimer;
        timers.delete(id);
        now = timer.dueAt;
        timer.callback();
      }

      now = targetTime;
    },
  };
}

test("holds the fully covered route for 80ms before revealing", () => {
  const scheduler = createTransitionScheduler();
  const events: string[] = [];

  schedulePageTransitionHandoff(scheduler, PAGE_TRANSITION_HANDOFF_DURATION_MS, () =>
    events.push("reveal"),
  );

  scheduler.advanceBy(PAGE_TRANSITION_HANDOFF_DURATION_MS - 1);
  assert.deepEqual(events, []);
  scheduler.advanceBy(1);
  assert.deepEqual(events, ["reveal"]);
});

test("cancels a pending reveal handoff when a transition is interrupted", () => {
  const scheduler = createTransitionScheduler();
  const events: string[] = [];

  const cancelFirst = schedulePageTransitionHandoff(
    scheduler,
    PAGE_TRANSITION_HANDOFF_DURATION_MS,
    () => events.push("first reveal"),
  );
  scheduler.advanceBy(PAGE_TRANSITION_HANDOFF_DURATION_MS / 2);
  cancelFirst();

  schedulePageTransitionHandoff(scheduler, PAGE_TRANSITION_HANDOFF_DURATION_MS, () =>
    events.push("second reveal"),
  );
  scheduler.advanceBy(PAGE_TRANSITION_HANDOFF_DURATION_MS - 1);
  assert.deepEqual(events, []);
  scheduler.advanceBy(1);
  assert.deepEqual(events, ["second reveal"]);
});

test("maps primary routes to their rail order", () => {
  assert.equal(getRouteRailIndex("/"), 0);
  assert.equal(getRouteRailIndex("/projects"), 1);
  assert.equal(getRouteRailIndex("/certificates"), 2);
  assert.equal(getRouteRailIndex("/snippets/database/"), 3);
  assert.equal(getRouteRailIndex("/privacy-policy"), null);
});

test("uses page transitions for primary, utility, and document routes", () => {
  assert.equal(getPageTransitionScope("/"), "page");
  assert.equal(getPageTransitionScope("/privacy-policy"), "page");
  assert.equal(getPageTransitionScope("/snippets/document/22/database-migrations.md"), "page");
  assert.equal(getPageTransitionScope("/snippets/database-practices/"), "nested");
});

test("uses rail order for direction and neutral direction for utility routes", () => {
  assert.equal(getPageTransitionPlan("/", "/projects").direction, "forward");
  assert.equal(getPageTransitionPlan("/certificates", "/projects").direction, "backward");
  assert.equal(
    getPageTransitionPlan("/privacy-policy", "/terms-and-conditions").direction,
    "neutral",
  );
  assert.equal(getPageTransitionPlan("/snippets/foo", "/snippets/bar").scope, "nested");
  assert.equal(getPageTransitionPlan("/snippets/foo", "/snippets").scope, "nested");
  assert.equal(getPageTransitionPlan("/projects", "/snippets").scope, "page");
  assert.equal(getPageTransitionPlan("/snippets/foo", "/snippets/foo").scope, "none");
});

test("keeps route transitions on the CSS fallback driver", async () => {
  const [
    navigationSource,
    boundarySource,
    routeSource,
    stylesSource,
    tokensSource,
    homepageMotionSource,
    asyncImageSource,
  ] = await Promise.all([
    readFile(transitionEnginePath, "utf8"),
    readFile(transitionBoundaryPath, "utf8"),
    readFile(routeIntentPath, "utf8"),
    readFile(transitionStylesPath, "utf8"),
    readFile(motionTokensPath, "utf8"),
    readFile(homepageMotionPath, "utf8"),
    readFile(asyncImagePath, "utf8"),
  ]);

  assert.doesNotMatch(
    navigationSource,
    /\b(?:startViewTransition|activeNativeTransition|PendingNativeNavigation)\b/,
  );
  assert.doesNotMatch(boundarySource, /\b(?:startViewTransition|cancelActiveViewTransition)\b/);
  assert.doesNotMatch(routeSource, /pageTransition(?:Driver|Target)/);
  assert.doesNotMatch(
    stylesSource,
    /::view-transition|view-transition-name|page-transition-stage-/,
  );
  assert.doesNotMatch(stylesSource, /clip-path:\s*polygon/);
  assert.match(stylesSource, /inset-inline:\s*0/);
  assert.match(stylesSource, /data-transition-phase="covered"/);
  assert.match(stylesSource, /transform:\s*translateX\(0\)/);
  assert.match(stylesSource, /page-transition-curtain-cover-forward/);
  assert.match(stylesSource, /page-transition-curtain-cover-backward/);
  assert.match(stylesSource, /page-transition-curtain-reveal-forward/);
  assert.match(stylesSource, /page-transition-curtain-reveal-backward/);
  assert.match(boundarySource, /className="page-transition-curtain"/);
  assert.match(boundarySource, /aria-hidden="true"/);
  assert.match(boundarySource, /key=\{activePageTransition\.id\}/);
  assert.match(boundarySource, /phase:\s*plan\.scope === "page" \? "covered" : "cover"/);
  assert.match(boundarySource, /options\.viewTransition === false/);
  assert.match(boundarySource, /prefersReducedMotion\(\)/);
  assert.match(stylesSource, /page-transition-curtain-cover-forward/);
  assert.match(stylesSource, /page-transition-curtain-cover-backward/);
  assert.match(stylesSource, /page-transition-curtain-cover-neutral/);
  assert.match(stylesSource, /data-transition-fallback="page"/);
  assert.match(stylesSource, /data-transition-fallback="nested"/);
  assert.match(stylesSource, /page-transition-curtain/);
  assert.match(stylesSource, /position: fixed/);
  assert.match(stylesSource, /z-index: 20/);
  assert.match(stylesSource, /inset-block-start: 4\.5rem/);
  assert.match(stylesSource, /pointer-events: none/);
  assert.match(stylesSource, /background-color: var\(--color-surface\)/);
  assert.match(stylesSource, /background-image: linear-gradient/);
  assert.match(stylesSource, /var\(--color-surface-raised\)/);
  assert.match(stylesSource, /var\(--color-canvas\)/);
  assert.match(
    tokensSource,
    /--motion-ease-curtain-reveal:\s*cubic-bezier\(0\.65,\s*0,\s*0\.35,\s*1\)/,
  );
  assert.match(
    stylesSource,
    /data-transition-direction="forward"\]\s*\{[\s\S]*?background-image:\s*linear-gradient\(\s*to right/s,
  );
  assert.match(
    stylesSource,
    /data-transition-direction="backward"\]\s*\{[\s\S]*?background-image:\s*linear-gradient\(\s*to left/s,
  );
  assert.match(
    stylesSource,
    /data-transition-direction="neutral"\]\s*\{[\s\S]*?background-image:\s*linear-gradient/,
  );
  assert.match(stylesSource, /background: var\(--color-signal\)/);
  assert.match(stylesSource, /page-transition-curtain-cover-forward 250ms/);
  assert.match(stylesSource, /page-transition-curtain-cover-backward 250ms/);
  assert.match(stylesSource, /page-transition-curtain-reveal-forward 230ms/);
  assert.match(stylesSource, /page-transition-curtain-reveal-backward 230ms/);
  assert.match(stylesSource, /page-transition-curtain-cover-neutral 250ms/);
  assert.match(stylesSource, /page-transition-curtain-reveal-neutral 230ms/);
  assert.doesNotMatch(stylesSource, /44\.64%|58\.93%/);
  assert.match(boundarySource, /onAnimationEnd=\{handleCurtainAnimationEnd\}/);
  assert.match(boundarySource, /schedulePageTransitionHandoff/);
  assert.match(boundarySource, /PAGE_TRANSITION_PRE_REVEAL_DURATION_MS/);
  assert.match(homepageMotionSource, /document\.documentElement\.dataset\.pageTransitionId/);
  assert.match(asyncImageSource, /PageTransitionActiveContext/);
  assert.match(asyncImageSource, /suppressLoadFadeRef/);

  const nestedTransitionStyles = stylesSource.match(
    /@keyframes page-transition-nested-forward[\s\S]*?(?=@media \(prefers-reduced-motion: no-preference\))/,
  );
  assert.ok(nestedTransitionStyles);
  assert.match(nestedTransitionStyles[0], /opacity: 0\.6/);
  assert.doesNotMatch(nestedTransitionStyles[0], /transform:/);
});
