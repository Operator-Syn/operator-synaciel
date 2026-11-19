import assert from "node:assert/strict";
import { test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import {
  createGitHubClient,
  type GitHubClientOptions,
  parseGitHubRepositoryUrl,
} from "../src/github/index.ts";
import { createPortfolioMcpServer, type PortfolioMcpEnvironment } from "../src/index.ts";

const MAIN_SHA = "a".repeat(40);
const OLD_SHA = "b".repeat(40);
const OTHER_SHA = "c".repeat(40);
const BASE_SHA = "d".repeat(40);
const SOURCE_SHA = "e".repeat(40);
const BINARY_SHA = "f".repeat(40);
const TOKEN = "test-installation-token";
const DEMO_SOURCE = "export const answer = 42;\n";

function encodeBase64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function createProjectEnvironment(projectLink: string): PortfolioMcpEnvironment {
  return {
    PORTFOLIO_API: {
      async fetch(input, init) {
        assert.equal(new Request(input).method, "GET");
        assert.ok(init?.signal);
        const url = new URL(input instanceof Request ? input.url : input.toString());
        if (url.pathname === "/api/project/11") {
          return Response.json({
            id: 11,
            title: "GitHub project",
            type: "image",
            url: "https://example.com/project.png",
            short_description: "A project",
            long_description: "A longer project description",
            project_link: projectLink,
            display_order: 1,
            created_at: "2026-08-27T00:00:00.000Z",
          });
        }
        if (url.pathname === "/api/project/11/gallery") return Response.json([]);
        return new Response("Not found", { status: 404 });
      },
    },
  };
}

function createGitHubFetch() {
  const calls: URL[] = [];
  const readme = "# Demo project\n\nA bounded README for the portfolio MCP.\n";
  const source = DEMO_SOURCE;
  const commits = [
    {
      sha: MAIN_SHA,
      html_url: `https://github.com/operator-syn/demo/commit/${MAIN_SHA}`,
      commit: {
        message: "Current main commit",
        author: { name: "Main Author", date: "2026-08-28T12:00:00Z" },
        committer: { date: "2026-08-28T12:01:00Z" },
      },
      author: { login: "main-author" },
    },
    {
      sha: OLD_SHA,
      html_url: `https://github.com/operator-syn/demo/commit/${OLD_SHA}`,
      commit: {
        message: "Document the project",
        author: { name: "Old Author", date: "2026-08-27T12:00:00Z" },
        committer: { date: "2026-08-27T12:01:00Z" },
      },
      author: { login: "old-author" },
    },
  ];

  const fetchImpl: NonNullable<GitHubClientOptions["fetchImpl"]> = async (input, init) => {
    const request = new Request(input, init);
    assert.equal(request.method, "GET");
    assert.ok(init?.signal);
    const url = new URL(request.url);
    calls.push(url);
    assert.equal(url.origin, "https://api.github.com");
    assert.equal(request.headers.get("User-Agent"), "syn-forge-portfolio-mcp");
    assert.equal(request.headers.get("Authorization"), `Bearer ${TOKEN}`);

    if (url.pathname === "/repos/operator-syn/demo") {
      return Response.json({
        private: false,
        visibility: "public",
        description: "A public demo repository",
        default_branch: "develop",
      });
    }
    if (url.pathname === "/repos/operator-syn/demo/branches/main") {
      return Response.json({ name: "main", commit: { sha: MAIN_SHA } });
    }
    if (url.pathname === "/repos/operator-syn/demo/contents/README.md") {
      assert.equal(url.searchParams.get("ref"), "main");
      return Response.json({
        name: "README.md",
        path: "README.md",
        type: "file",
        encoding: "base64",
        content: encodeBase64(readme),
      });
    }
    if (url.pathname === "/repos/operator-syn/demo/commits") {
      assert.equal(url.searchParams.get("sha"), "main");
      const page = Number(url.searchParams.get("page"));
      const limit = Number(url.searchParams.get("per_page"));
      const pageItems = page === 1 ? commits.slice(0, limit) : commits.slice(limit, limit * 2);
      const headers =
        page === 1 && pageItems.length === limit
          ? {
              Link: '<https://api.github.com/repos/operator-syn/demo/commits?page=2>; rel="next"',
            }
          : undefined;
      return Response.json(pageItems, headers ? { headers } : undefined);
    }
    if (url.pathname === `/repos/operator-syn/demo/compare/${OLD_SHA}...main`) {
      assert.equal(url.searchParams.get("per_page"), "1");
      return Response.json({ merge_base_commit: { sha: OLD_SHA } });
    }
    if (url.pathname === `/repos/operator-syn/demo/compare/${OTHER_SHA}...main`) {
      return Response.json({ merge_base_commit: { sha: BASE_SHA } });
    }
    if (url.pathname === `/repos/operator-syn/demo/git/trees/${MAIN_SHA}`) {
      assert.equal(url.searchParams.get("recursive"), "1");
      return Response.json({
        sha: MAIN_SHA,
        truncated: false,
        tree: [
          { path: "src", mode: "040000", type: "tree", sha: OTHER_SHA },
          { path: ".env", mode: "100644", type: "blob", size: 20, sha: OTHER_SHA },
          { path: "assets/logo.png", mode: "100644", type: "blob", size: 20, sha: BINARY_SHA },
          {
            path: "src/index.ts",
            mode: "100644",
            type: "blob",
            size: source.length,
            sha: SOURCE_SHA,
          },
        ],
      });
    }
    if (url.pathname === `/repos/operator-syn/demo/git/blobs/${SOURCE_SHA}`) {
      return Response.json({
        sha: SOURCE_SHA,
        size: source.length,
        encoding: "base64",
        content: encodeBase64(source),
      });
    }
    if (url.pathname === `/repos/operator-syn/demo/commits/${OLD_SHA}`) {
      return Response.json({
        sha: OLD_SHA,
        commit: {
          message: "Document the project",
          author: { name: "Old Author", date: "2026-08-27T12:00:00Z" },
          committer: { date: "2026-08-27T12:01:00Z" },
        },
        author: { login: "old-author" },
        files: [
          { filename: "README.md", status: "modified", additions: 4, deletions: 1, changes: 5 },
          { filename: "src/index.ts", status: "added", additions: 20, deletions: 0, changes: 20 },
        ],
      });
    }

    return new Response("Not found", { status: 404 });
  };

  return { calls, fetchImpl };
}

function createFakeCache() {
  const responses = new Map<string, Response>();
  const scheduled: Promise<unknown>[] = [];
  return {
    cache: {
      async match(request: RequestInfo | URL) {
        return responses.get(new Request(request).url)?.clone();
      },
      async put(request: RequestInfo | URL, response: Response) {
        responses.set(new Request(request).url, response.clone());
      },
    },
    scheduled,
    responses,
    waitUntil(promise: Promise<unknown>) {
      scheduled.push(promise);
    },
  };
}

function readToolText(result: unknown): string {
  if (
    !result ||
    typeof result !== "object" ||
    !("content" in result) ||
    !Array.isArray(result.content)
  ) {
    throw new Error("MCP result did not contain content.");
  }
  const first = result.content[0];
  if (!first || typeof first !== "object" || !("text" in first) || typeof first.text !== "string") {
    throw new Error("MCP result did not contain text content.");
  }
  return first.text;
}

function readStructuredContent(result: unknown): Record<string, unknown> {
  if (!result || typeof result !== "object" || !("structuredContent" in result)) {
    throw new Error("MCP result did not contain structured content.");
  }
  const value = result.structuredContent;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("MCP structured content was not an object.");
  }
  return value as Record<string, unknown>;
}

async function createClient(projectLink = "https://github.com/Operator-Syn/Demo") {
  const github = createGitHubFetch();
  const server = createPortfolioMcpServer(createProjectEnvironment(projectLink), {
    githubAccessToken: async (scope) => {
      assert.equal(scope.owner, "operator-syn");
      assert.equal(scope.name, "demo");
      return TOKEN;
    },
    githubFetch: github.fetchImpl,
  });
  const client = new Client({ name: "portfolio-mcp-github-test", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return { client, github, server };
}

test("normalizes only strict public GitHub repository links", () => {
  assert.deepEqual(parseGitHubRepositoryUrl("https://github.com/Operator-Syn/Demo/"), {
    owner: "operator-syn",
    name: "demo",
    canonical_url: "https://github.com/operator-syn/demo",
  });

  for (const value of [
    "http://github.com/operator-syn/demo",
    "https://www.github.com/operator-syn/demo",
    "https://github.com/operator-syn",
    "https://github.com/operator-syn/demo/tree/main",
    "https://github.com/operator-syn/demo?tab=readme",
    "https://github.com/operator-syn/demo/issues/1",
    "https://gitlab.com/operator-syn/demo",
  ]) {
    assert.throws(() => parseGitHubRepositoryUrl(value));
  }
});

test("registers and serves bounded GitHub project inspection tools", async () => {
  const { client, github, server } = await createClient();
  const tools = await client.listTools();
  const toolNames = tools.tools.map((tool) => tool.name);
  assert.deepEqual(toolNames.slice(-6), [
    "get_project_repository",
    "get_project_readme",
    "list_project_commits",
    "get_project_commit",
    "list_project_files",
    "get_project_file",
  ]);
  for (const tool of tools.tools) {
    assert.equal(tool.annotations?.readOnlyHint, true);
    assert.ok(tool.outputSchema);
  }

  const repositoryResult = await client.callTool({
    name: "get_project_repository",
    arguments: { project_id: 11 },
  });
  const repository = readStructuredContent(repositoryResult);
  const repositoryMetadata = repository.repository as Record<string, unknown>;
  assert.equal(repositoryMetadata.branch, "main");
  assert.equal(repositoryMetadata.main_available, true);
  assert.equal(repositoryMetadata.main_sha, MAIN_SHA);
  assert.equal(repositoryMetadata.readme_available, true);
  assert.equal(repositoryMetadata.commit_history_available, true);
  assert.equal(repositoryMetadata.description, "A public demo repository");

  const readmeResult = await client.callTool({
    name: "get_project_readme",
    arguments: { project_id: 11, max_chars: 12 },
  });
  const readme = readStructuredContent(readmeResult);
  assert.equal(readme.branch, "main");
  assert.equal(readme.path, "README.md");
  assert.equal(readme.offset, 0);
  assert.equal(readme.next_offset, 12);
  assert.equal(readme.complete, false);
  assert.equal(readme.canonical_url, "https://github.com/operator-syn/demo/blob/main/README.md");

  const commitsResult = await client.callTool({
    name: "list_project_commits",
    arguments: { project_id: 11, limit: 1 },
  });
  const commits = readStructuredContent(commitsResult);
  assert.equal(commits.branch, "main");
  assert.equal((commits.commits as unknown[]).length, 1);
  const firstPagination = commits.pagination as Record<string, unknown>;
  assert.equal(firstPagination.has_more, true);
  assert.equal(firstPagination.next_cursor, "main:2");

  const nextCommitsResult = await client.callTool({
    name: "list_project_commits",
    arguments: { project_id: 11, limit: 1, cursor: firstPagination.next_cursor },
  });
  const nextCommits = readStructuredContent(nextCommitsResult);
  assert.equal((nextCommits.commits as Array<Record<string, unknown>>)[0]?.sha, OLD_SHA);

  const commitResult = await client.callTool({
    name: "get_project_commit",
    arguments: { project_id: 11, sha: OLD_SHA },
  });
  const commit = readStructuredContent(commitResult).commit as Record<string, unknown>;
  assert.equal(commit.sha, OLD_SHA);
  assert.equal(commit.canonical_url, `https://github.com/operator-syn/demo/commit/${OLD_SHA}`);
  assert.equal((commit.files as unknown[]).length, 2);
  assert.equal(commit.files_truncated, false);

  const filesResult = await client.callTool({
    name: "list_project_files",
    arguments: { project_id: 11, path_prefix: "src", limit: 1 },
  });
  const files = readStructuredContent(filesResult);
  assert.equal(files.commit_sha, MAIN_SHA);
  assert.equal(files.total_files, 1);
  assert.deepEqual(files.files, [
    { path: "src/index.ts", size: DEMO_SOURCE.length, blob_sha: SOURCE_SHA },
  ]);
  assert.deepEqual(files.pagination, { limit: 1, has_more: false, next_cursor: null });

  const fileResult = await client.callTool({
    name: "get_project_file",
    arguments: { project_id: 11, path: "src/index.ts", max_chars: 12 },
  });
  const file = readStructuredContent(fileResult);
  assert.equal(file.content_available, true);
  assert.equal(file.content, DEMO_SOURCE.slice(0, 12));
  assert.equal(file.next_offset, 12);
  assert.equal(file.complete, false);
  assert.equal(file.blob_sha, SOURCE_SHA);
  assert.equal(
    file.canonical_url,
    `https://github.com/operator-syn/demo/blob/${MAIN_SHA}/src/index.ts`,
  );

  const binaryResult = await client.callTool({
    name: "get_project_file",
    arguments: { project_id: 11, path: "assets/logo.png" },
  });
  const binary = readStructuredContent(binaryResult);
  assert.equal(binary.content_available, false);
  assert.equal(binary.reason, "binary");
  assert.equal("content" in binary, false);

  const requestUrls = github.calls.map((url) => url.toString());
  assert.ok(requestUrls.some((url) => url.includes("/branches/main")));
  assert.ok(requestUrls.some((url) => url.includes("/contents/README.md?ref=main")));
  assert.ok(requestUrls.some((url) => url.includes("sha=main")));
  assert.ok(requestUrls.some((url) => url.includes(`/compare/${OLD_SHA}...main`)));
  assert.equal(
    requestUrls.some((url) => url.includes("develop")),
    false,
  );

  await client.close();
  await server.close();
});

test("caches immutable commit details while keeping GitHub requests read-only", async () => {
  const github = createGitHubFetch();
  const cache = createFakeCache();
  const client = createGitHubClient({
    accessToken: async (scope) => {
      assert.equal(scope.owner, "operator-syn");
      assert.equal(scope.name, "demo");
      return TOKEN;
    },
    cache: cache.cache,
    fetchImpl: github.fetchImpl,
    waitUntil: cache.waitUntil,
  });
  const ref = parseGitHubRepositoryUrl("https://github.com/operator-syn/demo");

  await client.getCommit(ref, OLD_SHA);
  await Promise.all(cache.scheduled);
  await client.getCommit(ref, OLD_SHA);

  assert.equal(
    github.calls.filter((url) => url.pathname.endsWith(`/compare/${OLD_SHA}...main`)).length,
    1,
  );
  assert.equal(
    github.calls.filter((url) => url.pathname.endsWith(`/commits/${OLD_SHA}`)).length,
    1,
  );
  const commitCache = [...cache.responses.values()].find((response) =>
    response.headers.get("Cache-Control")?.includes("s-maxage=86400"),
  );
  assert.ok(commitCache);
});

test("reports missing main without falling back to the repository default branch", async () => {
  const calls: URL[] = [];
  const client = createGitHubClient({
    accessToken: async (scope) => {
      assert.equal(scope.owner, "operator-syn");
      assert.equal(scope.name, "demo");
      return TOKEN;
    },
    fetchImpl: async (input, init) => {
      const request = new Request(input, init);
      const url = new URL(request.url);
      calls.push(url);
      assert.equal(request.method, "GET");
      assert.equal(request.headers.get("User-Agent"), "syn-forge-portfolio-mcp");

      if (url.pathname === "/repos/operator-syn/demo") {
        return Response.json({ private: false, visibility: "public", default_branch: "develop" });
      }
      if (url.pathname === "/repos/operator-syn/demo/branches/main") {
        return new Response("Not found", { status: 404 });
      }
      return new Response("Unexpected GitHub request", { status: 500 });
    },
  });
  const ref = parseGitHubRepositoryUrl("https://github.com/operator-syn/demo");

  const repository = await client.getRepository(ref);

  assert.equal(repository.main_available, false);
  assert.equal(repository.main_sha, null);
  assert.equal(repository.readme_available, false);
  assert.equal(repository.commit_history_available, false);
  assert.equal(calls.length, 2);
  assert.equal(
    calls.some((url) => url.toString().includes("develop")),
    false,
  );
});

test("reports a redirected non-main branch as unavailable", async () => {
  const calls: URL[] = [];
  const client = createGitHubClient({
    accessToken: async (scope) => {
      assert.equal(scope.owner, "operator-syn");
      assert.equal(scope.name, "demo");
      return TOKEN;
    },
    fetchImpl: async (input, init) => {
      const request = new Request(input, init);
      const url = new URL(request.url);
      calls.push(url);
      if (url.pathname === "/repos/operator-syn/demo") {
        return Response.json({ private: false, visibility: "public" });
      }
      if (url.pathname === "/repos/operator-syn/demo/branches/main") {
        return Response.json({ name: "root", commit: { sha: MAIN_SHA } });
      }
      return new Response("Unexpected GitHub request", { status: 500 });
    },
  });
  const ref = parseGitHubRepositoryUrl("https://github.com/operator-syn/demo");

  const repository = await client.getRepository(ref);

  assert.equal(repository.main_available, false);
  assert.equal(repository.main_sha, null);
  assert.equal(repository.readme_available, false);
  assert.equal(repository.commit_history_available, false);
  assert.equal(calls.length, 2);
});

test("rejects private repositories on every GitHub client path", async () => {
  const calls: URL[] = [];
  const client = createGitHubClient({
    accessToken: async (scope) => {
      assert.equal(scope.owner, "operator-syn");
      assert.equal(scope.name, "private-demo");
      return TOKEN;
    },
    fetchImpl: async (input, init) => {
      const request = new Request(input, init);
      assert.equal(request.headers.get("Authorization"), `Bearer ${TOKEN}`);
      const url = new URL(request.url);
      calls.push(url);
      if (url.pathname === "/repos/operator-syn/private-demo") {
        return Response.json({ private: true, visibility: "private", description: "Private" });
      }
      return new Response("Unexpected GitHub request", { status: 500 });
    },
  });
  const ref = parseGitHubRepositoryUrl("https://github.com/operator-syn/private-demo");
  const unavailable = [
    () => client.getRepository(ref),
    () => client.getReadme(ref),
    () => client.listCommits(ref, 1, 1),
    () => client.getCommit(ref, OLD_SHA),
    () => client.listFiles(ref, undefined, 0, 10),
    () => client.getFile(ref, "src/index.ts"),
  ];

  for (const operation of unavailable) {
    await assert.rejects(operation, /not public/);
  }
  assert.equal(calls.length, unavailable.length);
  assert.equal(
    calls.every((url) => url.pathname === "/repos/operator-syn/private-demo"),
    true,
  );
});

test("rejects unsupported links, non-main cursors, invalid SHAs, and branch-exclusive commits", async () => {
  const unsupported = await createClient("https://gitlab.com/operator-syn/demo");
  const unsupportedResult = await unsupported.client.callTool({
    name: "get_project_repository",
    arguments: { project_id: 11 },
  });
  assert.equal(unsupportedResult.isError, true);
  assert.deepEqual(JSON.parse(readToolText(unsupportedResult)), {
    code: "INVALID_INPUT",
    message: "The portfolio request was invalid.",
  });
  await unsupported.client.close();
  await unsupported.server.close();

  const { client, github, server } = await createClient();
  const badCursor = await client.callTool({
    name: "list_project_commits",
    arguments: { project_id: 11, cursor: "develop:2" },
  });
  assert.equal(badCursor.isError, true);
  assert.deepEqual(JSON.parse(readToolText(badCursor)), {
    code: "INVALID_INPUT",
    message: "The portfolio request was invalid.",
  });

  const badSha = await client.callTool({
    name: "get_project_commit",
    arguments: { project_id: 11, sha: "abc123" },
  });
  assert.equal(badSha.isError, true);
  assert.match(readToolText(badSha), /Input validation error/);

  const exclusive = await client.callTool({
    name: "get_project_commit",
    arguments: { project_id: 11, sha: OTHER_SHA },
  });
  assert.equal(exclusive.isError, true);
  assert.deepEqual(JSON.parse(readToolText(exclusive)), {
    code: "NOT_FOUND",
    message: "The requested portfolio item was not found.",
  });
  assert.equal(
    github.calls.some((url) => url.pathname.endsWith(`/commits/${OTHER_SHA}`)),
    false,
  );

  const extraPath = await client.callTool({
    name: "get_project_readme",
    arguments: { project_id: 11, path: "src/index.ts" },
  });
  assert.equal(extraPath.isError, true);
  assert.match(readToolText(extraPath), /Input validation error/);

  await client.close();
  await server.close();
});
