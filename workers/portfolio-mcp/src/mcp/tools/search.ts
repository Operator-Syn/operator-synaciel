import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { MAX_SEARCH_QUERY_CHARACTERS, MAX_SEARCH_RESULTS } from "../../config.ts";
import type { PortfolioApiClient } from "../../portfolio-api/index.ts";
import { errorResult, jsonResult } from "../results.ts";
import { searchPortfolioOutputSchema } from "../schemas.ts";
import { buildSearchResults, type SearchMode } from "../search.ts";
import { safeLimit } from "../validation.ts";

export function registerSearchTool(server: McpServer, api: PortfolioApiClient): void {
  server.registerTool(
    "search_portfolio",
    {
      title: "Search portfolio",
      description:
        "Search public profile, project, certificate, and snippet fields for caller-provided terms. Use list tools for collection-wide requests and detail/read tools after finding a record. Results include match provenance; all mode requires every supplied term to match the same record.",
      inputSchema: z.strictObject({
        query: z
          .string()
          .trim()
          .min(1)
          .max(MAX_SEARCH_QUERY_CHARACTERS)
          .describe("Concise caller-provided terms to match in public portfolio fields."),
        limit: z
          .number()
          .int()
          .safe()
          .min(1)
          .max(MAX_SEARCH_RESULTS)
          .optional()
          .describe("Maximum number of matches to return."),
        match_mode: z
          .enum(["broad", "all"])
          .optional()
          .describe("Use all to require every supplied query term in one record."),
      }),
      outputSchema: searchPortfolioOutputSchema,
      annotations: { readOnlyHint: true },
    },
    async ({ query, limit, match_mode }) => {
      try {
        return jsonResult({
          query,
          results: await buildSearchResults(
            api,
            query,
            safeLimit(limit, 10, MAX_SEARCH_RESULTS),
            (match_mode ?? "broad") as SearchMode,
          ),
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );
}
