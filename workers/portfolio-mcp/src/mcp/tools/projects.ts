import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { MAX_LIST_LIMIT } from "../../config.ts";
import type { PortfolioApiClient } from "../../portfolio-api/index.ts";
import { getPortfolioPageUrl } from "../links.ts";
import { errorResult, jsonResult } from "../results.ts";
import { listProjectsOutputSchema, projectDetailsOutputSchema } from "../schemas.ts";
import { safeId, safeLimit } from "../validation.ts";

export function registerProjectTools(server: McpServer, api: PortfolioApiClient): void {
  server.registerTool(
    "list_projects",
    {
      title: "List projects",
      description:
        "List public portfolio projects with cursor pagination and canonical project links.",
      inputSchema: z.strictObject({
        limit: z.number().int().safe().min(1).max(MAX_LIST_LIMIT).optional(),
        cursor: z.string().trim().min(1).max(512).optional(),
      }),
      outputSchema: listProjectsOutputSchema,
      annotations: { readOnlyHint: true },
    },
    async ({ limit, cursor }) => {
      try {
        return jsonResult(await api.listProjects(safeLimit(limit, 6, MAX_LIST_LIMIT), cursor));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "get_project",
    {
      title: "Get project",
      description: "Return one public project record and its gallery media by numeric project ID.",
      inputSchema: z.strictObject({ id: z.number().int().safe().positive() }),
      outputSchema: projectDetailsOutputSchema,
      annotations: { readOnlyHint: true },
    },
    async ({ id }) => {
      try {
        return jsonResult({
          ...(await api.getProject(safeId(id))),
          canonical_url: getPortfolioPageUrl("project"),
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );
}
