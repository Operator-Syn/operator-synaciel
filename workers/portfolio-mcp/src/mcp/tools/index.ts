import type { McpServer } from "@modelcontextprotocol/server";
import type { GitHubClient } from "../../github/index.ts";
import type { PortfolioApiClient } from "../../portfolio-api/index.ts";
import { registerCertificateTools } from "./certificates.ts";
import { registerGitHubProjectTools } from "./github.ts";
import { registerOverviewTool } from "./overview.ts";
import { registerProjectTools } from "./projects.ts";
import { registerSearchTool } from "./search.ts";
import { registerSnippetTools } from "./snippets.ts";

export function registerPortfolioTools(
  server: McpServer,
  api: PortfolioApiClient,
  github: GitHubClient,
): void {
  registerOverviewTool(server, api);
  registerSearchTool(server, api);
  registerProjectTools(server, api);
  registerCertificateTools(server, api);
  registerSnippetTools(server, api);
  registerGitHubProjectTools(server, api, github);
}
