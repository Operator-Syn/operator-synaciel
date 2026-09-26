import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";
import { schedulePageTransitionNavigation } from "../../apps/portfolio-web/src/components/pageTransition/pageTransitionNavigation.ts";
import {
  getPageTransitionPlan,
  getPageTransitionScope,
  getRouteRailIndex,
  NESTED_TRANSITION_DURATION_MS,
  normalizeRoutePath,
  PAGE_TRANSITION_COVER_DURATION_MS,
  PAGE_TRANSITION_DURATION_MS,
  PAGE_TRANSITION_HANDOFF_DURATION_MS,
  PAGE_TRANSITION_NAVIGATION_DELAY_MS,
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

test("normalizes route paths without changing the root", () => {
  assert.equal(normalizeRoutePath("/projects///"), "/projects");
  assert.equal(normalizeRoutePath("/"), "/");
});

test("keeps the intentional transition timing contract", () => {
  assert.equal(PAGE_TRANSITION_DURATION_MS, 560);
  assert.equal(PAGE_TRANSITION_HANDOFF_DURATION_MS, 80);
  assert.equal(NESTED_TRANSITION_DURATION_MS, 220);
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

test("changes routes at the covered handoff and finishes at 560ms", () => {
  assert.equal(PAGE_TRANSITION_COVER_DURATION_MS, 250);
  assert.equal(PAGE_TRANSITION_NAVIGATION_DELAY_MS, 330);
  assert.equal(PAGE_TRANSITION_REVEAL_DURATION_MS, 230);

  const scheduler = createTransitionScheduler();
  const events: string[] = [];

  schedulePageTransitionNavigation(
    scheduler,
    () => events.push("navigate"),
    () => events.push("finish"),
  );

  scheduler.advanceBy(PAGE_TRANSITION_NAVIGATION_DELAY_MS - 1);
  assert.deepEqual(events, []);

  scheduler.advanceBy(1);
  assert.deepEqual(events, ["navigate"]);

  scheduler.advanceBy(PAGE_TRANSITION_REVEAL_DURATION_MS - 1);
  assert.deepEqual(events, ["navigate"]);

  scheduler.advanceBy(1);
  assert.deepEqual(events, ["navigate", "finish"]);
});

test("cancels stale handoff and cleanup timers when a transition is interrupted", () => {
  const scheduler = createTransitionScheduler();
  const events: string[] = [];

  const cancelFirst = schedulePageTransitionNavigation(
    scheduler,
    () => events.push("first navigate"),
    () => events.push("first finish"),
  );

  scheduler.advanceBy(100);
  cancelFirst();

  schedulePageTransitionNavigation(
    scheduler,
    () => events.push("second navigate"),
    () => events.push("second finish"),
  );

  scheduler.advanceBy(PAGE_TRANSITION_NAVIGATION_DELAY_MS);
  assert.deepEqual(events, ["second navigate"]);

  scheduler.advanceBy(PAGE_TRANSITION_REVEAL_DURATION_MS);
  assert.deepEqual(events, ["second navigate", "second finish"]);
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
  const [navigationSource, boundarySource, routeSource, stylesSource, tokensSource] =
    await Promise.all([
      readFile(transitionEnginePath, "utf8"),
      readFile(transitionBoundaryPath, "utf8"),
      readFile(routeIntentPath, "utf8"),
      readFile(transitionStylesPath, "utf8"),
      readFile(motionTokensPath, "utf8"),
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
  assert.match(stylesSource, /clip-path: polygon/);
  assert.match(
    stylesSource,
    /data-transition-direction="forward"\]\s*\{[\s\S]*?inset-inline-end:\s*clamp\(1\.25rem,\s*6\.5vw,\s*16rem\)[\s\S]*?clip-path:\s*polygon/,
  );
  assert.match(
    stylesSource,
    /data-transition-direction="backward"\]\s*\{[\s\S]*?inset-inline-start:\s*clamp\(1\.25rem,\s*6\.5vw,\s*16rem\)[\s\S]*?clip-path:\s*polygon/,
  );
  assert.match(stylesSource, /98% 16%[\s\S]*?95% 100%/);
  assert.match(stylesSource, /5% 100%[\s\S]*?2\.8% 80%/);
  assert.match(boundarySource, /className="page-transition-curtain"/);
  assert.match(boundarySource, /aria-hidden="true"/);
  assert.match(boundarySource, /key=\{activePageTransition\.id\}/);
  assert.match(boundarySource, /phase = plan\.scope === "page" \? "covered" : "cover"/);
  assert.match(boundarySource, /options\.viewTransition === false/);
  assert.match(boundarySource, /prefersReducedMotion\(\)/);
  assert.match(stylesSource, /page-transition-curtain-forward-covered/);
  assert.match(stylesSource, /page-transition-curtain-backward-covered/);
  assert.match(stylesSource, /page-transition-curtain-neutral-covered/);
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
  assert.match(stylesSource, /transform: translate3d/);
  assert.match(stylesSource, /44\.64%/);
  assert.match(stylesSource, /58\.93%/);
  assert.match(stylesSource, /560ms/);
  assert.match(
    tokensSource,
    /--motion-ease-curtain-reveal:\s*cubic-bezier\(0\.65,\s*0,\s*0\.35,\s*1\)/,
  );
  assert.match(stylesSource, /animation: page-transition-curtain-forward 560ms linear both/);
  assert.match(stylesSource, /animation: page-transition-curtain-backward 560ms linear both/);
  assert.match(stylesSource, /animation: page-transition-curtain-neutral 560ms linear both/);

  const forwardCurtainKeyframes = stylesSource.match(
    /keyframes\s+page-transition-curtain-forward[\s\S]*?keyframes\s+page-transition-curtain-backward/,
  );
  assert.ok(forwardCurtainKeyframes);
  assert.match(
    forwardCurtainKeyframes[0],
    /0%[\s\S]*?animation-timing-function:\s*var\(--motion-ease\)[\s\S]*?58\.93%[\s\S]*?animation-timing-function:\s*var\(--motion-ease-curtain-reveal\)/,
  );

  const nestedTransitionStyles = stylesSource.match(
    /@keyframes page-transition-nested-forward[\s\S]*?@media \(prefers-reduced-motion: reduce\)/,
  );
  assert.ok(nestedTransitionStyles);
  assert.match(nestedTransitionStyles[0], /opacity: 0\.6/);
  assert.doesNotMatch(nestedTransitionStyles[0], /transform:/);
});
