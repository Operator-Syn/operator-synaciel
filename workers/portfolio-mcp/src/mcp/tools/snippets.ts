import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { MAX_SNIPPET_CHUNK_CHARACTERS } from "../../config.ts";
import {
  getSnippetDownloadUrl,
  getSnippetPageUrl,
  type PortfolioApiClient,
} from "../../portfolio-api/index.ts";
import { errorResult, jsonResult } from "../results.ts";
import { flattenPublicSnippets } from "../snippets.ts";
import { safeId } from "../validation.ts";

export function registerSnippetTools(server: McpServer, api: PortfolioApiClient): void {
  server.registerTool(
    "list_snippets",
    {
      title: "List snippets",
      description:
        "List all public Markdown and PDF snippet metadata without reading file contents.",
      inputSchema: z.object({}),
    },
    async () => {
      try {
        return jsonResult({ snippets: flattenPublicSnippets(await api.getSnippetTree()) });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "read_snippet",
    {
      title: "Read public snippet",
      description:
        "Read complete public Markdown content in bounded chunks, or return canonical links for a public PDF.",
      inputSchema: z.object({
        id: z.number().int().positive(),
        offset: z
          .number()
          .int()
          .min(0)
          .optional()
          .describe("UTF-16 character offset for the next text chunk."),
        max_chars: z
          .number()
          .int()
          .min(1)
          .max(MAX_SNIPPET_CHUNK_CHARACTERS)
          .optional()
          .describe("Maximum text characters in this response."),
      }),
    },
    async ({ id, offset, max_chars }) => {
      try {
        const metadata = await api.getSnippetMetadata(safeId(id));
        const page_url = getSnippetPageUrl(metadata);
        if (metadata.format === "pdf") {
          return jsonResult({
            ...metadata,
            page_url,
            download_url: getSnippetDownloadUrl(metadata.id),
            content_available: false,
          });
        }

        const content = await api.getSnippetText(metadata.id);
        const start = Math.min(offset ?? 0, content.text.length);
        const end = Math.min(
          start + (max_chars ?? MAX_SNIPPET_CHUNK_CHARACTERS),
          content.text.length,
        );
        return jsonResult({
          ...metadata,
          format: "md",
          page_url,
          offset: start,
          content: content.text.slice(start, end),
          next_offset: end,
          total_characters: content.text.length,
          complete: end >= content.text.length,
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );
}
