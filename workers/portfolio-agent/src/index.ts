import type { ExportedHandler } from "@cloudflare/workers-types";
import { getAgentByName, routeAgentRequest } from "agents";
import { importJWK, jwtVerify } from "jose";
import { type AgentProps, getConfigString, type PortfolioAgentEnvironment } from "./config.ts";
import { sha256Base64Url } from "./crypto.ts";
import {
  AGENT_IDENTITY_HEADER,
  AGENT_REQUEST_ID_HEADER,
  encodeAgentIdentity,
  normalizeAgentRequestId,
  parseAgentIdentity,
} from "./identity.ts";
import { isAllowedBrowserOrigin, isValidThreadId, parseBrowserOrigins } from "./validation.ts";

type AgentAccessClaims = {
  sub: string;
  sid: string;
  tid: string;
  q: number;
  jti: string;
  scope: "chat";
};

const DEFAULT_THREAD_MESSAGE_PAGE_SIZE = 24;
const MAX_THREAD_MESSAGE_PAGE_SIZE = 50;

async function verifyAgentAccess(
  token: string,
  environment: PortfolioAgentEnvironment,
): Promise<AgentAccessClaims | null> {
  try {
    const publicJwk = JSON.parse(
      getConfigString(environment, "AGENT", "TOKEN", "PUBLIC", "JWK"),
    ) as JsonWebKey;
    const key = await importJWK(publicJwk, "ES256");
    const result = await jwtVerify(token, key, {
      issuer: environment.PUBLIC_AUTH_ORIGIN,
      audience: environment.AGENT_AUDIENCE,
    });
    const payload = result.payload;
    if (
      typeof payload.sub !== "string" ||
      typeof payload.sid !== "string" ||
      typeof payload.tid !== "string" ||
      typeof payload.q !== "number" ||
      typeof payload.jti !== "string" ||
      payload.scope !== "chat"
    ) {
      return null;
    }
    return {
      sub: payload.sub,
      sid: payload.sid,
      tid: payload.tid,
      q: payload.q,
      jti: payload.jti,
      scope: "chat",
    };
  } catch {
    return null;
  }
}

async function consumeAgentAccess(
  claims: AgentAccessClaims,
  environment: PortfolioAgentEnvironment,
): Promise<boolean> {
  const now = Date.now();
  const row = await environment.AUTH_DB.prepare(
    "SELECT agent_tokens.jti_hash FROM agent_tokens JOIN sessions ON sessions.id_hash = agent_tokens.session_id_hash JOIN users ON users.sub = agent_tokens.sub WHERE agent_tokens.jti_hash = ?1 AND agent_tokens.sub = ?2 AND agent_tokens.session_id_hash = ?3 AND agent_tokens.thread_id = ?4 AND agent_tokens.quota_epoch = ?5 AND agent_tokens.expires_at > ?6 AND agent_tokens.consumed_at IS NULL AND sessions.revoked_at IS NULL AND sessions.expires_at > ?6 AND users.disabled_at IS NULL",
  )
    .bind(await sha256Base64Url(claims.jti), claims.sub, claims.sid, claims.tid, claims.q, now)
    .first<{ jti_hash: string }>();
  if (!row) return false;
  const updated = await environment.AUTH_DB.prepare(
    "UPDATE agent_tokens SET consumed_at = ?1 WHERE jti_hash = ?2 AND consumed_at IS NULL",
  )
    .bind(now, row.jti_hash)
    .run();
  return updated.meta.changes === 1;
}

async function internalAgentWebSocketRequest(
  request: Request,
  environment: PortfolioAgentEnvironment,
): Promise<Response> {
  const url = new URL(request.url);
  const parts = url.pathname.split("/").filter(Boolean);
  let threadId = "";
  try {
    threadId = decodeURIComponent(parts[3] ?? "");
  } catch {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  if (!isValidThreadId(threadId)) return Response.json({ error: "Not found" }, { status: 404 });
  if (request.method !== "GET" || request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
    return Response.json({ error: "A WebSocket connection is required." }, { status: 426 });
  }
  const identity = parseAgentIdentity(request.headers.get(AGENT_IDENTITY_HEADER), threadId);
  if (!identity) return Response.json({ error: "Authentication required" }, { status: 401 });
  const requestId = normalizeAgentRequestId(request.headers.get(AGENT_REQUEST_ID_HEADER));
  const targetUrl = new URL(request.url);
  targetUrl.pathname = `/agents/portfolio-agent/${encodeURIComponent(threadId)}`;
  targetUrl.search = "";
  const connectionId = url.searchParams.get("_pk");
  if (connectionId && connectionId.length <= 128) targetUrl.searchParams.set("_pk", connectionId);

  const headers = new Headers(request.headers);
  headers.delete("Authorization");
  headers.delete("Cookie");
  headers.delete(AGENT_REQUEST_ID_HEADER);
  const response = await routeAgentRequest(
    new Request(targetUrl, { method: "GET", headers }),
    environment,
    { props: requestId ? { ...identity, requestId } : identity },
  );
  return response ?? Response.json({ error: "Not found" }, { status: 404 });
}

async function internalRequest(
  request: Request,
  environment: PortfolioAgentEnvironment,
): Promise<Response | null> {
  const url = new URL(request.url);
  const isInternalAgentRoute = url.pathname.startsWith("/internal/agents/portfolio-agent/");
  const isInternalThreadRoute = url.pathname.startsWith("/internal/threads/");
  if (!isInternalAgentRoute && !isInternalThreadRoute) return null;
  const expected = `Bearer ${getConfigString(environment, "AGENT", "INTERNAL", "KEY")}`;
  if (request.headers.get("Authorization") !== expected)
    return Response.json({ error: "Forbidden" }, { status: 403 });
  if (isInternalAgentRoute) {
    return internalAgentWebSocketRequest(request, environment);
  }
  const parts = url.pathname.split("/").filter(Boolean);
  const threadId = parts[2] ?? "";
  const action = parts[3] ?? "delete";
  if (
    threadId.length < 16 ||
    (action !== "delete" && action !== "export" && action !== "messages")
  ) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  const limitParam = url.searchParams.get("limit");
  const beforeParam = url.searchParams.get("before");
  const paged = limitParam !== null || beforeParam !== null;
  let pageOptions: { before?: string; limit: number } | undefined;
  if (paged) {
    const limit = limitParam === null ? DEFAULT_THREAD_MESSAGE_PAGE_SIZE : Number(limitParam);
    const before = beforeParam?.trim();
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_THREAD_MESSAGE_PAGE_SIZE) {
      return Response.json({ error: "Invalid thread message page size." }, { status: 400 });
    }
    if (beforeParam !== null && (!before || before.length > 256)) {
      return Response.json({ error: "Invalid thread message cursor." }, { status: 400 });
    }
    pageOptions = { limit, ...(before ? { before } : {}) };
  }

  const stub = (await getAgentByName(environment.PortfolioAgent as never, threadId)) as unknown as {
    deleteThread: () => Promise<{ deleted: true }>;
    exportThread: () => Promise<Record<string, unknown>>;
    getThreadMessages: (options?: {
      before?: string;
      limit?: number;
    }) => Promise<unknown[] | { messages: unknown[]; nextCursor: string | null; hasMore: boolean }>;
  };
  if (action === "messages" && request.method === "GET") {
    try {
      const result = await stub.getThreadMessages(pageOptions);
      return Response.json(paged ? result : { messages: result });
    } catch (error) {
      if (error instanceof Error && error.message === "Invalid thread message cursor.") {
        return Response.json({ error: "Invalid thread message cursor." }, { status: 400 });
      }
      throw error;
    }
  }
  if (action === "export" && request.method === "GET") {
    return Response.json(await stub.exportThread());
  }
  if (action === "delete" && request.method === "DELETE") {
    return Response.json(await stub.deleteThread());
  }
  return Response.json({ error: "Method not allowed" }, { status: 405 });
}

async function authenticatedRoute(
  request: Request,
  environment: PortfolioAgentEnvironment,
): Promise<Response> {
  const origin = request.headers.get("Origin");
  if (!isAllowedBrowserOrigin(origin, parseBrowserOrigins(environment.BROWSER_ORIGINS))) {
    return Response.json({ error: "Forbidden origin" }, { status: 403 });
  }
  const url = new URL(request.url);
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts[0] !== "agents" || parts[1] !== "portfolio-agent") {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  const name = decodeURIComponent(parts[2] ?? "");
  const token = url.searchParams.get("token");
  if (!token || !name) return Response.json({ error: "Authentication required" }, { status: 401 });
  const claims = await verifyAgentAccess(token, environment);
  if (!claims || claims.tid !== name)
    return Response.json({ error: "Authentication required" }, { status: 401 });
  if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
    return Response.json({ error: "A WebSocket connection is required." }, { status: 426 });
  }
  if (!(await consumeAgentAccess(claims, environment))) {
    return Response.json({ error: "Access token is expired or already used." }, { status: 401 });
  }
  const cleanUrl = new URL(request.url);
  cleanUrl.searchParams.delete("token");
  const forwarded = new Request(cleanUrl, request);
  const agentProps: AgentProps = {
    sub: claims.sub,
    sid: claims.sid,
    tid: claims.tid,
    q: claims.q,
  };
  const response = await routeAgentRequest(forwarded, environment, {
    onBeforeConnect: (connectRequest) => {
      const nextRequest = new Request(connectRequest);
      nextRequest.headers.set(AGENT_IDENTITY_HEADER, encodeAgentIdentity(agentProps));
      return nextRequest;
    },
    props: agentProps,
  });
  return response ?? Response.json({ error: "Not found" }, { status: 404 });
}

type WorkerFetchHandler = NonNullable<ExportedHandler<PortfolioAgentEnvironment>["fetch"]>;
type WorkerRequest = Parameters<WorkerFetchHandler>[0];
type WorkerEnvironment = Parameters<WorkerFetchHandler>[1];

const worker = {
  fetch(request: WorkerRequest, environment: WorkerEnvironment) {
    const typedRequest = request as unknown as Request;
    const typedEnvironment = environment as unknown as PortfolioAgentEnvironment;
    return (async () => {
      const internal = await internalRequest(typedRequest, typedEnvironment);
      if (internal) return internal;
      return authenticatedRoute(typedRequest, typedEnvironment);
    })() as unknown as ReturnType<WorkerFetchHandler>;
  },
} satisfies ExportedHandler<PortfolioAgentEnvironment>;

export { PortfolioAgent } from "./agent.ts";
export default worker;
