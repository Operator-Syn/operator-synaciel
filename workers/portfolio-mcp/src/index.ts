import type { ExportedHandler } from "@cloudflare/workers-types";
import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";
import { z } from "zod";
import {
  createPortfolioApiClient,
  flattenSnippetTree,
  getSnippetDownloadUrl,
  getSnippetPageUrl,
  type PortfolioApiClient,
  type PortfolioApiEnvironment,
  type SnippetNode,
} from "./portfolioApi";

export const PORTFOLIO_MCP_SERVER_NAME = "syn-forge-portfolio";
export const PORTFOLIO_MCP_SERVER_VERSION = "1.0.0";
export const PORTFOLIO_MCP_ENDPOINT = "https://mcp.syn-forge.com/mcp";

const MAX_LIST_LIMIT = 12;
const MAX_SEARCH_RESULTS = 20;
const MAX_SNIPPET_CHUNK_CHARACTERS = 32_000;

export type PortfolioMcpEnvironment = PortfolioApiEnvironment;
type WorkerFetchHandler = NonNullable<ExportedHandler<PortfolioMcpEnvironment>["fetch"]>;
type WorkerRequest = Parameters<WorkerFetchHandler>[0];
type WorkerEnvironment = Parameters<WorkerFetchHandler>[1];
type WorkerContext = Parameters<WorkerFetchHandler>[2];

const jsonResult = (value: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
});

const errorResult = (error: unknown) => ({
  isError: true,
  content: [
    {
      type: "text" as const,
      text: JSON.stringify({
        error: error instanceof Error ? error.message : "Portfolio data is unavailable.",
      }),
    },
  ],
});

function pageUrlFor(kind: "project" | "certificate") {
  return `https://syn-forge.com/${kind === "project" ? "projects" : "certificates"}`;
}

function safeLimit(value: number | undefined, fallback: number, maximum: number) {
  return Math.min(Math.max(Math.floor(value ?? fallback), 1), maximum);
}

function safeId(value: number) {
  return Math.floor(value);
}

function searchTerms(query: string) {
  return query
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean);
}

function matchesSearch(fields: string[], terms: string[]) {
  const haystack = fields.join(" ").toLowerCase();
  const matched = terms.filter((term) => haystack.includes(term));
  return matched.length === terms.length ? terms.length + 1 : matched.length;
}

function flattenPublicSnippets(nodes: SnippetNode[]) {
  return flattenSnippetTree(nodes).map((snippet) => ({
    id: snippet.id,
    name: snippet.name,
    format: snippet.format ?? null,
    modified: snippet.modified,
    size: snippet.size ?? 0,
    path_segments: snippet.path_segments,
    page_url: getSnippetPageUrl({ id: snippet.id, name: snippet.name }),
    download_url: getSnippetDownloadUrl(snippet.id),
  }));
}

async function buildSearchResults(api: PortfolioApiClient, query: string, limit: number) {
  const terms = searchTerms(query);
  const [overview, projects, certificates, snippetTree] = await Promise.all([
    api.getOverview(),
    api.getAllProjects(),
    api.getAllCertificates(),
    api.getSnippetTree(),
  ]);
  const results: Array<Record<string, unknown> & { score: number }> = [];

  const profileScore = matchesSearch(
    [
      ...overview.profile.flatMap((item) => [item.label, item.value]),
      ...overview.sections.flatMap((section) => [section.title, ...section.items.flatMap((item) => [item.label ?? "", item.content ?? ""])]),
    ],
    terms,
  );
  if (profileScore > 0) {
    results.push({
      kind: "profile",
      title: "Syn-Forge portfolio overview",
      summary: "Identity, capabilities, home content, and public links from the portfolio.",
      url: "https://syn-forge.com/",
      score: profileScore,
    });
  }

  for (const project of projects) {
    const score = matchesSearch([project.title, project.short_description, project.long_description], terms);
    if (score > 0) {
      results.push({
        kind: "project",
        id: project.id,
        title: project.title,
        summary: project.short_description,
        url: pageUrlFor("project"),
        project_link: project.project_link,
        score,
      });
    }
  }

  for (const certificate of certificates) {
    const score = matchesSearch([certificate.title, certificate.short_description, certificate.long_description], terms);
    if (score > 0) {
      results.push({
        kind: "certificate",
        id: certificate.id,
        title: certificate.title,
        summary: certificate.short_description,
        url: pageUrlFor("certificate"),
        certificate_link: certificate.certificate_link,
        score,
      });
    }
  }

  for (const snippet of flattenPublicSnippets(snippetTree)) {
    const score = matchesSearch([snippet.name, snippet.path_segments.join(" "), snippet.format ?? ""], terms);
    if (score > 0) {
      results.push({ kind: "snippet", title: snippet.name, summary: snippet.path_segments.join(" / "), ...snippet, score });
    }
  }

  return results
    .sort((left, right) => right.score - left.score || String(left.title).localeCompare(String(right.title)))
    .slice(0, limit)
    .map((result) => {
      const { score, ...entry } = result;
      void score;
      return entry;
    });
}

export function createPortfolioMcpServer(environment: PortfolioMcpEnvironment) {
  const api = createPortfolioApiClient(environment);
  const server = new McpServer(
    {
      name: PORTFOLIO_MCP_SERVER_NAME,
      version: PORTFOLIO_MCP_SERVER_VERSION,
    },
    {
      instructions:
        "This is the public, read-only Syn-Forge portfolio source for John-Ronan Beira. Prefer structured tools and resources, cite canonical portfolio URLs, distinguish portfolio evidence from inference, and never invent employers, clients, metrics, or skills.",
    },
  );

  const overviewResource = async (uri: URL) => ({
    contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(await api.getOverview()) }],
  });
  server.registerResource(
    "portfolio-overview",
    "portfolio://overview",
    { title: "Syn-Forge portfolio overview", description: "Public identity, capabilities, home content, and links.", mimeType: "application/json" },
    overviewResource,
  );
  server.registerResource(
    "portfolio-projects",
    "portfolio://projects",
    { title: "Syn-Forge projects", description: "Public project records and links.", mimeType: "application/json" },
    async (uri) => ({ contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(await api.getAllProjects()) }] }),
  );
  server.registerResource(
    "portfolio-certificates",
    "portfolio://certificates",
    { title: "Syn-Forge certificates", description: "Public certificate and training records.", mimeType: "application/json" },
    async (uri) => ({ contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(await api.getAllCertificates()) }] }),
  );
  server.registerResource(
    "portfolio-snippets",
    "portfolio://snippets",
    { title: "Syn-Forge snippets", description: "Public snippet metadata and canonical document links.", mimeType: "application/json" },
    async (uri) => ({ contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(flattenPublicSnippets(await api.getSnippetTree())) }] }),
  );

  server.registerTool(
    "get_portfolio_overview",
    {
      title: "Get portfolio overview",
      description: "Return John-Ronan Beira's public identity, capabilities, home content, and portfolio links.",
      inputSchema: z.object({}),
    },
    async () => {
      try {
        return jsonResult(await api.getOverview());
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "search_portfolio",
    {
      title: "Search portfolio",
      description: "Search public profile, project, certificate, and snippet metadata using a bounded natural-language query.",
      inputSchema: z.object({
        query: z.string().trim().min(1).max(200).describe("Terms to find in public portfolio content."),
        limit: z.number().int().min(1).max(MAX_SEARCH_RESULTS).optional().describe("Maximum number of matches to return."),
      }),
    },
    async ({ query, limit }) => {
      try {
        return jsonResult({ query, results: await buildSearchResults(api, query, safeLimit(limit, 10, MAX_SEARCH_RESULTS)) });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "list_projects",
    {
      title: "List projects",
      description: "List public portfolio projects with cursor pagination and canonical project links.",
      inputSchema: z.object({
        limit: z.number().int().min(1).max(MAX_LIST_LIMIT).optional(),
        cursor: z.string().trim().max(512).optional(),
      }),
    },
    async ({ limit, cursor }) => {
      try {
        return jsonResult(await api.listProjects(safeLimit(limit, 6, MAX_LIST_LIMIT), cursor));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "get_project",
    {
      title: "Get project",
      description: "Return one public project record and its gallery media by numeric project ID.",
      inputSchema: z.object({ id: z.number().int().positive() }),
    },
    async ({ id }) => {
      try {
        return jsonResult({ ...await api.getProject(safeId(id)), canonical_url: pageUrlFor("project") });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "list_certificates",
    {
      title: "List certificates",
      description: "List public certificates and training records with cursor pagination.",
      inputSchema: z.object({
        limit: z.number().int().min(1).max(MAX_LIST_LIMIT).optional(),
        cursor: z.string().trim().max(512).optional(),
      }),
    },
    async ({ limit, cursor }) => {
      try {
        return jsonResult(await api.listCertificates(safeLimit(limit, 6, MAX_LIST_LIMIT), cursor));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "get_certificate",
    {
      title: "Get certificate",
      description: "Return one public certificate record and its media items by numeric certificate ID.",
      inputSchema: z.object({ id: z.number().int().positive() }),
    },
    async ({ id }) => {
      try {
        return jsonResult({ ...await api.getCertificate(safeId(id)), canonical_url: pageUrlFor("certificate") });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "list_snippets",
    {
      title: "List snippets",
      description: "List all public Markdown and PDF snippet metadata without reading file contents.",
      inputSchema: z.object({}),
    },
    async () => {
      try {
        return jsonResult({ snippets: flattenPublicSnippets(await api.getSnippetTree()) });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "read_snippet",
    {
      title: "Read public snippet",
      description: "Read complete public Markdown content in bounded chunks, or return canonical links for a public PDF.",
      inputSchema: z.object({
        id: z.number().int().positive(),
        offset: z.number().int().min(0).optional().describe("UTF-16 character offset for the next text chunk."),
        max_chars: z.number().int().min(1).max(MAX_SNIPPET_CHUNK_CHARACTERS).optional().describe("Maximum text characters in this response."),
      }),
    },
    async ({ id, offset, max_chars }) => {
      try {
        const metadata = await api.getSnippetMetadata(safeId(id));
        const page_url = getSnippetPageUrl(metadata);
        if (metadata.format === "pdf") {
          return jsonResult({ ...metadata, page_url, download_url: getSnippetDownloadUrl(metadata.id), content_available: false });
        }

        const content = await api.getSnippetText(metadata.id);
        const start = Math.min(offset ?? 0, content.text.length);
        const end = Math.min(start + (max_chars ?? MAX_SNIPPET_CHUNK_CHARACTERS), content.text.length);
        return jsonResult({
          ...metadata,
          format: "md",
          page_url,
          offset: start,
          content: content.text.slice(start, end),
          next_offset: end,
          total_characters: content.text.length,
          complete: end >= content.text.length,
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  return server;
}

export function createPortfolioMcpHandler(environment: PortfolioMcpEnvironment) {
  return createMcpHandler(() => createPortfolioMcpServer(environment), {
    route: "/mcp",
    allowedHostnames: ["mcp.syn-forge.com", "localhost", "127.0.0.1"],
    allowedOriginHostnames: ["mcp.syn-forge.com", "syn-forge.com", "localhost", "127.0.0.1"],
  });
}

const worker = {
  fetch(request: WorkerRequest, environment: WorkerEnvironment, context: WorkerContext) {
    const handler = createPortfolioMcpHandler(environment);
    return handler(
      request as unknown as Parameters<typeof handler>[0],
      environment as unknown as Parameters<typeof handler>[1],
      context as unknown as Parameters<typeof handler>[2],
    ) as unknown as ReturnType<WorkerFetchHandler>;
  },
} satisfies ExportedHandler<PortfolioMcpEnvironment>;

export default worker;
