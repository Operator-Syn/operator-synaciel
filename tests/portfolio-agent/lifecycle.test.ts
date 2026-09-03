import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ensurePortfolioMcpConnection,
  rediscoverPortfolioMcpCatalog,
  remainingMcpDiscoveryTimeout,
} from "../../workers/portfolio-agent/src/mcp.ts";

test("removes a persisted failed MCP connection and retries without aborting startup", async () => {
  const removed: string[] = [];
  let attempts = 0;

  const connected = await ensurePortfolioMcpConnection(
    {
      add: async () => {
        attempts += 1;
        if (attempts === 1) throw new Error("MCP discovery failed");
        return { id: "portfolio-recovered", state: "ready" };
      },
      getState: () => ({
        servers: {
          stale: {
            name: "portfolio",
            state: "failed",
            error: "upstream unavailable",
          },
        },
      }),
      remove: async (id) => {
        removed.push(id);
      },
    },
    () => undefined,
  );

  assert.equal(connected, true);
  assert.equal(attempts, 2);
  assert.deepEqual(removed, ["stale"]);
});

test("keeps remaining discovery time within the shared deadline", () => {
  assert.equal(remainingMcpDiscoveryTimeout(10_000, 8_500), 1_500);
  assert.equal(remainingMcpDiscoveryTimeout(10_000, 10_001), 0);
});

test("stops MCP recovery before a retry when the shared deadline expires", async () => {
  const originalNow = Date.now;
  const removed: string[] = [];
  const events: Array<Record<string, unknown>> = [];
  let now = 1_000;
  let attempts = 0;
  Date.now = () => now;

  try {
    const connected = await ensurePortfolioMcpConnection(
      {
        add: async () => {
          attempts += 1;
          now += 1;
          throw new Error("discovery failed");
        },
        getState: () => ({
          servers: {
            connected: { name: "portfolio", state: "connected" },
          },
        }),
        remove: async (id) => {
          removed.push(id);
        },
      },
      () => undefined,
      {
        deadlineMs: 1_001,
        forceReconnect: true,
        diagnostics: { sink: (event) => events.push(event) },
      },
    );

    assert.equal(connected, false);
    assert.equal(attempts, 1);
    assert.deepEqual(removed, ["connected"]);
    assert.deepEqual(
      events.map(({ phase, outcome, reason, attempt }) => ({
        phase,
        outcome,
        reason,
        attempt,
      })),
      [
        { phase: "mcp-recovery", outcome: "started", reason: undefined, attempt: 1 },
        { phase: "mcp-recovery", outcome: "failed", reason: "timeout", attempt: 1 },
      ],
    );
  } finally {
    Date.now = originalNow;
  }
});

test("rediscovery refreshes a connected catalog without removing the server", async () => {
  const calls: string[] = [];

  const refreshed = await rediscoverPortfolioMcpCatalog(
    {
      add: async () => {
        calls.push("add");
        return { state: "ready" };
      },
      getState: () => ({
        servers: {
          existing: {
            name: "portfolio",
            state: "connected",
          },
        },
      }),
      remove: async (id) => {
        calls.push(`remove:${id}`);
      },
      discover: async (id) => {
        calls.push(`discover:${id}`);
        return { success: true, state: "ready" };
      },
    },
    () => undefined,
  );

  assert.equal(refreshed, true);
  assert.deepEqual(calls, ["discover:existing"]);
});

test("failed rediscovery leaves reconnect fallback to the caller", async () => {
  const calls: string[] = [];

  const refreshed = await rediscoverPortfolioMcpCatalog(
    {
      add: async () => ({ state: "ready" }),
      getState: () => ({
        servers: {
          existing: {
            name: "portfolio",
            state: "connected",
          },
        },
      }),
      remove: async (id) => {
        calls.push(`remove:${id}`);
      },
      discover: async () => ({ success: false, state: "connected" }),
    },
    () => undefined,
  );

  assert.equal(refreshed, false);
  assert.deepEqual(calls, []);
});

test("retries a discovery failure through the bounded startup attempts", async () => {
  const removed: string[] = [];
  let attempts = 0;

  const connected = await ensurePortfolioMcpConnection(
    {
      add: async () => {
        attempts += 1;
        if (attempts < 3) throw new Error("discovery failed");
        return { id: "portfolio-recovered", state: "ready" };
      },
      getState: () => ({
        servers: {
          connected: {
            name: "portfolio",
            state: "connected",
          },
        },
      }),
      remove: async (id) => {
        removed.push(id);
      },
    },
    () => undefined,
  );

  assert.equal(connected, true);
  assert.equal(attempts, 3);
  assert.deepEqual(removed, ["connected", "connected"]);
});

test("refreshes a connected catalog after discovery failure", async () => {
  const calls: string[] = [];

  const connected = await ensurePortfolioMcpConnection(
    {
      add: async () => {
        calls.push("add");
        return { id: "portfolio-recovered", state: "ready" };
      },
      getState: () => ({
        servers: {
          connected: {
            name: "portfolio",
            state: "connected",
          },
        },
      }),
      remove: async (id) => {
        calls.push(`remove:${id}`);
      },
    },
    () => undefined,
    { forceReconnect: true },
  );

  assert.equal(connected, true);
  assert.deepEqual(calls, ["remove:connected", "add"]);
});

test("keeps startup available when the MCP connection cannot be recovered", async () => {
  const errors: string[] = [];
  let attempts = 0;

  const connected = await ensurePortfolioMcpConnection(
    {
      add: async () => {
        attempts += 1;
        throw new Error("secret-bearing upstream detail must not be logged");
      },
      getState: () => ({ servers: {} }),
      remove: async () => undefined,
    },
    (message) => errors.push(message),
  );

  assert.equal(connected, false);
  assert.equal(attempts, 1);
  assert.deepEqual(errors, ["Portfolio MCP connection unavailable during startup (Error)."]);
});

test("does not throw if cleanup or the recovery attempt fails", async () => {
  const errors: string[] = [];
  let attempts = 0;

  const connected = await ensurePortfolioMcpConnection(
    {
      add: async () => {
        attempts += 1;
        throw new Error("failed");
      },
      getState: () => ({
        servers: {
          stale: { name: "portfolio", state: "failed", error: "failed" },
        },
      }),
      remove: async () => {
        throw new Error("cleanup failed");
      },
    },
    (message) => errors.push(message),
  );

  assert.equal(connected, false);
  assert.equal(attempts, 1);
  assert.deepEqual(errors, [
    "Portfolio MCP connection unavailable during startup (Error).",
    "Portfolio MCP failed-state cleanup failed (Error).",
  ]);
});

test("emits typed lifecycle events without raw MCP details", async () => {
  const events: Array<Record<string, unknown>> = [];

  const connected = await ensurePortfolioMcpConnection(
    {
      add: async () => ({ state: "ready" }),
      getState: () => ({ servers: {} }),
      remove: async () => undefined,
    },
    () => undefined,
    {
      diagnostics: {
        requestId: "req/42",
        sink: (event) => events.push(event),
      },
    },
  );

  assert.equal(connected, true);
  assert.deepEqual(
    events.map(({ phase, outcome, attempt, requestId }) => ({
      phase,
      outcome,
      attempt,
      requestId,
    })),
    [
      { phase: "mcp-startup", outcome: "started", attempt: 1, requestId: "req42" },
      { phase: "mcp-startup", outcome: "succeeded", attempt: 1, requestId: "req42" },
    ],
  );
  assert.ok(events.every((event) => !("error" in event) && !("payload" in event)));
});

test("reports rediscovery failure as a typed diagnostic", async () => {
  const events: Array<Record<string, unknown>> = [];

  const refreshed = await rediscoverPortfolioMcpCatalog(
    {
      add: async () => ({ state: "ready" }),
      getState: () => ({
        servers: {
          existing: { name: "portfolio", state: "connected" },
        },
      }),
      remove: async () => undefined,
      discover: async () => ({ success: false }),
    },
    () => undefined,
    400,
    {
      requestId: "req-43",
      sink: (event) => events.push(event),
    },
  );

  assert.equal(refreshed, false);
  assert.deepEqual(
    events.map(({ phase, outcome, reason, requestId }) => ({
      phase,
      outcome,
      reason,
      requestId,
    })),
    [
      {
        phase: "mcp-rediscovery",
        outcome: "started",
        reason: undefined,
        requestId: "req-43",
      },
      {
        phase: "mcp-rediscovery",
        outcome: "failed",
        reason: "discovery-failed",
        requestId: "req-43",
      },
    ],
  );
});
