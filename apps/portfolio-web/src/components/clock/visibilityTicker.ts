/**
 * A ticker that stops while the document is hidden.
 *
 * The home page renders a clock that advances once a second. Left alone it keeps
 * firing in a background tab, which is work no one sees and a needless wake-up on
 * battery. This module owns the visibility handling so the component stays a thin
 * consumer and the behaviour can be tested without a DOM.
 */

export interface TickerTarget {
  /** The document whose visibility drives the ticker. */
  document: Document;
}

export interface Ticker {
  /** Clears the interval this call created, removes its listener, releases the guard. */
  stop: () => void;
}

/**
 * Documents that currently have an installed ticker. Keyed by document rather than
 * stored on the caller's object, so injecting a fake in a test needs no spare field
 * and a real `document` is never mutated.
 *
 * The guard tracks *installation*, not a running interval: while the document is
 * hidden the interval is deliberately absent, and a guard that keys on the interval
 * would let a second start install a second listener.
 */
const installed = new WeakSet<Document>();

/**
 * Start a visibility-aware interval.
 *
 * Algorithm:
 * 1. If a ticker is already installed for this document, install nothing — the
 *    guard makes the call idempotent for StrictMode's double setup.
 * 2. Tick once immediately so the first paint has a value.
 * 3. Arm one interval unless the document is already hidden.
 * 4. On `visibilitychange`: hidden → disarm; visible → tick now and arm, but only
 *    if nothing is armed.
 * 5. `stop()` is idempotent: it disarms the interval *this* call created, removes
 *    this call's listener, and releases the guard so a later start works.
 *
 * @param onTick Called for every tick.
 * @param target The document to observe; injected so tests can supply a fake.
 * @param intervalMs Tick period, default 1000 ms.
 * @returns A handle whose `stop` undoes everything this call installed.
 */
export function startVisibilityAwareTicker(
  onTick: () => void,
  target: TickerTarget,
  intervalMs = 1000,
): Ticker {
  const doc = target.document;

  if (installed.has(doc)) {
    return { stop: () => {} };
  }

  installed.add(doc);

  // The handle closes over its own timer id. A stale handle must never clear a
  // timer it did not create.
  let timer: ReturnType<typeof setInterval> | undefined;
  let stopped = false;

  const arm = () => {
    if (timer !== undefined) return;
    timer = setInterval(onTick, intervalMs);
  };

  const disarm = () => {
    if (timer === undefined) return;
    clearInterval(timer);
    timer = undefined;
  };

  const handleVisibilityChange = () => {
    if (stopped) return;

    if (doc.hidden) {
      disarm();
      return;
    }

    onTick();
    arm();
  };

  onTick();
  if (!doc.hidden) arm();
  doc.addEventListener("visibilitychange", handleVisibilityChange);

  return {
    stop: () => {
      if (stopped) return;
      stopped = true;

      disarm();
      doc.removeEventListener("visibilitychange", handleVisibilityChange);
      installed.delete(doc);
    },
  };
}
