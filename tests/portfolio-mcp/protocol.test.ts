import assert from "node:assert/strict";
import { test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import {
  createPortfolioMcpHandler,
  createPortfolioMcpServer,
} from "../../workers/portfolio-mcp/src/index.ts";
import {
  createPortfolioApiClient,
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

function createFakeEnvironment(): PortfolioApiEnvironment {
  return {
    PORTFOLIO_API: {
      async fetch(input, init) {
        assert.equal(new Request(input).method, "GET");
        assert.ok(init?.signal);
        const url = new URL(input instanceof Request ? input.url : input.toString());

        if (url.pathname === "/api/settings") {
          return Response.json({ headerPhrase: "Build with intent", privateKey: "hidden" });
        }
        if (url.pathname === "/api/profile") {
          return Response.json([{ label: "Role", value: "Software developer" }]);
        }
        if (url.pathname === "/api/sections") {
          return Response.json([{ id: 3, title: "About", section_type: "text" }]);
        }
        if (url.pathname === "/api/sections/3/items") {
          return Response.json([
            { label: "Focus", content: "Reliable software", image_url: null, target_url: null },
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
            },
          ]);
        }
        if (url.pathname === "/api/certificates") {
          return Response.json([]);
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
                children: [snippetMetadata],
              },
            ],
          });
        }
        if (url.pathname === "/api/v2/snippets/7") {
          return Response.json({ success: true, data: snippetMetadata });
        }
        if (url.pathname === "/api/v2/snippets/7/content") {
          return new Response("# Agent Notes\n\nGrounded software facts.", {
            headers: { "content-type": "text/markdown" },
          });
        }

        return new Response("Not found", { status: 404 });
      },
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
  assert.equal(overview.sections[0]?.items[0]?.content, "Reliable software");
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
