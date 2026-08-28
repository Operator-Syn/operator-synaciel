import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import type { PortfolioApiClient } from "../../portfolio-api/index.ts";
import { errorResult, jsonResult } from "../results.ts";

export function registerOverviewTool(server: McpServer, api: PortfolioApiClient): void {
  server.registerTool(
    "get_portfolio_overview",
    {
      title: "Get portfolio overview",
      description:
        "Return John-Ronan Beira's public identity, capabilities, home content, and portfolio links.",
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
}
