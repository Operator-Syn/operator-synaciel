export const PORTFOLIO_TOOL_NAMES = [
  "get_portfolio_overview",
  "search_portfolio",
  "list_projects",
  "get_project",
  "list_certificates",
  "get_certificate",
  "list_snippets",
  "read_snippet",
] as const;

export type PortfolioToolName = (typeof PORTFOLIO_TOOL_NAMES)[number];

export type PortfolioSource = {
  url: string;
  title: string;
};

export type PortfolioEvidenceState = {
  successfulResults: number;
  unusableResults: number;
  sources: PortfolioSource[];
};

export const MAX_UNUSABLE_PORTFOLIO_TOOL_RESULTS = 3;
const MAX_PORTFOLIO_SOURCES = 48;
const SOURCE_FIELDS = new Set([
  "canonical_url",
  "page_url",
  "download_url",
  "project_link",
  "certificate_link",
  "target_url",
]);
const PORTFOLIO_TOOL_SOURCE_URLS: Partial<Record<PortfolioToolName, string>> = {
  get_portfolio_overview: "https://syn-forge.com/",
  list_projects: "https://syn-forge.com/projects",
  get_project: "https://syn-forge.com/projects",
  list_certificates: "https://syn-forge.com/certificates",
  get_certificate: "https://syn-forge.com/certificates",
  list_snippets: "https://syn-forge.com/snippets",
  read_snippet: "https://syn-forge.com/snippets",
};

function objectValue(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function portfolioToolName(value: string): PortfolioToolName | null {
  return PORTFOLIO_TOOL_NAMES.find((name) => value === name || value.endsWith(`_${name}`)) ?? null;
}

/** Keep the agent's capability boundary independent from the user's wording. */
export function selectPortfolioTools<T>(tools: Record<string, T>): Record<string, T> {
  return Object.fromEntries(
    Object.entries(tools).filter(([name]) => portfolioToolName(name) !== null),
  );
}

export function hasCompletePortfolioToolCatalog(tools: Record<string, unknown>): boolean {
  return PORTFOLIO_TOOL_NAMES.every((name) =>
    Object.entries(tools).some(
      ([candidate, tool]) =>
        tool !== undefined && (candidate === name || candidate.endsWith(`_${name}`)),
    ),
  );
}

export function extractStructuredContent(value: unknown): Record<string, unknown> | null {
  const input = objectValue(value);
  const direct = objectValue(input?.structuredContent);
  if (direct) return direct;

  const content = input?.content;
  if (!Array.isArray(content)) return null;
  const first = objectValue(content[0]);
  if (first?.type !== "text" || typeof first.text !== "string") return null;
  try {
    return objectValue(JSON.parse(first.text));
  } catch {
    return null;
  }
}

export function isMcpError(value: unknown): boolean {
  const input = objectValue(value);
  if (input?.isError === true) return true;
  const structured = extractStructuredContent(value);
  return typeof structured?.error === "string" || typeof structured?.code === "string";
}

function unwrapToolOutput(value: unknown): unknown {
  const output = objectValue(value);
  if (output?.type === "tool-error" || output?.type === "tool-output-error") return null;
  if (output?.type === "tool-result" || output?.type === "tool-output-available") {
    return output.output;
  }
  return value;
}

function hasEntries(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0;
}

export function hasUsablePortfolioToolResult(toolName: string, value: unknown): boolean {
  const name = portfolioToolName(toolName);
  const result = unwrapToolOutput(value);
  if (!name || result === null || isMcpError(result)) return false;
  const root = extractStructuredContent(result);
  if (!root) return false;

  switch (name) {
    case "get_portfolio_overview":
      return (
        Object.keys(objectValue(root.site) ?? {}).length > 0 ||
        hasEntries(root.profile) ||
        hasEntries(root.sections)
      );
    case "search_portfolio":
      return hasEntries(root.results);
    case "list_projects":
    case "list_certificates":
      return hasEntries(root.data);
    case "get_project":
      return objectValue(root.project) !== null;
    case "get_certificate":
      return objectValue(root.certificate) !== null;
    case "list_snippets":
      return hasEntries(root.snippets);
    case "read_snippet":
      return (
        typeof root.name === "string" &&
        (typeof root.content === "string" || typeof root.page_url === "string")
      );
  }
}

function publicUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2_048) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

function sourceTitle(value: Record<string, unknown>, fallback: string): string {
  for (const candidate of [value.title, value.name, value.label]) {
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim().slice(0, 256);
  }
  for (const field of ["project", "certificate"]) {
    const nested = objectValue(value[field]);
    if (nested) {
      const title = sourceTitle(nested, "");
      if (title) return title;
    }
  }
  return fallback;
}

export function extractPortfolioSources(toolName: string, value: unknown): PortfolioSource[] {
  const name = portfolioToolName(toolName);
  const result = unwrapToolOutput(value);
  if (!name || result === null || isMcpError(result)) return [];
  const root = extractStructuredContent(result);
  if (!root) return [];

  const sources = new Map<string, PortfolioSource>();
  const defaultUrl = PORTFOLIO_TOOL_SOURCE_URLS[name];
  if (defaultUrl) {
    sources.set(defaultUrl, { url: defaultUrl, title: name.replaceAll("_", " ") });
  }
  const visit = (candidate: unknown, inheritedTitle: string): void => {
    if (Array.isArray(candidate)) {
      candidate.forEach((entry) => {
        visit(entry, inheritedTitle);
      });
      return;
    }
    const record = objectValue(candidate);
    if (!record) return;
    const title = sourceTitle(record, inheritedTitle);
    for (const [key, entry] of Object.entries(record)) {
      if (SOURCE_FIELDS.has(key) || (key === "url" && typeof record.kind === "string")) {
        const url = publicUrl(entry);
        if (url && !sources.has(url)) sources.set(url, { url, title });
      } else if (entry && typeof entry === "object") {
        visit(entry, title);
      }
      if (sources.size >= MAX_PORTFOLIO_SOURCES) return;
    }
  };
  visit(root, name.replaceAll("_", " "));
  return [...sources.values()];
}

export function createPortfolioEvidenceState(): PortfolioEvidenceState {
  return { successfulResults: 0, unusableResults: 0, sources: [] };
}

export function recordPortfolioToolResult(
  state: PortfolioEvidenceState,
  toolName: string,
  value: unknown,
): PortfolioEvidenceState {
  if (!hasUsablePortfolioToolResult(toolName, value)) {
    return { ...state, unusableResults: state.unusableResults + 1 };
  }

  const sources = new Map(state.sources.map((source) => [source.url, source] as const));
  for (const source of extractPortfolioSources(toolName, value)) {
    if (!sources.has(source.url) && sources.size < MAX_PORTFOLIO_SOURCES) {
      sources.set(source.url, source);
    }
  }
  return {
    successfulResults: state.successfulResults + 1,
    unusableResults: state.unusableResults,
    sources: [...sources.values()],
  };
}

export function portfolioToolChoice(state: PortfolioEvidenceState): "required" | "auto" {
  return state.successfulResults > 0 ? "auto" : "required";
}

export function shouldStopPortfolioToolLoop(state: PortfolioEvidenceState): boolean {
  return (
    state.successfulResults === 0 && state.unusableResults >= MAX_UNUSABLE_PORTFOLIO_TOOL_RESULTS
  );
}
