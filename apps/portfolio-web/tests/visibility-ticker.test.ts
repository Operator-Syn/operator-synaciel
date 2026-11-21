import assert from "node:assert/strict";
import { test } from "node:test";

import { startVisibilityAwareTicker } from "../src/components/clock/visibilityTicker";

/**
 * The ticker is the home clock's only timer. These tests drive it against a fake
 * document so the behaviour — one interval, nothing while hidden, an immediate tick
 * on return, and a clean stop — is checked without a real browser.
 */

interface FakeDocument extends Document {
  fireVisibilityChange: (hidden: boolean) => void;
}

function createDocument(initialHidden = false) {
  const listeners = new Set<() => void>();
  const doc = {
    hidden: initialHidden,
    addEventListener: (type: string, listener: () => void) => {
      if (type === "visibilitychange") listeners.add(listener);
    },
    removeEventListener: (type: string, listener: () => void) => {
      if (type === "visibilitychange") listeners.delete(listener);
    },
    fireVisibilityChange: (hidden: boolean) => {
      doc.hidden = hidden;
      for (const listener of [...listeners]) listener();
    },
  } as unknown as FakeDocument;

  return Object.assign(doc, { listenerCount: () => listeners.size });
}

interface TimerState {
  intervals: number;
  cleared: number;
  /** The ids passed to `clearInterval`, in order, so a wrong-id clear is visible. */
  clearedIds: number[];
}

/**
 * Run a function with `setInterval`/`clearInterval` replaced by counters that
 * record the id each clear was given. Counting clears alone would let a regression
 * that cleared the wrong timer pass.
 */
function withFakeTimers<T>(run: (state: TimerState) => T): T {
  const realSetInterval = globalThis.setInterval;
  const realClearInterval = globalThis.clearInterval;
  const state: TimerState = { intervals: 0, cleared: 0, clearedIds: [] };

  globalThis.setInterval = (() => {
    state.intervals += 1;
    return state.intervals as unknown as ReturnType<typeof setInterval>;
  }) as typeof setInterval;
  globalThis.clearInterval = ((id: number) => {
    state.cleared += 1;
    state.clearedIds.push(id);
  }) as unknown as typeof clearInterval;

  try {
    return run(state);
  } finally {
    globalThis.setInterval = realSetInterval;
    globalThis.clearInterval = realClearInterval;
  }
}

test("starts one interval and ticks immediately", () => {
  const doc = createDocument();
  withFakeTimers((state) => {
    let ticks = 0;
    const tick = () => {
      ticks += 1;
    };
    const ticker = startVisibilityAwareTicker(tick, { document: doc }, 1000);

    assert.equal(ticks, 1, "the first paint has a value without waiting a second");
    assert.equal(state.intervals, 1);

    ticker.stop();
  });
});

test("clears the interval while hidden and restarts it with an immediate tick on return", () => {
  const doc = createDocument();
  withFakeTimers((state) => {
    let ticks = 0;
    const tick = () => {
      ticks += 1;
    };
    const ticker = startVisibilityAwareTicker(tick, { document: doc }, 1000);

    doc.fireVisibilityChange(true);
    assert.equal(state.cleared, 1, "the interval is cleared as soon as the tab hides");

    doc.fireVisibilityChange(false);
    assert.equal(ticks, 2, "returning to the tab ticks at once");
    assert.equal(state.intervals, 2, "and only then starts a new interval");

    ticker.stop();
  });
});

test("a second start on the same document adds no timer and no listener", () => {
  const doc = createDocument();
  withFakeTimers((state) => {
    const first = startVisibilityAwareTicker(() => {}, { document: doc }, 1000);
    const second = startVisibilityAwareTicker(() => {}, { document: doc }, 1000);

    assert.equal(state.intervals, 1, "StrictMode's second setup must not double the timer");
    assert.equal((doc as unknown as { listenerCount: () => number }).listenerCount(), 1);

    second.stop();
    assert.equal(state.cleared, 0, "the redundant handle owns nothing to clear");

    first.stop();
  });
});

test("stop clears the interval, removes the listener and allows a later start", () => {
  const doc = createDocument();
  withFakeTimers((state) => {
    const ticker = startVisibilityAwareTicker(() => {}, { document: doc }, 1000);
    ticker.stop();

    assert.equal(state.cleared, 1);
    assert.equal((doc as unknown as { listenerCount: () => number }).listenerCount(), 0);

    // The guard resets on stop: StrictMode's remount and a genuine remount both need this.
    const again = startVisibilityAwareTicker(() => {}, { document: doc }, 1000);
    assert.equal(state.intervals, 2, "starting after stop creates a timer");

    again.stop();
  });
});

test("starts hidden without arming an interval", () => {
  const doc = createDocument(true);
  withFakeTimers((state) => {
    let ticks = 0;
    const tick = () => {
      ticks += 1;
    };
    const ticker = startVisibilityAwareTicker(tick, { document: doc }, 1000);

    // The immediate tick still runs so the clock has a value, but nothing is armed
    // while the document is hidden — that is the whole point of the guard.
    assert.equal(ticks, 1);
    assert.equal(state.intervals, 0);

    doc.fireVisibilityChange(false);
    assert.equal(ticks, 2, "returning ticks at once");
    assert.equal(state.intervals, 1, "and arms exactly one interval");

    ticker.stop();
  });
});

test("a second start while hidden installs nothing", () => {
  const doc = createDocument(true);
  withFakeTimers((state) => {
    const first = startVisibilityAwareTicker(() => {}, { document: doc }, 1000);
    const second = startVisibilityAwareTicker(() => {}, { document: doc }, 1000);

    // The guard tracks installation, not a running interval: while hidden there is no
    // interval to key on, and a second start must still install nothing.
    assert.equal((doc as unknown as { listenerCount: () => number }).listenerCount(), 1);

    doc.fireVisibilityChange(false);
    assert.equal(state.intervals, 1, "one interval after returning, not two");

    second.stop();
    first.stop();
  });
});

test("a stale stop cannot clear another ticker's interval", () => {
  const doc = createDocument();
  withFakeTimers((state) => {
    const first = startVisibilityAwareTicker(() => {}, { document: doc }, 1000);
    first.stop();

    const second = startVisibilityAwareTicker(() => {}, { document: doc }, 1000);
    first.stop(); // idempotent, and must not touch the new timer

    assert.equal(state.cleared, 1, "only the first stop cleared a timer");

    doc.fireVisibilityChange(true);
    assert.deepEqual(
      state.clearedIds,
      [1, 2],
      "the first stop cleared ticker 1; hiding cleared the live ticker 2 — never a stale id",
    );

    second.stop();
  });
});

test("stop is idempotent", () => {
  const doc = createDocument();
  withFakeTimers((state) => {
    const ticker = startVisibilityAwareTicker(() => {}, { document: doc }, 1000);
    ticker.stop();
    ticker.stop();

    assert.equal(state.cleared, 1);
    assert.equal((doc as unknown as { listenerCount: () => number }).listenerCount(), 0);
  });
});

test("a visible transition while already visible does not arm a second interval", () => {
  const doc = createDocument();
  withFakeTimers((state) => {
    let ticks = 0;
    const tick = () => {
      ticks += 1;
    };
    const ticker = startVisibilityAwareTicker(tick, { document: doc }, 1000);

    assert.equal(state.intervals, 1);

    // A spurious visibilitychange that reports "visible" while already visible must
    // reuse the armed interval; this is the only path where `arm`'s re-entrancy guard
    // is the deciding condition, so deleting it has to break something.
    doc.fireVisibilityChange(false);

    assert.equal(state.intervals, 1, "the armed interval is reused, not duplicated");
    assert.equal(ticks, 2, "the tick still happens");

    ticker.stop();
  });
});
