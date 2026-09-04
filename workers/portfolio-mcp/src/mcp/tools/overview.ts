import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import type { PortfolioApiClient } from "../../portfolio-api/index.ts";
import { errorResult, jsonResult } from "../results.ts";
import { portfolioOverviewOutputSchema } from "../schemas.ts";

export function registerOverviewTool(server: McpServer, api: PortfolioApiClient): void {
  server.registerTool(
    "get_portfolio_overview",
    {
      title: "Get portfolio overview",
      description:
        "Return Operator-Syn's public identity, capabilities, home content, and public links, including social/contact targets when present.",
      inputSchema: z.strictObject({}),
      outputSchema: portfolioOverviewOutputSchema,
      annotations: { readOnlyHint: true },
    },
    async () => {
      try {
        return jsonResult(await api.getOverview());
      } catch (error) {
        return errorResult(error);
      }
    },
  );
}
