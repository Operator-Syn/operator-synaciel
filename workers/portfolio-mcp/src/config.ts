import type { PortfolioApiEnvironment } from "./portfolio-api/index.ts";

export const PORTFOLIO_MCP_SERVER_NAME = "syn-forge-portfolio";
export const PORTFOLIO_MCP_SERVER_VERSION = "1.0.0";
export const PORTFOLIO_MCP_ENDPOINT = "https://mcp.syn-forge.com/mcp";
export const PORTFOLIO_MCP_INSTRUCTIONS =
  "This is the public, read-only Syn-Forge portfolio source for Operator-Syn. Prefer structured tools and resources, cite canonical portfolio URLs, distinguish portfolio evidence from inference, and never invent employers, clients, metrics, or skills. GitHub inspection is limited to public repositories already linked by a project and the main branch.";

export const MAX_LIST_LIMIT = 12;
export const MAX_SEARCH_RESULTS = 20;
export const MAX_SNIPPET_CHUNK_CHARACTERS = 32_000;
export const MAX_SNIPPET_OFFSET = 1_048_576;
export const PORTFOLIO_MCP_CACHE_TTL_SECONDS = 21_600;
export const GITHUB_REPOSITORY_CACHE_TTL_SECONDS = 21_600;
export const GITHUB_README_CACHE_TTL_SECONDS = 3_600;
export const GITHUB_COMMIT_LIST_CACHE_TTL_SECONDS = 300;
export const GITHUB_COMMIT_CACHE_TTL_SECONDS = 86_400;
export const GITHUB_COMMIT_REACHABILITY_CACHE_TTL_SECONDS = 300;
export const MAX_GITHUB_COMMIT_PAGE = 100;
export const GITHUB_README_MAX_CHARACTERS = 1_048_576;
export const GITHUB_COMMIT_MESSAGE_MAX_CHARACTERS = 2_000;
export const GITHUB_COMMIT_FILE_LIMIT = 100;

export const PORTFOLIO_MCP_ALLOWED_HOSTNAMES = ["mcp.syn-forge.com", "localhost", "127.0.0.1"];
export const PORTFOLIO_MCP_ALLOWED_ORIGIN_HOSTNAMES = [
  "mcp.syn-forge.com",
  "syn-forge.com",
  "localhost",
  "127.0.0.1",
];

export type PortfolioMcpEnvironment = PortfolioApiEnvironment;
