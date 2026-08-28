import type { McpServer } from "@modelcontextprotocol/server";
import type { PortfolioApiClient } from "../portfolio-api/index.ts";
import { flattenPublicSnippets } from "./snippets.ts";

const JSON_MIME_TYPE = "application/json";

function registerJsonResource(
  server: McpServer,
  name: string,
  uri: string,
  title: string,
  description: string,
  read: () => Promise<unknown>,
): void {
  server.registerResource(
    name,
    uri,
    { title, description, mimeType: JSON_MIME_TYPE },
    async (resourceUri) => ({
      contents: [
        {
          uri: resourceUri.href,
          mimeType: JSON_MIME_TYPE,
          text: JSON.stringify(await read()),
        },
      ],
    }),
  );
}

export function registerPortfolioResources(server: McpServer, api: PortfolioApiClient): void {
  registerJsonResource(
    server,
    "portfolio-overview",
    "portfolio://overview",
    "Syn-Forge portfolio overview",
    "Public identity, capabilities, home content, and links.",
    () => api.getOverview(),
  );
  registerJsonResource(
    server,
    "portfolio-projects",
    "portfolio://projects",
    "Syn-Forge projects",
    "Public project records and links.",
    () => api.getAllProjects(),
  );
  registerJsonResource(
    server,
    "portfolio-certificates",
    "portfolio://certificates",
    "Syn-Forge certificates",
    "Public certificate and training records.",
    () => api.getAllCertificates(),
  );
  registerJsonResource(
    server,
    "portfolio-snippets",
    "portfolio://snippets",
    "Syn-Forge snippets",
    "Public snippet metadata and canonical document links.",
    async () => flattenPublicSnippets(await api.getSnippetTree()),
  );
}
