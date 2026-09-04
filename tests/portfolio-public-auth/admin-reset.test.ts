import assert from "node:assert/strict";
import { test } from "node:test";
import { app } from "../../workers/portfolio-public-auth/src/index.ts";

type Query = { sql: string; args: unknown[] };

class RecordingDatabase {
  readonly queries: Query[] = [];

  prepare(sql: string) {
    const record = (args: unknown[]) => {
      this.queries.push({ sql, args });
      return { meta: { changes: 1 } };
    };
    return {
      bind: (...args: unknown[]) => ({
        run: async () => record(args),
      }),
      run: async () => record([]),
    };
  }
}

function environment(database: RecordingDatabase, browserOrigins = "https://syn-forge.com") {
  return {
    AUTH_DB: database,
    AGENT_WORKER: { fetch: async () => new Response(null, { status: 200 }) },
    PUBLIC_AUTH_ORIGIN: "https://public-auth.syn-forge.com",
    PORTFOLIO_ORIGIN: "https://syn-forge.com",
    AGENT_ORIGIN: "https://assistant.syn-forge.com",
    BROWSER_ORIGINS: browserOrigins,
    SESSION_COOKIE_SAME_SITE: "Lax",
    GOOGLE_REDIRECT_URI: "https://public-auth.syn-forge.com/oauth/google/callback",
    AGENT_AUDIENCE: "portfolio-agent",
    ADMIN_AUTH_ENDPOINT: "https://auth.syn-forge.com/auth/user",
  };
}

async function postReset(
  database: RecordingDatabase,
  body: Record<string, unknown>,
  origin = "https://syn-forge.com",
  browserOrigins = "https://syn-forge.com",
) {
  const request = new Request("https://public-auth.syn-forge.com/admin/reset", {
    method: "POST",
    headers: {
      Origin: origin,
      Cookie: "admin-session=present",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return app.fetch(request, environment(database, browserOrigins) as never);
}

test("state-changing routes use the configured browser origins", async () => {
  const database = new RecordingDatabase();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(null, { status: 200 });
  try {
    const localResponse = await postReset(
      database,
      {},
      "http://localhost:5173",
      "http://localhost:5173",
    );
    assert.equal(localResponse.status, 200);
    const forbiddenResponse = await postReset(
      database,
      {},
      "https://evil.example",
      "http://localhost:5173",
    );
    assert.equal(forbiddenResponse.status, 403);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("user reset preserves the global neuron control row", async () => {
  const database = new RecordingDatabase();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(null, { status: 200 });
  try {
    const response = await postReset(database, { sub: "google-sub" });
    assert.equal(response.status, 200);
    assert.equal(
      database.queries.some(({ sql }) => sql.includes("UPDATE agent_control")),
      false,
    );
    assert.equal(
      database.queries.some(({ sql }) => sql.includes("DELETE FROM rolling_token_usage")),
      true,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("global reset clears the global neuron control row", async () => {
  const database = new RecordingDatabase();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(null, { status: 200 });
  try {
    const response = await postReset(database, {});
    assert.equal(response.status, 200);
    assert.equal(
      database.queries.some(({ sql }) => sql.includes("UPDATE agent_control")),
      true,
    );
    assert.equal(
      database.queries.some(({ sql }) => sql.includes("DELETE FROM rolling_token_usage")),
      true,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
