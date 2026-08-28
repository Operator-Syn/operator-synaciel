import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";
import {
  createThemeTransitionController,
  THEME_TRANSITION_APPLY_DELAY_MS,
  THEME_TRANSITION_COVER_DURATION_MS,
  THEME_TRANSITION_DURATION_MS,
  THEME_TRANSITION_HANDOFF_DURATION_MS,
  type ThemeTransitionRoot,
} from "../../apps/portfolio-web/src/components/sitePreferences/themeTransition.ts";

type FrameCallback = (timestamp: number) => void;

function createScheduler() {
  let nextHandle = 0;
  const frames = new Map<number, FrameCallback>();
  const timers = new Map<number, () => void>();
  const allTimers = new Map<number, () => void>();
  const timerDelays = new Map<number, number>();

  return {
    requestAnimationFrame(callback: FrameCallback) {
      const handle = ++nextHandle;
      frames.set(handle, callback);
      return handle;
    },
    cancelAnimationFrame(handle: number) {
      frames.delete(handle);
    },
    setTimeout(callback: () => void, delay: number) {
      const handle = ++nextHandle;
      timers.set(handle, callback);
      allTimers.set(handle, callback);
      timerDelays.set(handle, delay);
      return handle;
    },
    clearTimeout(handle: number) {
      timers.delete(handle);
    },
    frameHandles() {
      return [...frames.keys()];
    },
    timerHandles() {
      return [...timers.keys()];
    },
    timerDelay(handle: number) {
      return timerDelays.get(handle);
    },
    runFrame(handle: number) {
      const callback = frames.get(handle);
      frames.delete(handle);
      callback?.(0);
    },
    runTimer(handle: number) {
      const callback = timers.get(handle);
      timers.delete(handle);
      callback?.();
    },
    runAnyTimer(handle: number) {
      allTimers.get(handle)?.();
    },
  };
}

function createRoot(): ThemeTransitionRoot {
  return { dataset: {} as DOMStringMap };
}

test("applies the theme after the transition handoff and cleans up on completion", () => {
  const root = createRoot();
  const scheduler = createScheduler();
  const signalChanges: Array<number | null> = [];
  let applied = 0;
  const controller = createThemeTransitionController(
    root,
    (id) => signalChanges.push(id),
    scheduler,
  );

  controller.start(() => {
    applied += 1;
  }, true);

  assert.equal(applied, 0);
  assert.equal(root.dataset.themeTransition, "active");
  assert.equal(typeof signalChanges.at(-1), "number");

  const frameHandle = scheduler.frameHandles()[0];
  assert.ok(frameHandle);
  scheduler.runFrame(frameHandle);

  assert.equal(applied, 0);
  const handoffHandle = scheduler.timerHandles()[0];
  assert.ok(handoffHandle);
  assert.equal(THEME_TRANSITION_COVER_DURATION_MS, 120);
  assert.equal(THEME_TRANSITION_HANDOFF_DURATION_MS, 80);
  assert.equal(THEME_TRANSITION_APPLY_DELAY_MS, 160);
  assert.equal(scheduler.timerDelay(handoffHandle), THEME_TRANSITION_APPLY_DELAY_MS);
  scheduler.runTimer(handoffHandle);

  assert.equal(applied, 1);
  const timerHandle = scheduler.timerHandles()[0];
  assert.ok(timerHandle);
  assert.equal(THEME_TRANSITION_DURATION_MS, 320);
  assert.equal(
    scheduler.timerDelay(timerHandle),
    THEME_TRANSITION_DURATION_MS - THEME_TRANSITION_APPLY_DELAY_MS,
  );

  scheduler.runTimer(timerHandle);

  assert.equal(root.dataset.themeTransition, undefined);
  assert.equal(signalChanges.at(-1), null);
});

test("stale cleanup cannot clear a newer transition", () => {
  const root = createRoot();
  const scheduler = createScheduler();
  const signalChanges: Array<number | null> = [];
  const controller = createThemeTransitionController(
    root,
    (id) => signalChanges.push(id),
    scheduler,
  );

  controller.start(() => {}, true);
  const firstFrame = scheduler.frameHandles()[0];
  assert.ok(firstFrame);
  scheduler.runFrame(firstFrame);
  const firstHandoff = scheduler.timerHandles()[0];
  assert.ok(firstHandoff);
  scheduler.runTimer(firstHandoff);
  const staleCleanup = scheduler.timerHandles()[0];
  assert.ok(staleCleanup);

  controller.start(() => {}, true);
  const secondId = signalChanges.at(-1);
  const secondFrame = scheduler.frameHandles()[0];
  assert.ok(secondFrame);
  scheduler.runFrame(secondFrame);
  const secondHandoff = scheduler.timerHandles()[0];
  assert.ok(secondHandoff);
  scheduler.runTimer(secondHandoff);
  const currentCleanup = scheduler.timerHandles()[0];
  assert.ok(currentCleanup);

  scheduler.runAnyTimer(staleCleanup);
  assert.equal(root.dataset.themeTransition, "active");
  assert.equal(signalChanges.at(-1), secondId);

  scheduler.runTimer(currentCleanup);
  assert.equal(root.dataset.themeTransition, undefined);
  assert.equal(signalChanges.at(-1), null);
});

test("bypasses the transition when animation is disabled", () => {
  const root = createRoot();
  const scheduler = createScheduler();
  let applied = 0;
  const controller = createThemeTransitionController(root, () => {}, scheduler);

  controller.start(() => {
    applied += 1;
  }, false);

  assert.equal(applied, 1);
  assert.equal(root.dataset.themeTransition, undefined);
  assert.deepEqual(scheduler.frameHandles(), []);
  assert.deepEqual(scheduler.timerHandles(), []);
});

test("defines the covered theme transition and reduced-motion bypass", async () => {
  const repositoryRoot = resolve(import.meta.dirname, "../../apps/portfolio-web");
  const [provider, styles, tokens] = await Promise.all([
    readFile(
      resolve(repositoryRoot, "src/components/sitePreferences/SitePreferencesProvider.tsx"),
      "utf8",
    ),
    readFile(resolve(repositoryRoot, "src/styles/theme-transition.css"), "utf8"),
    readFile(resolve(repositoryRoot, "src/styles/tokens.css"), "utf8"),
  ]);

  assert.match(provider, /createThemeTransitionController/);
  assert.match(provider, /key={themeTransitionId}/);
  assert.match(provider, /return controller\.cancel/);
  assert.match(tokens, /--motion-theme-transition-duration: 320ms/);
  assert.match(styles, /\.theme-transition-wipe[\s\S]*position: fixed/);
  assert.match(
    styles,
    /animation: theme-transition-wipe var\(--motion-theme-transition-duration\) var\(--motion-ease\)/,
  );
  assert.match(
    styles,
    /\.theme-transition-wipe::after[\s\S]*background-color: var\(--color-signal\)/,
  );
  assert.match(styles, /transform: translate3d\(-100%, 0, 0\)/);
  assert.match(styles, /37\.5%[\s\S]*?62\.5%[\s\S]*?transform: translate3d\(100%, 0, 0\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /html\[data-reduced-motion="on"\] \.theme-transition-wipe/);
  assert.doesNotMatch(styles, /!important/);
});
