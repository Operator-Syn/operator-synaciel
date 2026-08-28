import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { MAX_SEARCH_RESULTS } from "../../config.ts";
import type { PortfolioApiClient } from "../../portfolio-api/index.ts";
import { errorResult, jsonResult } from "../results.ts";
import { searchPortfolioOutputSchema } from "../schemas.ts";
import { buildSearchResults } from "../search.ts";
import { safeLimit } from "../validation.ts";

export function registerSearchTool(server: McpServer, api: PortfolioApiClient): void {
  server.registerTool(
    "search_portfolio",
    {
      title: "Search portfolio",
      description:
        "Search public profile, project, certificate, and snippet metadata using a bounded natural-language query.",
      inputSchema: z.strictObject({
        query: z
          .string()
          .trim()
          .min(1)
          .max(200)
          .describe("Terms to find in public portfolio content."),
        limit: z
          .number()
          .int()
          .safe()
          .min(1)
          .max(MAX_SEARCH_RESULTS)
          .optional()
          .describe("Maximum number of matches to return."),
      }),
      outputSchema: searchPortfolioOutputSchema,
      annotations: { readOnlyHint: true },
    },
    async ({ query, limit }) => {
      try {
        return jsonResult({
          query,
          results: await buildSearchResults(api, query, safeLimit(limit, 10, MAX_SEARCH_RESULTS)),
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );
}
