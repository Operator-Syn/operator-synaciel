import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { test } from "node:test";
import { decodeJwt } from "jose";
import {
  createGitHubTransport,
  type GitHubTokenScope,
} from "../../workers/portfolio-mcp/src/github/index.ts";
import {
  createGitHubAppCredentialProvider,
  type PortfolioMcpEnvironment,
} from "../../workers/portfolio-mcp/src/index.ts";

const APP_ID = "12345";
const INSTALLATION_ID = "67890";
const APP_PRIVATE_KEY_BINDING = ["GITHUB", "APP", "PRIVATE", "KEY"].join("_");
const START_TIME = Date.UTC(2026, 9, 21, 0, 0, 0);
const HOUR_MS = 60 * 60 * 1_000;
const DEMO_SCOPE: GitHubTokenScope = { owner: "operator-syn", name: "demo" };
const ARCHIVE_SCOPE: GitHubTokenScope = { owner: "OPERATOR-SYN", name: "archive" };

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
      GITHUB_INSTALLATION_OWNER: "Operator-Syn",
    },
    privateKeyPem(keyType),
  );
}

function tokenResponse(
  token: string,
  expiresAtMs: number,
  scope: GitHubTokenScope = DEMO_SCOPE,
): Response {
  return Response.json({
    token,
    expires_at: new Date(expiresAtMs).toISOString(),
    repositories: [
      {
        name: scope.name,
        full_name: `${scope.owner}/${scope.name}`,
        owner: { login: scope.owner },
      },
    ],
  });
}

function requestedRepository(body: unknown): string {
  if (!body || typeof body !== "object" || !("repositories" in body)) return "";
  const repositories = body.repositories;
  return Array.isArray(repositories) && typeof repositories[0] === "string" ? repositories[0] : "";
}

test("signs a bounded app JWT and requests one repository-scoped installation token", async () => {
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

  assert.equal(await provider.getToken(DEMO_SCOPE), "installation-1");
  assert.equal(await provider.getToken(DEMO_SCOPE), "installation-1");
  assert.equal(requests.length, 1);

  const first = requests[0];
  assert.ok(first);
  assert.equal(new URL(first.url).pathname, `/app/installations/${INSTALLATION_ID}/access_tokens`);
  assert.equal(first.method, "POST");
  assert.equal(first.headers.get("Content-Type"), "application/json");
  assert.deepEqual(await first.json(), {
    repositories: ["demo"],
    permissions: { contents: "read" },
  });
  const authorization = first.headers.get("Authorization");
  const jwt = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : "";
  assert.ok(jwt);
  const claims = decodeJwt(jwt);
  assert.equal(claims.iss, APP_ID);
  assert.equal(claims.iat, START_TIME / 1_000 - 60);
  assert.equal(claims.exp, START_TIME / 1_000 + 9 * 60);

  currentTime += 55 * 60 * 1_000;
  assert.equal(await provider.getToken(DEMO_SCOPE), "installation-2");
  assert.equal(requests.length, 2);
});

test("deduplicates concurrent refreshes independently for each repository", async () => {
  const exchanges: string[] = [];
  const provider = createGitHubAppCredentialProvider(createEnvironment(), {
    now: () => START_TIME,
    fetchImpl: async (input, init) => {
      const request = new Request(input, init);
      const name = requestedRepository(await request.json());
      exchanges.push(name);
      await new Promise((resolve) => setTimeout(resolve, 10));
      return tokenResponse(`installation-${name}`, START_TIME + HOUR_MS, {
        owner: DEMO_SCOPE.owner,
        name,
      });
    },
  });

  const tokens = await Promise.all([
    provider.getToken(DEMO_SCOPE),
    provider.getToken(DEMO_SCOPE),
    provider.getToken(ARCHIVE_SCOPE),
    provider.getToken(ARCHIVE_SCOPE),
  ]);

  assert.deepEqual(tokens, [
    "installation-demo",
    "installation-demo",
    "installation-archive",
    "installation-archive",
  ]);
  assert.deepEqual(exchanges.sort(), ["archive", "demo"]);
});

test("invalidates only the cached token for the repository that failed", async () => {
  const exchanges: string[] = [];
  const provider = createGitHubAppCredentialProvider(createEnvironment(), {
    now: () => START_TIME,
    fetchImpl: async (input, init) => {
      const request = new Request(input, init);
      const name = requestedRepository(await request.json());
      exchanges.push(name);
      return tokenResponse(`installation-${name}-${exchanges.length}`, START_TIME + HOUR_MS, {
        owner: DEMO_SCOPE.owner,
        name,
      });
    },
  });

  const demo = await provider.getToken(DEMO_SCOPE);
  const archive = await provider.getToken(ARCHIVE_SCOPE);
  assert.equal(demo, "installation-demo-1");
  assert.equal(archive, "installation-archive-2");
  assert.equal(await provider.getToken(DEMO_SCOPE), demo);
  assert.equal(await provider.getToken(ARCHIVE_SCOPE), archive);

  provider.invalidate(demo);
  assert.equal(await provider.getToken(DEMO_SCOPE), "installation-demo-3");
  assert.equal(await provider.getToken(ARCHIVE_SCOPE), archive);
  assert.deepEqual(exchanges, ["demo", "archive", "demo"]);
});

test("retries one authenticated request after a 401 with the same repository scope", async () => {
  const requests: Request[] = [];
  const scopes: GitHubTokenScope[] = [];
  let tokenNumber = 0;
  let invalidated = "";
  const transport = createGitHubTransport({
    accessToken: async (scope) => {
      scopes.push(scope);
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

  const result = await transport.getJson<{ ok: boolean }>(
    "/repos/operator-syn/demo",
    0,
    DEMO_SCOPE,
  );
  assert.deepEqual(result.data, { ok: true });
  assert.equal(requests.length, 2);
  assert.equal(invalidated, "installation-1");
  assert.deepEqual(scopes, [DEMO_SCOPE, DEMO_SCOPE]);
  assert.equal(requests[0]?.headers.get("Authorization"), "Bearer installation-1");
  assert.equal(requests[1]?.headers.get("Authorization"), "Bearer installation-2");
});

test("rejects non-installation owners before exchanging a token", async () => {
  let exchanges = 0;
  const provider = createGitHubAppCredentialProvider(createEnvironment(), {
    now: () => START_TIME,
    fetchImpl: async () => {
      exchanges += 1;
      return tokenResponse("installation-demo", START_TIME + HOUR_MS);
    },
  });

  assert.equal(await provider.getToken(DEMO_SCOPE), "installation-demo");
  await assert.rejects(
    provider.getToken({ owner: "another-owner", name: "demo" }),
    /repository is not available/,
  );
  assert.equal(exchanges, 1);
});

test("fails closed for missing credentials, malformed keys, and invalid token responses", async () => {
  const privateKey = privateKeyPem();
  const missingOwner = withPrivateKey(
    { GITHUB_APP_ID: APP_ID, GITHUB_INSTALLATION_ID: INSTALLATION_ID },
    privateKey,
  );
  const missingOwnerProvider = createGitHubAppCredentialProvider(missingOwner);
  await assert.rejects(
    missingOwnerProvider.getToken(DEMO_SCOPE),
    /installation owner is not configured/,
  );

  const missingApp = withPrivateKey(
    { GITHUB_INSTALLATION_ID: INSTALLATION_ID, GITHUB_INSTALLATION_OWNER: "Operator-Syn" },
    privateKey,
  );
  const missingAppProvider = createGitHubAppCredentialProvider(missingApp);
  await assert.rejects(missingAppProvider.getToken(DEMO_SCOPE), /App ID is not configured/);

  const malformed = withPrivateKey(createEnvironment(), "not-a-key");
  const malformedProvider = createGitHubAppCredentialProvider(malformed);
  await assert.rejects(malformedProvider.getToken(DEMO_SCOPE), /private key is invalid/);

  const expired = createGitHubAppCredentialProvider(createEnvironment(), {
    now: () => START_TIME,
    fetchImpl: async () => tokenResponse("expired-token", START_TIME - 1),
  });
  await assert.rejects(expired.getToken(DEMO_SCOPE), /expired token/);

  const differentRepository = createGitHubAppCredentialProvider(createEnvironment(), {
    now: () => START_TIME,
    fetchImpl: async () => tokenResponse("wrong-scope", START_TIME + HOUR_MS, ARCHIVE_SCOPE),
  });
  await assert.rejects(differentRepository.getToken(DEMO_SCOPE), /different repository scope/);

  const multipleRepositories = createGitHubAppCredentialProvider(createEnvironment(), {
    now: () => START_TIME,
    fetchImpl: async () =>
      Response.json({
        token: "multiple-scopes",
        expires_at: new Date(START_TIME + HOUR_MS).toISOString(),
        repositories: [
          { name: "demo", full_name: "operator-syn/demo" },
          { name: "archive", full_name: "operator-syn/archive" },
        ],
      }),
  });
  await assert.rejects(multipleRepositories.getToken(DEMO_SCOPE), /invalid repository scope/);

  let externalRequests = 0;
  const transport = createGitHubTransport({
    fetchImpl: async () => {
      externalRequests += 1;
      return Response.json({ unexpected: true });
    },
  });
  await assert.rejects(
    transport.getJson("/repos/operator-syn/demo", 0, DEMO_SCOPE),
    /credentials are not configured/,
  );
  assert.equal(externalRequests, 0);
});
