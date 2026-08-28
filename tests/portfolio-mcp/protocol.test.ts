import assert from "node:assert/strict";
import { test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import {
  createPortfolioMcpHandler,
  createPortfolioMcpServer,
  MAX_SNIPPET_OFFSET,
  PORTFOLIO_MCP_CACHE_TTL_SECONDS,
} from "../../workers/portfolio-mcp/src/index.ts";
import {
  createPortfolioApiClient,
  createPortfolioApiTransport,
  flattenSnippetTree,
  getSnippetPageUrl,
  type PortfolioApiEnvironment,
  slugifySnippetName,
} from "../../workers/portfolio-mcp/src/portfolioApi.ts";

const snippetMetadata = {
  id: 7,
  name: "Agent Notes.md",
  type: "file" as const,
  modified: "2026-08-27T00:00:00.000Z",
  size: 42,
  format: "md" as const,
  path_segments: ["guides", "Agent Notes.md"],
};

const pdfSnippetMetadata = {
  id: 8,
  name: "Resume.pdf",
  type: "file" as const,
  modified: "2026-08-27T00:00:00.000Z",
  size: 420,
  format: "pdf" as const,
  path_segments: ["documents", "Resume.pdf"],
};

function createFakeEnvironment(): PortfolioApiEnvironment {
  return {
    PORTFOLIO_API: {
      async fetch(input, init) {
        assert.equal(new Request(input).method, "GET");
        assert.ok(init?.signal);
        const url = new URL(input instanceof Request ? input.url : input.toString());

        if (url.pathname === "/api/settings") {
          return Response.json({
            headerPhrase: "Build with intent",
            internal_setting: "hidden",
          });
        }
        if (url.pathname === "/api/profile") {
          return Response.json([
            { id: 99, label: "Role", value: "Software developer", display_order: 1 },
          ]);
        }
        if (url.pathname === "/api/sections") {
          return Response.json([
            {
              id: 3,
              title: "About",
              section_type: "text",
              display_order: 99,
              internal_note: "hidden",
            },
          ]);
        }
        if (url.pathname === "/api/sections/3/items") {
          return Response.json([
            {
              id: 44,
              section_id: 3,
              label: "Focus",
              content: "Reliable software",
              image_url: null,
              target_url: null,
              display_order: 2,
              internal_note: "hidden",
            },
          ]);
        }
        if (url.pathname === "/api/projects") {
          return Response.json([
            {
              id: 11,
              title: "Portfolio",
              type: "image",
              url: "https://example.com/portfolio.png",
              short_description: "A software portfolio",
              long_description: "A longer software portfolio description",
              project_link: "https://github.com/Operator-Syn",
              display_order: 1,
              created_at: "2026-08-27T00:00:00.000Z",
              internal_note: "hidden",
            },
          ]);
        }
        if (url.pathname === "/api/v2/projects/archive") {
          return Response.json({
            data: [
              {
                id: 11,
                title: "Portfolio",
                type: "image",
                url: "https://example.com/portfolio.png",
                short_description: "A software portfolio",
                long_description: "A longer software portfolio description",
                project_link: "https://github.com/Operator-Syn",
                display_order: 1,
                created_at: "2026-08-27T00:00:00.000Z",
                internal_note: "hidden",
              },
            ],
            pagination: {
              limit: Number(url.searchParams.get("limit") ?? 6),
              total: 1,
              has_more: false,
              next_cursor: null,
            },
          });
        }
        if (url.pathname === "/api/project/11") {
          return Response.json({
            id: 11,
            title: "Portfolio",
            type: "image",
            url: "https://example.com/portfolio.png",
            short_description: "A software portfolio",
            long_description: "A longer software portfolio description",
            project_link: "https://github.com/Operator-Syn",
            display_order: 1,
            created_at: "2026-08-27T00:00:00.000Z",
            internal_note: "hidden",
          });
        }
        if (url.pathname === "/api/project/11/gallery") {
          return Response.json([
            {
              id: 12,
              project_id: 11,
              type: "image",
              url: "https://example.com/gallery.png",
              display_order: 1,
              internal_note: "hidden",
            },
          ]);
        }
        if (url.pathname === "/api/certificates") {
          return Response.json([
            {
              id: 13,
              title: "Software Certificate",
              type: "image",
              url: "https://example.com/certificate.png",
              short_description: "A software credential",
              long_description: "A longer software credential description",
              certificate_link: null,
              display_order: 1,
              created_at: "2026-08-27T00:00:00.000Z",
              internal_note: "hidden",
            },
          ]);
        }
        if (url.pathname === "/api/v2/certificates/archive") {
          return Response.json({
            data: [
              {
                id: 13,
                title: "Software Certificate",
                type: "image",
                url: "https://example.com/certificate.png",
                short_description: "A software credential",
                long_description: "A longer software credential description",
                certificate_link: null,
                display_order: 1,
                created_at: "2026-08-27T00:00:00.000Z",
                internal_note: "hidden",
              },
            ],
            pagination: {
              limit: Number(url.searchParams.get("limit") ?? 6),
              total: 1,
              has_more: false,
              next_cursor: null,
            },
          });
        }
        if (url.pathname === "/api/certificates/13") {
          return Response.json({
            id: 13,
            title: "Software Certificate",
            type: "image",
            url: "https://example.com/certificate.png",
            short_description: "A software credential",
            long_description: "A longer software credential description",
            certificate_link: null,
            display_order: 1,
            created_at: "2026-08-27T00:00:00.000Z",
            internal_note: "hidden",
          });
        }
        if (url.pathname === "/api/certificates/13/items") {
          return Response.json([
            {
              id: 14,
              certificate_id: 13,
              type: "image",
              url: "https://example.com/certificate-gallery.png",
              display_order: 1,
              internal_note: "hidden",
            },
          ]);
        }
        if (url.pathname === "/api/snippets") {
          return Response.json({
            success: true,
            data: [
              {
                id: 1,
                name: "guides",
                type: "dir",
                modified: "2026-08-27T00:00:00.000Z",
                path: "snippets/guides",
                display_order: 1,
                children: [
                  {
                    ...snippetMetadata,
                    path: "snippets/guides/Agent Notes.md",
                    display_order: 1,
                    internal_note: "hidden",
                  },
                ],
              },
            ],
          });
        }
        if (url.pathname === "/api/v2/snippets/7") {
          return Response.json({
            success: true,
            data: { ...snippetMetadata, storage_path: "snippets/guides/Agent Notes.md" },
          });
        }
        if (url.pathname === "/api/v2/snippets/7/content") {
          return new Response("# Agent Notes\n\nGrounded software facts.", {
            headers: { "content-type": "text/markdown" },
          });
        }
        if (url.pathname === "/api/v2/snippets/8") {
          return Response.json({
            success: true,
            data: { ...pdfSnippetMetadata, storage_path: "snippets/documents/Resume.pdf" },
          });
        }

        return new Response("Not found", { status: 404 });
      },
    },
  };
}

function createFakeCache() {
  const responses = new Map<string, Response>();
  const keys: Request[] = [];
  const scheduled: Promise<unknown>[] = [];

  return {
    cache: {
      async match(request: RequestInfo | URL) {
        const cacheKey = new Request(request);
        return responses.get(cacheKey.url)?.clone();
      },
      async put(request: RequestInfo | URL, response: Response) {
        const cacheKey = new Request(request);
        keys.push(cacheKey);
        responses.set(cacheKey.url, response.clone());
      },
    },
    keys,
    responses,
    scheduled,
    waitUntil(promise: Promise<unknown>) {
      scheduled.push(promise);
    },
  };
}

function readToolText(result: unknown) {
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

  const structuredContent = result.structuredContent;
  if (
    !structuredContent ||
    typeof structuredContent !== "object" ||
    Array.isArray(structuredContent)
  ) {
    throw new Error("MCP structured content was not an object.");
  }

  return structuredContent as Record<string, unknown>;
}

test("keeps snippet links stable and flattens only files", () => {
  assert.equal(slugifySnippetName("Agent Notes.md"), "agent-notes.md");
  assert.equal(
    getSnippetPageUrl({ id: 7, name: "Agent Notes.md" }),
    "https://syn-forge.com/snippets/document/7/agent-notes.md/",
  );
  assert.deepEqual(
    flattenSnippetTree([
      { id: 1, name: "guides", type: "dir", modified: "now", children: [snippetMetadata] },
    ]).map((file) => file.id),
    [7],
  );
});

test("uses the public API binding and keeps overview fields allowlisted", async () => {
  const overview = await createPortfolioApiClient(createFakeEnvironment()).getOverview();

  assert.deepEqual(overview.site, { headerPhrase: "Build with intent" });
  assert.deepEqual(overview.profile, [{ label: "Role", value: "Software developer" }]);
  assert.deepEqual(overview.sections, [
    {
      id: 3,
      title: "About",
      section_type: "text",
      items: [
        {
          label: "Focus",
          content: "Reliable software",
          image_url: null,
          target_url: null,
        },
      ],
    },
  ]);
});

test("caches successful portfolio API reads by origin, path, and query", async () => {
  const cache = createFakeCache();
  let upstreamRequests = 0;
  const environment: PortfolioApiEnvironment = {
    PORTFOLIO_API: {
      async fetch(input) {
        upstreamRequests += 1;
        const url = new URL(input instanceof Request ? input.url : input.toString());
        return new Response(JSON.stringify({ query: url.search }), {
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
            "content-type": "application/json",
            Expires: "0",
            Pragma: "no-cache",
          },
        });
      },
    },
  };
  const transport = createPortfolioApiTransport(environment, {
    cache: cache.cache,
    waitUntil: cache.waitUntil,
  });

  const first = await transport.getJson<{ query: string }>("/api/v2/projects/archive?limit=6");
  const second = await transport.getJson<{ query: string }>("/api/v2/projects/archive?limit=12");
  await Promise.all(cache.scheduled);
  const firstCached = await transport.getJson<{ query: string }>(
    "/api/v2/projects/archive?limit=6",
  );
  const secondCached = await transport.getJson<{ query: string }>(
    "/api/v2/projects/archive?limit=12",
  );

  assert.deepEqual(first, { query: "?limit=6" });
  assert.deepEqual(second, { query: "?limit=12" });
  assert.deepEqual(firstCached, first);
  assert.deepEqual(secondCached, second);
  assert.equal(upstreamRequests, 2);
  assert.equal(cache.keys.length, 2);

  const firstCacheKey = new URL(cache.keys[0]?.url);
  assert.equal(firstCacheKey.origin, "https://mcp.syn-forge.com");
  assert.equal(firstCacheKey.pathname, "/__portfolio-mcp-api-cache");
  assert.equal(
    firstCacheKey.searchParams.get("origin"),
    "https://personal-portfolio.syn-forge.com",
  );
  assert.equal(firstCacheKey.searchParams.get("path"), "/api/v2/projects/archive");
  assert.equal(firstCacheKey.searchParams.get("query"), "?limit=6");

  const cachedResponse = cache.responses.get(cache.keys[0]?.url ?? "");
  assert.equal(
    cachedResponse?.headers.get("Cache-Control"),
    `public, max-age=0, s-maxage=${PORTFOLIO_MCP_CACHE_TTL_SECONDS}`,
  );
  assert.equal(cachedResponse?.headers.has("Pragma"), false);
  assert.equal(cachedResponse?.headers.has("Expires"), false);
});

test("treats synchronous and asynchronous Cache API failures as cache misses", async () => {
  let upstreamRequests = 0;
  const scheduled: Promise<unknown>[] = [];
  const transport = createPortfolioApiTransport(
    {
      PORTFOLIO_API: {
        async fetch() {
          upstreamRequests += 1;
          return Response.json({ cached: false });
        },
      },
    },
    {
      cache: {
        async match() {
          throw new Error("cache read failed");
        },
        put() {
          throw new Error("cache write failed");
        },
      },
      waitUntil(promise) {
        scheduled.push(promise);
      },
    },
  );

  assert.deepEqual(await transport.getJson("/api/projects"), { cached: false });
  await Promise.all(scheduled);
  assert.equal(upstreamRequests, 1);
});

test("does not cache failed or invalid portfolio API responses", async () => {
  let failedRequests = 0;
  const failureTransport = createPortfolioApiTransport({
    PORTFOLIO_API: {
      async fetch() {
        failedRequests += 1;
        return new Response("unavailable", { status: 503 });
      },
    },
  });
  await assert.rejects(failureTransport.getJson("/api/projects"));
  await assert.rejects(failureTransport.getJson("/api/projects"));
  assert.equal(failedRequests, 2);

  const cache = createFakeCache();
  let invalidRequests = 0;
  const invalidTransport = createPortfolioApiTransport(
    {
      PORTFOLIO_API: {
        async fetch() {
          invalidRequests += 1;
          return new Response("not json", { headers: { "content-type": "application/json" } });
        },
      },
    },
    { cache: cache.cache, waitUntil: cache.waitUntil },
  );
  await assert.rejects(invalidTransport.getJson("/api/projects"));
  await assert.rejects(invalidTransport.getJson("/api/projects"));
  await Promise.all(cache.scheduled);
  assert.equal(invalidRequests, 2);
  assert.equal(cache.keys.length, 0);
});

test("advertises strict output schemas and returns structured public results", async () => {
  const server = createPortfolioMcpServer(createFakeEnvironment());
  const client = new Client({ name: "portfolio-mcp-schema-test", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  const tools = await client.listTools();
  assert.equal(tools.tools.length, 8);
  for (const tool of tools.tools) {
    assert.ok(tool.outputSchema, "Every public tool should advertise an output schema.");
    assert.equal(tool.annotations?.readOnlyHint, true);
  }

  const results = [
    await client.callTool({ name: "get_portfolio_overview", arguments: {} }),
    await client.callTool({ name: "search_portfolio", arguments: { query: "software" } }),
    await client.callTool({ name: "list_projects", arguments: { limit: 1 } }),
    await client.callTool({ name: "get_project", arguments: { id: 11 } }),
    await client.callTool({ name: "list_certificates", arguments: { limit: 1 } }),
    await client.callTool({ name: "get_certificate", arguments: { id: 13 } }),
    await client.callTool({ name: "list_snippets", arguments: {} }),
    await client.callTool({ name: "read_snippet", arguments: { id: 7, max_chars: 32 } }),
    await client.callTool({ name: "read_snippet", arguments: { id: 8 } }),
  ];

  for (const result of results) {
    assert.equal(result.isError, undefined);
    assert.deepEqual(readStructuredContent(result), JSON.parse(readToolText(result)));
  }

  const overview = readStructuredContent(results[0]);
  assert.deepEqual(overview.profile, [{ label: "Role", value: "Software developer" }]);
  assert.deepEqual((overview.sections as Array<Record<string, unknown>>)[0]?.items, [
    {
      label: "Focus",
      content: "Reliable software",
      image_url: null,
      target_url: null,
    },
  ]);

  const search = readStructuredContent(results[1]);
  assert.ok(Array.isArray(search.results));
  assert.equal(
    (search.results as Array<Record<string, unknown>>).some((result) => "score" in result),
    false,
  );

  const project = readStructuredContent(results[3]);
  assert.equal("internal_note" in (project.project as Record<string, unknown>), false);
  assert.equal(
    "internal_note" in ((project.gallery as Array<Record<string, unknown>>)[0] ?? {}),
    false,
  );

  const snippets = readStructuredContent(results[6]);
  assert.equal("path" in ((snippets.snippets as Array<Record<string, unknown>>)[0] ?? {}), false);

  const markdown = readStructuredContent(results[7]);
  assert.equal(markdown.format, "md");
  assert.equal("storage_path" in markdown, false);
  assert.equal(markdown.complete, false);
  assert.equal(markdown.next_offset, 32);

  const pdf = readStructuredContent(results[8]);
  assert.equal(pdf.format, "pdf");
  assert.equal(pdf.content_available, false);
  assert.equal("content" in pdf, false);

  await client.close();
  await server.close();
});

test("returns bounded validation errors and sanitized data errors", async () => {
  const server = createPortfolioMcpServer(createFakeEnvironment());
  const client = new Client({ name: "portfolio-mcp-validation-test", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  const invalid = await client.callTool({
    name: "read_snippet",
    arguments: { id: 7, offset: MAX_SNIPPET_OFFSET + 1 },
  });
  assert.equal(invalid.isError, true);
  assert.match(readToolText(invalid), /Input validation error/);

  await client.close();
  await server.close();

  const failingServer = createPortfolioMcpServer({
    PORTFOLIO_API: {
      async fetch() {
        return new Response("not found", { status: 404 });
      },
    },
  });
  const failingClient = new Client({ name: "portfolio-mcp-error-test", version: "1.0.0" });
  const [failingClientTransport, failingServerTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([
    failingServer.connect(failingServerTransport),
    failingClient.connect(failingClientTransport),
  ]);

  const missing = await failingClient.callTool({
    name: "get_project",
    arguments: { id: 99 },
  });
  assert.equal(missing.isError, true);
  assert.deepEqual(JSON.parse(readToolText(missing)), {
    code: "NOT_FOUND",
    message: "The requested portfolio item was not found.",
  });

  await failingClient.close();
  await failingServer.close();
});

test("exposes the read-only portfolio contract through MCP tools and resources", async () => {
  const server = createPortfolioMcpServer(createFakeEnvironment());
  const client = new Client({ name: "portfolio-mcp-test", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  const tools = await client.listTools();
  const resources = await client.listResources();
  const overview = await client.callTool({ name: "get_portfolio_overview", arguments: {} });
  const snippet = await client.callTool({ name: "read_snippet", arguments: { id: 7 } });

  assert.deepEqual(
    tools.tools.map((tool) => tool.name),
    [
      "get_portfolio_overview",
      "search_portfolio",
      "list_projects",
      "get_project",
      "list_certificates",
      "get_certificate",
      "list_snippets",
      "read_snippet",
    ],
  );
  assert.deepEqual(
    resources.resources.map((resource) => resource.uri),
    [
      "portfolio://overview",
      "portfolio://projects",
      "portfolio://certificates",
      "portfolio://snippets",
    ],
  );
  assert.equal(JSON.parse(readToolText(overview)).site.headerPhrase, "Build with intent");
  assert.equal(JSON.parse(readToolText(snippet)).complete, true);

  await client.close();
  await server.close();
});

test("rejects an untrusted browser origin at the HTTP boundary", async () => {
  const handler = createPortfolioMcpHandler(createFakeEnvironment());
  const response = await handler(
    new Request("https://mcp.syn-forge.com/mcp", {
      method: "POST",
      headers: {
        Origin: "https://untrusted.example",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }),
    }),
    createFakeEnvironment(),
    { waitUntil() {}, passThroughOnException() {} },
  );

  assert.equal(response.status, 403);
});
