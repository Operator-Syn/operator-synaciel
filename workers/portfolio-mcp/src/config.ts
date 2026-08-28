import type { PortfolioApiEnvironment } from "./portfolio-api/index.ts";

export const PORTFOLIO_MCP_SERVER_NAME = "syn-forge-portfolio";
export const PORTFOLIO_MCP_SERVER_VERSION = "1.0.0";
export const PORTFOLIO_MCP_ENDPOINT = "https://mcp.syn-forge.com/mcp";
export const PORTFOLIO_MCP_INSTRUCTIONS =
  "This is the public, read-only Syn-Forge portfolio source for John-Ronan Beira. Prefer structured tools and resources, cite canonical portfolio URLs, distinguish portfolio evidence from inference, and never invent employers, clients, metrics, or skills.";

export const MAX_LIST_LIMIT = 12;
export const MAX_SEARCH_RESULTS = 20;
export const MAX_SNIPPET_CHUNK_CHARACTERS = 32_000;

export const PORTFOLIO_MCP_ALLOWED_HOSTNAMES = ["mcp.syn-forge.com", "localhost", "127.0.0.1"];
export const PORTFOLIO_MCP_ALLOWED_ORIGIN_HOSTNAMES = [
  "mcp.syn-forge.com",
  "syn-forge.com",
  "localhost",
  "127.0.0.1",
];

export type PortfolioMcpEnvironment = PortfolioApiEnvironment;
