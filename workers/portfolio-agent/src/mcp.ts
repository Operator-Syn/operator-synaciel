import {
  MCP_CONNECTION_MAX_ATTEMPTS,
  MCP_CONNECTION_RETRY_BASE_DELAY_MS,
  MCP_CONNECTION_RETRY_MAX_DELAY_MS,
  MCP_DISCOVERY_TIMEOUT_MS,
  MCP_SERVER_NAME,
} from "./config.ts";
import {
  emitPortfolioAgentDiagnostic,
  type PortfolioAgentDiagnostic,
  type PortfolioAgentDiagnosticContext,
} from "./diagnostics.ts";

type McpServerState = {
  name?: string;
  state?: string;
};

type McpConnectionState = {
  servers?: Record<string, McpServerState>;
};

export type PortfolioMcpManager = {
  add: () => Promise<unknown>;
  getState: () => McpConnectionState;
  remove: (id: string) => Promise<void>;
  discover?: (id: string, options?: { timeoutMs?: number }) => Promise<unknown>;
};

export type PortfolioMcpEnsureOptions = {
  /** Absolute wall-clock deadline shared with the catalog discovery budget. */
  deadlineMs?: number;
  forceReconnect?: boolean;
  diagnostics?: PortfolioAgentDiagnosticContext;
};

type FailureLogger = (message: string) => void;

function errorType(error: unknown): string {
  return error instanceof Error ? error.name : typeof error;
}

function defaultFailureLogger(message: string): void {
  console.error(`[portfolio-agent] ${message}`);
}

type McpDiagnosticInput = Omit<PortfolioAgentDiagnostic, "requestId">;

function emitMcpDiagnostic(
  context: PortfolioAgentDiagnosticContext | undefined,
  input: McpDiagnosticInput,
): void {
  if (!context) return;
  emitPortfolioAgentDiagnostic(context.sink, {
    ...input,
    requestId: context?.requestId,
  });
}

function recoverablePortfolioServers(
  state: McpConnectionState,
  includeDiscovering = false,
): string[] {
  return Object.entries(state.servers ?? {})
    .filter(
      ([, server]) =>
        server.name === MCP_SERVER_NAME &&
        (server.state === "failed" ||
          server.state === "connected" ||
          (includeDiscovering && server.state === "discovering")),
    )
    .map(([id]) => id);
}

function rediscoverablePortfolioServers(state: McpConnectionState): string[] {
  return Object.entries(state.servers ?? {})
    .filter(
      ([, server]) =>
        server.name === MCP_SERVER_NAME &&
        (server.state === "connected" || server.state === "ready"),
    )
    .map(([id]) => id);
}

async function removeRecoverablePortfolioServers(
  manager: PortfolioMcpManager,
  log: FailureLogger,
  includeDiscovering = false,
  deadlineMs?: number,
): Promise<string[] | null> {
  if (!hasMcpDiscoveryBudget(deadlineMs)) return null;

  let recoverableServers: string[];
  try {
    recoverableServers = recoverablePortfolioServers(manager.getState(), includeDiscovering);
  } catch (error) {
    log(`Portfolio MCP state could not be inspected (${errorType(error)}).`);
    return null;
  }

  for (const id of recoverableServers) {
    if (!hasMcpDiscoveryBudget(deadlineMs)) return null;
    try {
      await manager.remove(id);
    } catch (error) {
      log(`Portfolio MCP failed-state cleanup failed (${errorType(error)}).`);
      return null;
    }
  }
  return recoverableServers;
}

/**
 * Refresh the existing portfolio connection's capability catalog without
 * deleting its persisted server row or transport session.
 */
export async function rediscoverPortfolioMcpCatalog(
  manager: PortfolioMcpManager,
  log: FailureLogger = defaultFailureLogger,
  timeoutMs = MCP_DISCOVERY_TIMEOUT_MS,
  diagnostics?: PortfolioAgentDiagnosticContext,
): Promise<boolean> {
  const startedAt = Date.now();
  emitMcpDiagnostic(diagnostics, {
    phase: "mcp-rediscovery",
    outcome: "started",
  });
  if (!manager.discover) {
    emitMcpDiagnostic(diagnostics, {
      phase: "mcp-rediscovery",
      outcome: "skipped",
      reason: "not-required",
      elapsedMs: Date.now() - startedAt,
    });
    return false;
  }

  let servers: string[];
  try {
    servers = rediscoverablePortfolioServers(manager.getState());
  } catch (error) {
    log(`Portfolio MCP state could not be inspected (${errorType(error)}).`);
    emitMcpDiagnostic(diagnostics, {
      phase: "mcp-rediscovery",
      outcome: "failed",
      reason: "discovery-failed",
      elapsedMs: Date.now() - startedAt,
    });
    return false;
  }

  if (servers.length === 0) {
    emitMcpDiagnostic(diagnostics, {
      phase: "mcp-rediscovery",
      outcome: "skipped",
      reason: "no-connection",
      elapsedMs: Date.now() - startedAt,
    });
    return false;
  }

  for (const id of servers) {
    let result: unknown;
    try {
      result = await manager.discover(id, { timeoutMs });
    } catch (error) {
      log(`Portfolio MCP catalog rediscovery failed (${errorType(error)}).`);
      emitMcpDiagnostic(diagnostics, {
        phase: "mcp-rediscovery",
        outcome: "failed",
        reason: "discovery-failed",
        elapsedMs: Date.now() - startedAt,
      });
      return false;
    }
    if (
      !result ||
      typeof result !== "object" ||
      (result as { success?: unknown }).success !== true
    ) {
      log("Portfolio MCP catalog rediscovery returned an unusable result.");
      emitMcpDiagnostic(diagnostics, {
        phase: "mcp-rediscovery",
        outcome: "failed",
        reason: "discovery-failed",
        elapsedMs: Date.now() - startedAt,
      });
      return false;
    }
  }

  emitMcpDiagnostic(diagnostics, {
    phase: "mcp-rediscovery",
    outcome: "succeeded",
    toolCount: servers.length,
    elapsedMs: Date.now() - startedAt,
  });
  return true;
}

function retryDelayMs(attempt: number): number {
  return Math.min(
    MCP_CONNECTION_RETRY_BASE_DELAY_MS * 2 ** Math.max(0, attempt - 1),
    MCP_CONNECTION_RETRY_MAX_DELAY_MS,
  );
}

export function remainingMcpDiscoveryTimeout(deadlineMs: number, now = Date.now()): number {
  if (!Number.isFinite(deadlineMs) || !Number.isFinite(now)) return 0;
  return Math.max(0, Math.ceil(deadlineMs - now));
}

function hasMcpDiscoveryBudget(deadlineMs: number | undefined): boolean {
  return deadlineMs === undefined || remainingMcpDiscoveryTimeout(deadlineMs) > 0;
}

function waitForRetry(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

/**
 * Keep Durable Object startup usable when a persisted MCP connection is stale.
 * MCP is evidence infrastructure, so a failed connection must not abort the
 * WebSocket handshake; the chat handler can return its bounded fallback.
 *
 * The Agents SDK persists retry options for restored connections, but its
 * initial add/discovery call is direct. This bounded loop covers startup and
 * treats a connected server as recoverable too because discovery failures can
 * leave the transport in that state. A supplied absolute deadline prevents
 * cleanup, retries, and late connection success from starting a new recovery
 * step after the catalog's shared discovery window.
 */
export async function ensurePortfolioMcpConnection(
  manager: PortfolioMcpManager,
  log: FailureLogger = defaultFailureLogger,
  options: PortfolioMcpEnsureOptions = {},
): Promise<boolean> {
  const phase = options.forceReconnect ? "mcp-recovery" : "mcp-startup";
  for (let attempt = 1; attempt <= MCP_CONNECTION_MAX_ATTEMPTS; attempt += 1) {
    if (!hasMcpDiscoveryBudget(options.deadlineMs)) return false;

    const startedAt = Date.now();
    emitMcpDiagnostic(options.diagnostics, {
      phase,
      outcome: "started",
      attempt,
    });
    if (attempt === 1 && options.forceReconnect) {
      const removed = await removeRecoverablePortfolioServers(
        manager,
        log,
        true,
        options.deadlineMs,
      );
      if (removed === null) {
        if (!hasMcpDiscoveryBudget(options.deadlineMs)) {
          emitMcpDiagnostic(options.diagnostics, {
            phase,
            outcome: "failed",
            reason: "timeout",
            attempt,
            elapsedMs: Date.now() - startedAt,
          });
        }
        return false;
      }
    }

    let connected = false;
    try {
      await manager.add();
      connected = true;
    } catch (error) {
      const timedOut = !hasMcpDiscoveryBudget(options.deadlineMs);
      emitMcpDiagnostic(options.diagnostics, {
        phase,
        outcome: "failed",
        attempt,
        reason: timedOut ? "timeout" : "discovery-failed",
        elapsedMs: Date.now() - startedAt,
      });
      log(
        timedOut
          ? "Portfolio MCP connection attempt exceeded the shared discovery deadline."
          : attempt === 1
            ? `Portfolio MCP connection unavailable during startup (${errorType(error)}).`
            : `Portfolio MCP recovery attempt failed (${errorType(error)}).`,
      );
      if (timedOut) return false;
    }

    if (connected) {
      if (!hasMcpDiscoveryBudget(options.deadlineMs)) {
        emitMcpDiagnostic(options.diagnostics, {
          phase,
          outcome: "failed",
          reason: "timeout",
          attempt,
          elapsedMs: Date.now() - startedAt,
        });
        log("Portfolio MCP connection completed after the shared discovery deadline.");
        return false;
      }
      emitMcpDiagnostic(options.diagnostics, {
        phase,
        outcome: "succeeded",
        attempt,
        elapsedMs: Date.now() - startedAt,
      });
      return true;
    }

    if (attempt === MCP_CONNECTION_MAX_ATTEMPTS) return false;
    if (!hasMcpDiscoveryBudget(options.deadlineMs)) return false;

    const removed = await removeRecoverablePortfolioServers(
      manager,
      log,
      false,
      options.deadlineMs,
    );
    if (removed === null) {
      if (!hasMcpDiscoveryBudget(options.deadlineMs)) {
        emitMcpDiagnostic(options.diagnostics, {
          phase,
          outcome: "failed",
          reason: "timeout",
          attempt,
        });
      }
      return false;
    }
    if (removed.length === 0) return false;
    const remaining =
      options.deadlineMs !== undefined
        ? remainingMcpDiscoveryTimeout(options.deadlineMs)
        : undefined;
    if (remaining !== undefined && remaining <= 0) return false;
    await waitForRetry(
      remaining === undefined ? retryDelayMs(attempt) : Math.min(retryDelayMs(attempt), remaining),
    );
  }

  return false;
}
