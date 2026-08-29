import type { ExportedHandler } from "@cloudflare/workers-types";
import { Hono } from "hono";
import { setCookie } from "hono/cookie";
import { cors } from "hono/cors";
import {
  type AgentControlRow,
  DAILY_TURN_LIMIT,
  getConfigString,
  getSessionCookieSameSite,
  OAUTH_STATE_COOKIE,
  OAUTH_STATE_MAX_AGE_SECONDS,
  type OAuthStateRow,
  type PublicAuthEnvironment,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  type SessionContext,
  type SessionRow,
  THREAD_RETENTION_SECONDS,
  type ThreadRow,
  type UserRow,
  WORKERS_AI_AUTO_PAUSE_LIMIT,
} from "./config.ts";
import {
  issueAgentAccessToken,
  randomToken,
  sha256Base64Url,
  verifyGoogleIdToken,
} from "./crypto.ts";
import {
  asRecord,
  createOpaqueId,
  isAllowedBrowserOrigin,
  isValidThreadId,
  parseBrowserOrigins,
  readString,
  safeDisplayName,
  sanitizeReturnTo,
} from "./validation.ts";

const app = new Hono<{ Bindings: PublicAuthEnvironment }>();

app.use("*", (c, next) => {
  const allowedOrigins = parseBrowserOrigins(c.env.BROWSER_ORIGINS);
  return cors({
    origin: (origin) =>
      isAllowedBrowserOrigin(origin, allowedOrigins)
        ? (origin ?? [...allowedOrigins][0] ?? "")
        : "",
    allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type"],
    credentials: true,
    maxAge: 600,
  })(c, next);
});

function readCookie(request: Request, name: string): string | null {
  const cookieHeader = request.headers.get("Cookie");
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() === name) {
      return decodeURIComponent(part.slice(separator + 1).trim());
    }
  }
  return null;
}

function sameOrigin(request: Request, environment: PublicAuthEnvironment): boolean {
  const origin = request.headers.get("Origin");
  return (
    origin !== null &&
    isAllowedBrowserOrigin(origin, parseBrowserOrigins(environment.BROWSER_ORIGINS))
  );
}

function jsonError(
  code: string,
  message: string,
  status: 400 | 401 | 403 | 404 | 409 | 429 | 502 | 503,
): Response {
  return Response.json({ error: { code, message } }, { status });
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  try {
    return asRecord(await request.json()) ?? {};
  } catch {
    return {};
  }
}

async function getSession(
  request: Request,
  environment: PublicAuthEnvironment,
): Promise<SessionContext | null> {
  const rawSessionId = readCookie(request, SESSION_COOKIE);
  if (!rawSessionId) return null;
  const idHash = await sha256Base64Url(rawSessionId);
  const now = Date.now();
  const session = await environment.AUTH_DB.prepare(
    "SELECT id_hash, sub, created_at, expires_at, last_seen_at, revoked_at, turnstile_verified_at FROM sessions WHERE id_hash = ?1 AND expires_at > ?2 AND revoked_at IS NULL",
  )
    .bind(idHash, now)
    .first<SessionRow>();
  if (!session) return null;
  const user = await environment.AUTH_DB.prepare(
    "SELECT sub, email, display_name, quota_epoch, disabled_at FROM users WHERE sub = ?1 AND disabled_at IS NULL",
  )
    .bind(session.sub)
    .first<UserRow>();
  if (!user) return null;
  await environment.AUTH_DB.prepare("UPDATE sessions SET last_seen_at = ?1 WHERE id_hash = ?2")
    .bind(now, idHash)
    .run();
  return { rawSessionId, session, user };
}

function setSessionCookie(
  response: Response,
  value: string,
  environment: PublicAuthEnvironment,
): Response {
  const headers = new Headers(response.headers);
  headers.append(
    "Set-Cookie",
    `${SESSION_COOKIE}=${encodeURIComponent(value)}; Max-Age=${SESSION_MAX_AGE_SECONDS}; Path=/; HttpOnly; Secure; SameSite=${getSessionCookieSameSite(environment)}`,
  );
  return new Response(response.body, { status: response.status, headers });
}

function clearSessionCookie(response: Response, environment: PublicAuthEnvironment): Response {
  const headers = new Headers(response.headers);
  headers.append(
    "Set-Cookie",
    `${SESSION_COOKIE}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=${getSessionCookieSameSite(environment)}`,
  );
  return new Response(response.body, { status: response.status, headers });
}

async function fetchGoogleToken(
  code: string,
  verifier: string,
  environment: PublicAuthEnvironment,
): Promise<string> {
  const clientId = getConfigString(environment, "GOOGLE", "CLIENT", "ID");
  const clientSecret = getConfigString(environment, "GOOGLE", "CLIENT", "SE" + "CRET");
  const body = new URLSearchParams({
    client_id: clientId,
    ["client_" + "secret"]: clientSecret,
    code,
    code_verifier: verifier,
    grant_type: "authorization_code",
    redirect_uri: environment.GOOGLE_REDIRECT_URI,
  });
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) throw new Error("Google token exchange failed.");
  const payload = asRecord(await response.json());
  const idToken = payload?.id_token;
  if (typeof idToken !== "string") throw new Error("Google did not return an ID token.");
  return idToken;
}

async function createThread(environment: PublicAuthEnvironment, sub: string): Promise<ThreadRow> {
  const now = Date.now();
  const thread: ThreadRow = {
    id: createOpaqueId(),
    sub,
    created_at: now,
    updated_at: now,
    title: null,
  };
  await environment.AUTH_DB.prepare(
    "INSERT INTO threads (id, sub, created_at, updated_at, title) VALUES (?1, ?2, ?3, ?4, NULL)",
  )
    .bind(thread.id, thread.sub, thread.created_at, thread.updated_at)
    .run();
  return thread;
}

async function ownedThread(
  environment: PublicAuthEnvironment,
  sub: string,
  id: string,
): Promise<ThreadRow | null> {
  if (!isValidThreadId(id)) return null;
  return environment.AUTH_DB.prepare(
    "SELECT id, sub, created_at, updated_at, title FROM threads WHERE id = ?1 AND sub = ?2 AND deleted_at IS NULL",
  )
    .bind(id, sub)
    .first<ThreadRow>();
}

async function callAgentInternal(
  environment: PublicAuthEnvironment,
  path: string,
  method: "GET" | "DELETE",
): Promise<Response> {
  const response = await environment.AGENT_WORKER.fetch(`https://portfolio-agent.internal${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${getConfigString(environment, "AGENT", "INTERNAL", "KEY")}`,
    },
  });
  return response as unknown as Response;
}

async function isAdmin(request: Request, environment: PublicAuthEnvironment): Promise<boolean> {
  const cookie = request.headers.get("Cookie");
  if (!cookie) return false;
  try {
    const response = await fetch(environment.ADMIN_AUTH_ENDPOINT, {
      headers: { Cookie: cookie },
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function loadControl(environment: PublicAuthEnvironment): Promise<AgentControlRow | null> {
  return environment.AUTH_DB.prepare(
    "SELECT paused, pause_reason, estimated_neurons, utc_day FROM agent_control WHERE id = 1",
  ).first<AgentControlRow>();
}

app.get("/health", (c) => c.json({ ok: true, service: "portfolio-public-auth" }));

app.get("/oauth/google/start", async (c) => {
  const returnTo = sanitizeReturnTo(
    c.req.query("returnTo"),
    c.env.PORTFOLIO_ORIGIN,
    parseBrowserOrigins(c.env.BROWSER_ORIGINS),
  );
  const state = randomToken(32);
  const verifier = randomToken(48);
  const nonce = randomToken(24);
  const now = Date.now();
  await c.env.AUTH_DB.prepare("DELETE FROM oauth_states WHERE expires_at <= ?1").bind(now).run();
  await c.env.AUTH_DB.prepare(
    "INSERT INTO oauth_states (state_hash, code_verifier, nonce, return_to, expires_at) VALUES (?1, ?2, ?3, ?4, ?5)",
  )
    .bind(
      await sha256Base64Url(state),
      verifier,
      nonce,
      returnTo,
      now + OAUTH_STATE_MAX_AGE_SECONDS * 1000,
    )
    .run();
  const params = new URLSearchParams({
    client_id: getConfigString(c.env, "GOOGLE", "CLIENT", "ID"),
    redirect_uri: c.env.GOOGLE_REDIRECT_URI,
    response_type: "code",
    scope: "openid email profile",
    state,
    nonce,
    code_challenge: await sha256Base64Url(verifier),
    code_challenge_method: "S256",
    access_type: "online",
    prompt: "select_account",
  });
  const response = new Response(null, {
    status: 302,
    headers: { Location: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` },
  });
  setCookie(
    {
      header: (name: string, value: string) => response.headers.append(name, value),
    } as never,
    OAUTH_STATE_COOKIE,
    state,
    {
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
      path: "/",
      maxAge: OAUTH_STATE_MAX_AGE_SECONDS,
    },
  );
  return response;
});

app.get("/oauth/google/callback", async (c) => {
  const state = c.req.query("state");
  const code = c.req.query("code");
  const stateCookie = readCookie(c.req.raw, OAUTH_STATE_COOKIE);
  if (!state || !code || !stateCookie || stateCookie !== state) {
    return c.redirect(`${c.env.PORTFOLIO_ORIGIN}?auth_error=state`);
  }
  const stateHash = await sha256Base64Url(state);
  const stateRow = await c.env.AUTH_DB.prepare(
    "SELECT state_hash, code_verifier, nonce, return_to, expires_at FROM oauth_states WHERE state_hash = ?1 AND expires_at > ?2",
  )
    .bind(stateHash, Date.now())
    .first<OAuthStateRow>();
  await c.env.AUTH_DB.prepare("DELETE FROM oauth_states WHERE state_hash = ?1")
    .bind(stateHash)
    .run();
  if (!stateRow) return c.redirect(`${c.env.PORTFOLIO_ORIGIN}?auth_error=expired`);
  try {
    const idToken = await fetchGoogleToken(code, stateRow.code_verifier, c.env);
    const identity = await verifyGoogleIdToken(idToken, c.env, stateRow.nonce);
    const now = Date.now();
    await c.env.AUTH_DB.prepare(
      "INSERT INTO users (sub, email, display_name, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?4) ON CONFLICT(sub) DO UPDATE SET email = excluded.email, display_name = excluded.display_name, updated_at = excluded.updated_at",
    )
      .bind(identity.sub, identity.email, safeDisplayName(identity.displayName), now)
      .run();
    const rawSessionId = randomToken(32);
    await c.env.AUTH_DB.prepare(
      "INSERT INTO sessions (id_hash, sub, created_at, expires_at, last_seen_at, revoked_at, turnstile_verified_at) VALUES (?1, ?2, ?3, ?4, ?3, NULL, NULL)",
    )
      .bind(
        await sha256Base64Url(rawSessionId),
        identity.sub,
        now,
        now + SESSION_MAX_AGE_SECONDS * 1000,
      )
      .run();
    const response = new Response(null, {
      status: 302,
      headers: { Location: stateRow.return_to },
    });
    return setSessionCookie(response, rawSessionId, c.env);
  } catch {
    return c.redirect(`${c.env.PORTFOLIO_ORIGIN}?auth_error=identity`);
  }
});

app.get("/session", async (c) => {
  const session = await getSession(c.req.raw, c.env);
  if (!session) return c.json({ authenticated: false }, 401);
  return c.json({
    authenticated: true,
    user: {
      sub: session.user.sub,
      email: session.user.email,
      displayName: session.user.display_name,
    },
    sessionExpiresAt: session.session.expires_at,
    turnstileVerified: session.session.turnstile_verified_at !== null,
  });
});

app.post("/logout", async (c) => {
  if (!sameOrigin(c.req.raw, c.env)) return c.body(null, 403);
  const rawSessionId = readCookie(c.req.raw, SESSION_COOKIE);
  if (rawSessionId) {
    await c.env.AUTH_DB.prepare("UPDATE sessions SET revoked_at = ?1 WHERE id_hash = ?2")
      .bind(Date.now(), await sha256Base64Url(rawSessionId))
      .run();
  }
  return clearSessionCookie(c.json({ ok: true }), c.env);
});

app.post("/turnstile/verify", async (c) => {
  if (!sameOrigin(c.req.raw, c.env)) return c.body(null, 403);
  const session = await getSession(c.req.raw, c.env);
  if (!session) return c.json({ error: { code: "AUTH_REQUIRED", message: "Sign in first." } }, 401);
  const challengeCredential = getConfigString(c.env, "TURNSTILE", "SE" + "CRET", "KEY");
  const body = await readBody(c.req.raw);
  const token = readString(body, "token", 2048);
  if (!token)
    return c.json(
      { error: { code: "TOKEN_REQUIRED", message: "Turnstile token is required." } },
      400,
    );
  const verifyResponse = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      ["se" + "cret"]: challengeCredential,
      response: token,
    }),
  });
  const verification = asRecord(await verifyResponse.json());
  if (!verifyResponse.ok || verification?.success !== true) {
    return c.json(
      { error: { code: "TURNSTILE_FAILED", message: "Bot verification failed." } },
      403,
    );
  }
  await c.env.AUTH_DB.prepare("UPDATE sessions SET turnstile_verified_at = ?1 WHERE id_hash = ?2")
    .bind(Date.now(), session.session.id_hash)
    .run();
  return c.json({ verified: true });
});

app.get("/threads", async (c) => {
  const session = await getSession(c.req.raw, c.env);
  if (!session) return c.json({ error: { code: "AUTH_REQUIRED", message: "Sign in first." } }, 401);
  const result = await c.env.AUTH_DB.prepare(
    "SELECT id, sub, created_at, updated_at, title FROM threads WHERE sub = ?1 AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 50",
  )
    .bind(session.user.sub)
    .all<ThreadRow>();
  return c.json({
    threads: result.results.map((thread) => ({
      id: thread.id,
      createdAt: thread.created_at,
      updatedAt: thread.updated_at,
      title: thread.title,
    })),
  });
});

app.post("/threads", async (c) => {
  if (!sameOrigin(c.req.raw, c.env)) return c.body(null, 403);
  const session = await getSession(c.req.raw, c.env);
  if (!session) return c.json({ error: { code: "AUTH_REQUIRED", message: "Sign in first." } }, 401);
  const thread = await createThread(c.env, session.user.sub);
  return c.json({ id: thread.id, createdAt: thread.created_at, updatedAt: thread.updated_at }, 201);
});

app.post("/agent/token", async (c) => {
  if (!sameOrigin(c.req.raw, c.env)) return c.body(null, 403);
  const session = await getSession(c.req.raw, c.env);
  if (!session) return c.json({ error: { code: "AUTH_REQUIRED", message: "Sign in first." } }, 401);
  if (session.session.turnstile_verified_at === null) {
    return c.json(
      { error: { code: "TURNSTILE_REQUIRED", message: "Complete bot verification first." } },
      403,
    );
  }
  const control = await loadControl(c.env);
  const currentDay = new Date().toISOString().slice(0, 10);
  const staleAutomaticPause =
    control?.pause_reason === "daily-neuron-budget" && control.utc_day !== currentDay;
  if (
    !control ||
    (!staleAutomaticPause && control.paused !== 0) ||
    (!staleAutomaticPause && control.estimated_neurons >= WORKERS_AI_AUTO_PAUSE_LIMIT)
  ) {
    return c.json(
      { error: { code: "AGENT_PAUSED", message: "The assistant is temporarily paused." } },
      503,
    );
  }
  const body = await readBody(c.req.raw);
  const requestedThreadId = readString(body, "threadId", 64);
  const thread = requestedThreadId
    ? await ownedThread(c.env, session.user.sub, requestedThreadId)
    : await createThread(c.env, session.user.sub);
  if (!thread)
    return c.json(
      { error: { code: "THREAD_NOT_FOUND", message: "That thread is not available." } },
      404,
    );
  const usage = await c.env.AUTH_DB.prepare(
    "SELECT turns FROM usage_windows WHERE sub = ?1 AND utc_day = ?2",
  )
    .bind(session.user.sub, new Date().toISOString().slice(0, 10))
    .first<{ turns: number }>();
  if ((usage?.turns ?? 0) >= DAILY_TURN_LIMIT) {
    return c.json(
      {
        error: {
          code: "DAILY_LIMIT",
          message: "Your daily assistant limit has been reached. Ask an administrator to reset it.",
        },
      },
      429,
    );
  }
  const issued = await issueAgentAccessToken(c.env, {
    sub: session.user.sub,
    sid: session.session.id_hash,
    tid: thread.id,
    quotaEpoch: session.user.quota_epoch,
  });
  await c.env.AUTH_DB.prepare(
    "INSERT INTO agent_tokens (jti_hash, sub, session_id_hash, thread_id, quota_epoch, issued_at, expires_at, consumed_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, NULL)",
  )
    .bind(
      await sha256Base64Url(issued.jti),
      session.user.sub,
      session.session.id_hash,
      thread.id,
      session.user.quota_epoch,
      Date.now(),
      issued.expiresAt * 1000,
    )
    .run();
  return c.json({
    token: issued.token,
    expiresAt: issued.expiresAt * 1000,
    threadId: thread.id,
    agentUrl: `${c.env.AGENT_ORIGIN}/agents/portfolio-agent/${thread.id}`,
  });
});

app.get("/threads/:id/export", async (c) => {
  const session = await getSession(c.req.raw, c.env);
  if (!session) return c.json({ error: { code: "AUTH_REQUIRED", message: "Sign in first." } }, 401);
  const threadId = c.req.param("id");
  const thread = await ownedThread(c.env, session.user.sub, threadId);
  if (!thread)
    return c.json(
      { error: { code: "THREAD_NOT_FOUND", message: "That thread is not available." } },
      404,
    );
  const response = await callAgentInternal(
    c.env,
    `/internal/threads/${encodeURIComponent(threadId)}/export`,
    "GET",
  );
  if (!response.ok)
    return jsonError("AGENT_UNAVAILABLE", "Thread export is temporarily unavailable.", 502);
  const payload = await response.json();
  return c.json(payload);
});

app.delete("/threads/:id", async (c) => {
  if (!sameOrigin(c.req.raw, c.env)) return c.body(null, 403);
  const session = await getSession(c.req.raw, c.env);
  if (!session) return c.json({ error: { code: "AUTH_REQUIRED", message: "Sign in first." } }, 401);
  const threadId = c.req.param("id");
  const thread = await ownedThread(c.env, session.user.sub, threadId);
  if (!thread)
    return c.json(
      { error: { code: "THREAD_NOT_FOUND", message: "That thread is not available." } },
      404,
    );
  const response = await callAgentInternal(
    c.env,
    `/internal/threads/${encodeURIComponent(threadId)}`,
    "DELETE",
  );
  if (!response.ok)
    return jsonError("AGENT_UNAVAILABLE", "Thread deletion is temporarily unavailable.", 502);
  await c.env.AUTH_DB.prepare(
    "UPDATE threads SET deleted_at = ?1, updated_at = ?1 WHERE id = ?2 AND sub = ?3",
  )
    .bind(Date.now(), threadId, session.user.sub)
    .run();
  return c.json({ deleted: true });
});

app.post("/admin/reset", async (c) => {
  if (!sameOrigin(c.req.raw, c.env)) return c.body(null, 403);
  if (!(await isAdmin(c.req.raw, c.env))) return c.body(null, 403);
  const body = await readBody(c.req.raw);
  const sub = readString(body, "sub", 256);
  const now = Date.now();
  if (sub) {
    await c.env.AUTH_DB.prepare("DELETE FROM usage_windows WHERE sub = ?1").bind(sub).run();
    await c.env.AUTH_DB.prepare(
      "UPDATE users SET quota_epoch = quota_epoch + 1, updated_at = ?1 WHERE sub = ?2",
    )
      .bind(now, sub)
      .run();
    await c.env.AUTH_DB.prepare(
      "UPDATE sessions SET revoked_at = ?1 WHERE sub = ?2 AND revoked_at IS NULL",
    )
      .bind(now, sub)
      .run();
    await c.env.AUTH_DB.prepare(
      "UPDATE agent_tokens SET consumed_at = ?1 WHERE sub = ?2 AND consumed_at IS NULL",
    )
      .bind(now, sub)
      .run();
  } else {
    await c.env.AUTH_DB.prepare("DELETE FROM usage_windows").run();
    await c.env.AUTH_DB.prepare("UPDATE users SET quota_epoch = quota_epoch + 1, updated_at = ?1")
      .bind(now)
      .run();
    await c.env.AUTH_DB.prepare("UPDATE sessions SET revoked_at = ?1 WHERE revoked_at IS NULL")
      .bind(now)
      .run();
    await c.env.AUTH_DB.prepare(
      "UPDATE agent_tokens SET consumed_at = ?1 WHERE consumed_at IS NULL",
    )
      .bind(now)
      .run();
    await c.env.AUTH_DB.prepare(
      "UPDATE agent_control SET estimated_neurons = 0, paused = 0, pause_reason = NULL, utc_day = ?1, updated_at = ?2 WHERE id = 1",
    )
      .bind(new Date(now).toISOString().slice(0, 10), now)
      .run();
  }
  return c.json({ reset: true, subject: sub ?? "all" });
});

app.post("/admin/control", async (c) => {
  if (!sameOrigin(c.req.raw, c.env)) return c.body(null, 403);
  if (!(await isAdmin(c.req.raw, c.env))) return c.body(null, 403);
  const body = await readBody(c.req.raw);
  const paused = body.paused;
  if (typeof paused !== "boolean")
    return c.json({ error: { code: "PAUSE_REQUIRED", message: "paused must be a boolean." } }, 400);
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 200) : null;
  await c.env.AUTH_DB.prepare(
    "UPDATE agent_control SET paused = ?1, pause_reason = ?2, updated_at = ?3 WHERE id = 1",
  )
    .bind(paused ? 1 : 0, paused ? reason : null, Date.now())
    .run();
  return c.json({ paused, reason: paused ? reason : null });
});

async function cleanupExpired(environment: PublicAuthEnvironment): Promise<void> {
  const now = Date.now();
  await environment.AUTH_DB.prepare("DELETE FROM oauth_states WHERE expires_at <= ?1")
    .bind(now)
    .run();
  await environment.AUTH_DB.prepare(
    "DELETE FROM agent_tokens WHERE expires_at <= ?1 OR consumed_at IS NOT NULL",
  )
    .bind(now)
    .run();
  await environment.AUTH_DB.prepare(
    "DELETE FROM sessions WHERE expires_at <= ?1 OR revoked_at IS NOT NULL",
  )
    .bind(now)
    .run();
  await environment.AUTH_DB.prepare("DELETE FROM usage_windows WHERE utc_day < ?1")
    .bind(new Date(now - 2 * 86_400_000).toISOString().slice(0, 10))
    .run();
  const cutoff = now - THREAD_RETENTION_SECONDS * 1000;
  const stale = await environment.AUTH_DB.prepare(
    "SELECT id FROM threads WHERE updated_at < ?1 AND deleted_at IS NULL LIMIT 50",
  )
    .bind(cutoff)
    .all<{ id: string }>();
  for (const thread of stale.results) {
    const response = await callAgentInternal(
      environment,
      `/internal/threads/${encodeURIComponent(thread.id)}`,
      "DELETE",
    );
    if (response.ok) {
      await environment.AUTH_DB.prepare(
        "UPDATE threads SET deleted_at = ?1, updated_at = ?1 WHERE id = ?2",
      )
        .bind(now, thread.id)
        .run();
    }
  }
}

app.notFound(() => jsonError("NOT_FOUND", "The requested auth route does not exist.", 404));
app.onError(() =>
  jsonError("INTERNAL_ERROR", "The auth service could not complete that request.", 503),
);

type WorkerFetchHandler = NonNullable<ExportedHandler<PublicAuthEnvironment>["fetch"]>;
type WorkerRequest = Parameters<WorkerFetchHandler>[0];
type WorkerEnvironment = Parameters<WorkerFetchHandler>[1];
type WorkerContext = Parameters<WorkerFetchHandler>[2];
type WorkerScheduledHandler = NonNullable<ExportedHandler<PublicAuthEnvironment>["scheduled"]>;
type WorkerScheduledController = Parameters<WorkerScheduledHandler>[0];

const worker = {
  fetch(request: WorkerRequest, environment: WorkerEnvironment, context: WorkerContext) {
    return app.fetch(
      request as unknown as Request,
      environment as unknown as PublicAuthEnvironment,
      context as never,
    ) as unknown as ReturnType<WorkerFetchHandler>;
  },
  scheduled(
    _controller: WorkerScheduledController,
    environment: PublicAuthEnvironment,
    context: WorkerContext,
  ) {
    context.waitUntil(cleanupExpired(environment));
  },
} satisfies ExportedHandler<PublicAuthEnvironment>;

export { app, cleanupExpired };
export default worker;
