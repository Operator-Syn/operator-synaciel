import assert from "node:assert/strict";
import type { Page } from "playwright/test";

const JWT_PATTERN = /(?:^|[^A-Za-z0-9_-])eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/;
const SENSITIVE_QUERY_PARAMETER = /^(?:token|access_token|id_token|authorization|jwt)$/i;
const PREMATURE_WEBSOCKET_CLOSE = /WebSocket is closed before the connection is established/i;
const CLOUDFLARE_INSIGHTS_BLOCKED =
  /static\.cloudflareinsights\.com\/beacon\.min\.js[\s\S]*ERR_BLOCKED_BY_CLIENT/i;

export type BrowserAuditEvent = {
  kind:
    | "console-error"
    | "page-error"
    | "request-failed"
    | "websocket-created"
    | "websocket-closed"
    | "websocket-error"
    | "websocket-premature-close";
  url?: string;
};

export type BrowserUrlInspection = {
  credentialExposed: boolean;
  safeUrl: string;
};

export function inspectBrowserUrl(rawUrl: string): BrowserUrlInspection {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { credentialExposed: JWT_PATTERN.test(rawUrl), safeUrl: "<invalid-url>" };
  }

  const parameterNames = [
    ...new Set([...parsed.searchParams.keys()].map((name) => name.toLowerCase())),
  ];
  const credentialExposed =
    JWT_PATTERN.test(rawUrl) || parameterNames.some((name) => SENSITIVE_QUERY_PARAMETER.test(name));
  const query = parameterNames.sort().join("&");
  return {
    credentialExposed,
    safeUrl: `${parsed.origin}${parsed.pathname}${query ? `?${query}` : ""}`,
  };
}

function isAllowedTelemetryRequest(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    return (
      parsed.origin === "https://static.cloudflareinsights.com" &&
      parsed.pathname.startsWith("/beacon.min.js")
    );
  } catch {
    return false;
  }
}

export function installAssistantBrowserAudit(page: Page): {
  events: BrowserAuditEvent[];
  assertClean: () => void;
} {
  const events: BrowserAuditEvent[] = [];
  let credentialExposure = false;
  let prematureWebSocketClose = false;

  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (JWT_PATTERN.test(text)) credentialExposure = true;
    if (CLOUDFLARE_INSIGHTS_BLOCKED.test(text)) return;
    if (PREMATURE_WEBSOCKET_CLOSE.test(text)) {
      prematureWebSocketClose = true;
      events.push({ kind: "websocket-premature-close" });
      return;
    }
    events.push({ kind: "console-error" });
  });

  page.on("pageerror", (error) => {
    if (JWT_PATTERN.test(error.message)) credentialExposure = true;
    events.push({ kind: "page-error" });
  });

  page.on("requestfailed", (request) => {
    if (isAllowedTelemetryRequest(request.url())) return;
    const inspection = inspectBrowserUrl(request.url());
    credentialExposure ||= inspection.credentialExposed;
    events.push({ kind: "request-failed", url: inspection.safeUrl });
  });

  page.on("websocket", (websocket) => {
    const inspection = inspectBrowserUrl(websocket.url());
    credentialExposure ||= inspection.credentialExposed;
    events.push({ kind: "websocket-created", url: inspection.safeUrl });
    websocket.on("close", () => events.push({ kind: "websocket-closed", url: inspection.safeUrl }));
    websocket.on("socketerror", () =>
      events.push({ kind: "websocket-error", url: inspection.safeUrl }),
    );
  });

  return {
    events,
    assertClean() {
      assert.equal(
        credentialExposure,
        false,
        "browser telemetry exposed a credential in a URL or error",
      );
      assert.equal(
        prematureWebSocketClose,
        false,
        "browser reported a WebSocket closed before the connection was established",
      );
      const unexpectedEvents = events.filter(({ kind }) =>
        [
          "console-error",
          "page-error",
          "request-failed",
          "websocket-error",
          "websocket-premature-close",
        ].includes(kind),
      );
      assert.deepEqual(
        unexpectedEvents,
        [],
        "browser assistant audit reported unexpected failures",
      );
    },
  };
}
