import { McpServer } from "@modelcontextprotocol/server";
import {
  PORTFOLIO_MCP_INSTRUCTIONS,
  PORTFOLIO_MCP_SERVER_NAME,
  PORTFOLIO_MCP_SERVER_VERSION,
} from "../config.ts";
import { createPortfolioApiClient, type PortfolioApiEnvironment } from "../portfolio-api/index.ts";
import { registerPortfolioResources } from "./resources.ts";
import { registerPortfolioTools } from "./tools/index.ts";

export function createPortfolioMcpServer(environment: PortfolioApiEnvironment): McpServer {
  const api = createPortfolioApiClient(environment);
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
  registerPortfolioTools(server, api);
  return server;
}
