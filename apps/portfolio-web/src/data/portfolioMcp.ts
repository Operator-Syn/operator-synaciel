export const PORTFOLIO_MCP_ENDPOINT = "https://mcp.syn-forge.com/mcp";
export const PORTFOLIO_MCP_SERVER_NAME = "syn-forge-portfolio";
export const PORTFOLIO_MCP_TRANSPORT = "Streamable HTTP";
export const PORTFOLIO_MCP_DESCRIPTION =
  "Connect AI agents to Syn-Forge's public portfolio MCP for grounded profile, project, certificate, and public snippet information.";

export const PORTFOLIO_MCP_CLIENT_CONFIG = {
  mcpServers: {
    [PORTFOLIO_MCP_SERVER_NAME]: {
      url: PORTFOLIO_MCP_ENDPOINT,
    },
  },
} as const;

export const PORTFOLIO_MCP_TOOLS = [
  ["get_portfolio_overview", "Identity, capabilities, home content, and public links."],
  ["search_portfolio", "Search public profile, projects, certificates, and snippet metadata."],
  ["list_projects", "List public projects with cursor pagination."],
  ["get_project", "Read one public project and its gallery media."],
  ["list_certificates", "List public certificates and training records."],
  ["get_certificate", "Read one public certificate and its media items."],
  ["list_snippets", "List public Markdown and PDF snippet metadata."],
  ["read_snippet", "Read Markdown in chunks or get canonical links for a PDF."],
] as const;

export const PORTFOLIO_MCP_RESOURCES = [
  ["portfolio://overview", "Public identity, capabilities, home content, and links."],
  ["portfolio://projects", "Public project records and links."],
  ["portfolio://certificates", "Public certificate and training records."],
  ["portfolio://snippets", "Public snippet metadata and canonical document links."],
] as const;
