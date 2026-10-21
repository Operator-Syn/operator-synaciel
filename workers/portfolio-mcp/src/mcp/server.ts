import { McpServer } from "@modelcontextprotocol/server";
import {
  PORTFOLIO_MCP_INSTRUCTIONS,
  PORTFOLIO_MCP_SERVER_NAME,
  PORTFOLIO_MCP_SERVER_VERSION,
  type PortfolioMcpEnvironment,
} from "../config.ts";
import {
  createGitHubAppCredentialProvider,
  createGitHubClient,
  type GitHubClientOptions,
} from "../github/index.ts";
import {
  createPortfolioApiClient,
  type PortfolioApiEnvironment,
  type PortfolioApiTransportOptions,
} from "../portfolio-api/index.ts";
import { registerPortfolioResources } from "./resources.ts";
import { registerPortfolioTools } from "./tools/index.ts";

export type PortfolioMcpTransportOptions = PortfolioApiTransportOptions & {
  githubAccessToken?: () => Promise<string>;
  githubFetch?: GitHubClientOptions["fetchImpl"];
  githubInvalidateAccessToken?: (token: string) => void;
  githubNow?: () => number;
};

export function createPortfolioMcpServer(
  environment: PortfolioApiEnvironment,
  transportOptions?: PortfolioMcpTransportOptions,
): McpServer {
  const api = createPortfolioApiClient(environment, transportOptions);
  const credentials = transportOptions?.githubAccessToken
    ? {
        getToken: transportOptions.githubAccessToken,
        invalidate: transportOptions.githubInvalidateAccessToken ?? (() => undefined),
      }
    : createGitHubAppCredentialProvider(environment as PortfolioMcpEnvironment, {
        fetchImpl: transportOptions?.githubFetch,
        now: transportOptions?.githubNow,
      });
  const github = createGitHubClient({
    accessToken: () => credentials.getToken(),
    cache: transportOptions?.cache,
    fetchImpl: transportOptions?.githubFetch,
    invalidateAccessToken: (token) => credentials.invalidate(token),
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
