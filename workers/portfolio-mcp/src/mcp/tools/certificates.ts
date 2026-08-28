import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { MAX_LIST_LIMIT } from "../../config.ts";
import type { PortfolioApiClient } from "../../portfolio-api/index.ts";
import { getPortfolioPageUrl } from "../links.ts";
import { errorResult, jsonResult } from "../results.ts";
import { certificateDetailsOutputSchema, listCertificatesOutputSchema } from "../schemas.ts";
import { safeId, safeLimit } from "../validation.ts";

export function registerCertificateTools(server: McpServer, api: PortfolioApiClient): void {
  server.registerTool(
    "list_certificates",
    {
      title: "List certificates",
      description: "List public certificates and training records with cursor pagination.",
      inputSchema: z.strictObject({
        limit: z.number().int().safe().min(1).max(MAX_LIST_LIMIT).optional(),
        cursor: z.string().trim().min(1).max(512).optional(),
      }),
      outputSchema: listCertificatesOutputSchema,
      annotations: { readOnlyHint: true },
    },
    async ({ limit, cursor }) => {
      try {
        return jsonResult(await api.listCertificates(safeLimit(limit, 6, MAX_LIST_LIMIT), cursor));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "get_certificate",
    {
      title: "Get certificate",
      description:
        "Return one public certificate record and its media items by numeric certificate ID.",
      inputSchema: z.strictObject({ id: z.number().int().safe().positive() }),
      outputSchema: certificateDetailsOutputSchema,
      annotations: { readOnlyHint: true },
    },
    async ({ id }) => {
      try {
        return jsonResult({
          ...(await api.getCertificate(safeId(id))),
          canonical_url: getPortfolioPageUrl("certificate"),
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );
}
