export const THEME_TRANSITION_DURATION_MS = 320;
export const THEME_TRANSITION_COVER_DURATION_MS = 120;
export const THEME_TRANSITION_HANDOFF_DURATION_MS = 80;
export const THEME_TRANSITION_APPLY_DELAY_MS =
  THEME_TRANSITION_COVER_DURATION_MS + THEME_TRANSITION_HANDOFF_DURATION_MS / 2;

type TransitionFrame = (timestamp: number) => void;

interface ThemeTransitionScheduler {
  requestAnimationFrame: (callback: TransitionFrame) => number;
  cancelAnimationFrame: (handle: number) => void;
  setTimeout: (callback: () => void, delay: number) => number;
  clearTimeout: (handle: number) => void;
}

export type ThemeTransitionRoot = Pick<HTMLElement, "dataset">;

export interface ThemeTransitionController {
  start: (applyTheme: () => void, animate: boolean) => void;
  cancel: () => void;
}

function createBrowserScheduler(): ThemeTransitionScheduler {
  return {
    requestAnimationFrame: (callback) => window.requestAnimationFrame(callback),
    cancelAnimationFrame: (handle) => window.cancelAnimationFrame(handle),
    setTimeout: (callback, delay) => window.setTimeout(callback, delay),
    clearTimeout: (handle) => window.clearTimeout(handle),
  };
}

export function createThemeTransitionController(
  root: ThemeTransitionRoot,
  onSignalChange: (id: number | null) => void,
  scheduler: ThemeTransitionScheduler = createBrowserScheduler(),
): ThemeTransitionController {
  let sequence = 0;
  let frameHandle: number | null = null;
  let handoffHandle: number | null = null;
  let cleanupHandle: number | null = null;

  const cancel = () => {
    sequence += 1;

    if (frameHandle !== null) {
      scheduler.cancelAnimationFrame(frameHandle);
      frameHandle = null;
    }

    if (handoffHandle !== null) {
      scheduler.clearTimeout(handoffHandle);
      handoffHandle = null;
    }

    if (cleanupHandle !== null) {
      scheduler.clearTimeout(cleanupHandle);
      cleanupHandle = null;
    }

    delete root.dataset.themeTransition;
    onSignalChange(null);
  };

  const start = (applyTheme: () => void, animate: boolean) => {
    cancel();

    if (!animate) {
      applyTheme();
      return;
    }

    const transitionId = sequence + 1;
    sequence = transitionId;
    root.dataset.themeTransition = "active";
    onSignalChange(transitionId);

    frameHandle = scheduler.requestAnimationFrame(() => {
      frameHandle = null;

      if (sequence !== transitionId) return;

      handoffHandle = scheduler.setTimeout(() => {
        handoffHandle = null;

        if (sequence !== transitionId) return;

        applyTheme();
        cleanupHandle = scheduler.setTimeout(() => {
          cleanupHandle = null;

          if (sequence !== transitionId) return;

          delete root.dataset.themeTransition;
          onSignalChange(null);
        }, THEME_TRANSITION_DURATION_MS - THEME_TRANSITION_APPLY_DELAY_MS);
      }, THEME_TRANSITION_APPLY_DELAY_MS);
    });
  };

  return { cancel, start };
}
