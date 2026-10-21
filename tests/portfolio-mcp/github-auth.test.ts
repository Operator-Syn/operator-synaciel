import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { test } from "node:test";
import { decodeJwt } from "jose";
import { createGitHubTransport } from "../../workers/portfolio-mcp/src/github/index.ts";
import {
  createGitHubAppCredentialProvider,
  type PortfolioMcpEnvironment,
} from "../../workers/portfolio-mcp/src/index.ts";

const APP_ID = "12345";
const INSTALLATION_ID = "67890";
const APP_PRIVATE_KEY_BINDING = ["GITHUB", "APP", "PRIVATE", "KEY"].join("_");
const START_TIME = Date.UTC(2026, 9, 21, 0, 0, 0);
const HOUR_MS = 60 * 60 * 1_000;

function privateKeyPem(type: "pkcs1" | "pkcs8" = "pkcs8"): string {
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2_048 });
  return privateKey.export({ format: "pem", type }).toString();
}

function withPrivateKey(
  environment: PortfolioMcpEnvironment,
  value: string,
): PortfolioMcpEnvironment {
  return Object.assign(environment, { [APP_PRIVATE_KEY_BINDING]: value });
}

function createEnvironment(keyType: "pkcs1" | "pkcs8" = "pkcs8"): PortfolioMcpEnvironment {
  return withPrivateKey(
    {
      GITHUB_APP_ID: APP_ID,
      GITHUB_INSTALLATION_ID: INSTALLATION_ID,
    },
    privateKeyPem(keyType),
  );
}

function tokenResponse(token: string, expiresAtMs: number): Response {
  return Response.json({ token, expires_at: new Date(expiresAtMs).toISOString() });
}

test("signs a bounded app JWT, caches the installation token, and refreshes it", async () => {
  let currentTime = START_TIME;
  const requests: Request[] = [];
  const provider = createGitHubAppCredentialProvider(createEnvironment("pkcs1"), {
    now: () => currentTime,
    fetchImpl: async (input, init) => {
      const request = new Request(input, init);
      requests.push(request);
      return tokenResponse(`installation-${requests.length}`, currentTime + HOUR_MS);
    },
  });

  assert.equal(await provider.getToken(), "installation-1");
  assert.equal(await provider.getToken(), "installation-1");
  assert.equal(requests.length, 1);

  const first = requests[0];
  assert.ok(first);
  assert.equal(new URL(first.url).pathname, `/app/installations/${INSTALLATION_ID}/access_tokens`);
  assert.equal(first.method, "POST");
  const authorization = first.headers.get("Authorization");
  const jwt = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : "";
  assert.ok(jwt);
  const claims = decodeJwt(jwt);
  assert.equal(claims.iss, APP_ID);
  assert.equal(claims.iat, START_TIME / 1_000 - 60);
  assert.equal(claims.exp, START_TIME / 1_000 + 9 * 60);

  currentTime += 55 * 60 * 1_000;
  assert.equal(await provider.getToken(), "installation-2");
  assert.equal(requests.length, 2);
});

test("deduplicates concurrent installation-token refreshes", async () => {
  let exchanges = 0;
  const provider = createGitHubAppCredentialProvider(createEnvironment(), {
    now: () => START_TIME,
    fetchImpl: async () => {
      exchanges += 1;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return tokenResponse("installation-shared", START_TIME + HOUR_MS);
    },
  });

  const tokens = await Promise.all([provider.getToken(), provider.getToken(), provider.getToken()]);
  assert.deepEqual(tokens, ["installation-shared", "installation-shared", "installation-shared"]);
  assert.equal(exchanges, 1);
});

test("retries one authenticated request after a 401 and invalidates the old token", async () => {
  const requests: Request[] = [];
  let tokenNumber = 0;
  let invalidated = "";
  const transport = createGitHubTransport({
    accessToken: async () => {
      tokenNumber += 1;
      return `installation-${String(tokenNumber)}`;
    },
    invalidateAccessToken: (token) => {
      invalidated = token;
    },
    fetchImpl: async (input, init) => {
      const request = new Request(input, init);
      requests.push(request);
      return request.headers.get("Authorization") === "Bearer installation-1"
        ? new Response("expired", { status: 401 })
        : Response.json({ ok: true });
    },
  });

  const result = await transport.getJson<{ ok: boolean }>("/user", 0);
  assert.deepEqual(result.data, { ok: true });
  assert.equal(requests.length, 2);
  assert.equal(invalidated, "installation-1");
  assert.equal(requests[0]?.headers.get("Authorization"), "Bearer installation-1");
  assert.equal(requests[1]?.headers.get("Authorization"), "Bearer installation-2");
});

test("fails closed for missing credentials, malformed keys, and invalid token responses", async () => {
  const missing = withPrivateKey({ GITHUB_INSTALLATION_ID: INSTALLATION_ID }, privateKeyPem());
  const missingProvider = createGitHubAppCredentialProvider(missing);
  await assert.rejects(missingProvider.getToken(), /App ID is not configured/);

  const malformed = withPrivateKey(createEnvironment(), "not-a-key");
  const malformedProvider = createGitHubAppCredentialProvider(malformed);
  await assert.rejects(malformedProvider.getToken(), /private key is invalid/);

  const expired = createGitHubAppCredentialProvider(createEnvironment(), {
    now: () => START_TIME,
    fetchImpl: async () => tokenResponse("expired-token", START_TIME - 1),
  });
  await assert.rejects(expired.getToken(), /expired token/);

  let externalRequests = 0;
  const transport = createGitHubTransport({
    fetchImpl: async () => {
      externalRequests += 1;
      return Response.json({ unexpected: true });
    },
  });
  await assert.rejects(transport.getJson("/user", 0), /credentials are not configured/);
  assert.equal(externalRequests, 0);
});
