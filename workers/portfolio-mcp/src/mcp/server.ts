import { McpServer } from "@modelcontextprotocol/server";
import {
  PORTFOLIO_MCP_INSTRUCTIONS,
  PORTFOLIO_MCP_SERVER_NAME,
  PORTFOLIO_MCP_SERVER_VERSION,
} from "../config.ts";
import { createGitHubClient, type GitHubClientOptions } from "../github/index.ts";
import {
  createPortfolioApiClient,
  type PortfolioApiEnvironment,
  type PortfolioApiTransportOptions,
} from "../portfolio-api/index.ts";
import { registerPortfolioResources } from "./resources.ts";
import { registerPortfolioTools } from "./tools/index.ts";

export type PortfolioMcpTransportOptions = PortfolioApiTransportOptions & {
  githubFetch?: GitHubClientOptions["fetchImpl"];
};

export function createPortfolioMcpServer(
  environment: PortfolioApiEnvironment,
  transportOptions?: PortfolioMcpTransportOptions,
): McpServer {
  const api = createPortfolioApiClient(environment, transportOptions);
  const github = createGitHubClient({
    cache: transportOptions?.cache,
    fetchImpl: transportOptions?.githubFetch,
    waitUntil: transportOptions?.waitUntil,
  });
  const server = new McpServer(
    {
      name: PORTFOLIO_MCP_SERVER_NAME,
      version: PORTFOLIO_MCP_SERVER_VERSION,
    },
    {
      instructions: PORTFOLIO_MCP_INSTRUCTIONS,
    },
  );

  registerPortfolioResources(server, api);
  registerPortfolioTools(server, api, github);
  return server;
}
