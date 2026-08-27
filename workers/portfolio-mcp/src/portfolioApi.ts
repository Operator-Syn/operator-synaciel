const DEFAULT_API_ORIGIN = "https://personal-portfolio.syn-forge.com";
const REQUEST_TIMEOUT_MS = 8_000;
const MAX_TEXT_BYTES = 1_048_576;

export const PORTFOLIO_SITE_ORIGIN = "https://syn-forge.com";

export type PortfolioApiEnvironment = {
  PORTFOLIO_API?: {
    fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
  };
  PORTFOLIO_API_BASE_URL?: string;
};

export type ProfileRecord = {
  label: string;
  value: string;
};

export type SectionItem = {
  label: string | null;
  content: string | null;
  image_url: string | null;
  target_url: string | null;
};

export type SectionRecord = {
  id: number;
  title: string;
  section_type: string;
  items: SectionItem[];
};

export type PortfolioOverview = {
  site: Record<string, string>;
  profile: ProfileRecord[];
  sections: SectionRecord[];
};

export type ProjectRecord = {
  id: number;
  title: string;
  type: "video" | "image";
  url: string;
  short_description: string;
  long_description: string;
  project_link: string;
  display_order: number;
  created_at: string;
};

export type CertificateRecord = {
  id: number;
  title: string;
  type: "video" | "image";
  url: string;
  short_description: string;
  long_description: string;
  certificate_link: string | null;
  display_order: number;
  created_at: string;
};

export type ArchivePage<T> = {
  data: T[];
  pagination: {
    limit: number;
    total: number;
    has_more: boolean;
    next_cursor: string | null;
  };
};

export type SnippetNode = {
  id: number;
  name: string;
  type: "dir" | "file";
  modified: string;
  path?: string | null;
  size?: number;
  format?: "pdf" | "md";
  children?: SnippetNode[];
};

export type SnippetMetadata = {
  id: number;
  name: string;
  type: "file";
  modified: string;
  size: number;
  format: "pdf" | "md";
  path_segments: string[];
};

export type SnippetPreview = SnippetMetadata & {
  excerpt: string | null;
  truncated: boolean;
};

export class PortfolioApiError extends Error {
  readonly status: number;

  constructor(
    message: string,
    status: number,
  ) {
    super(message);
    this.status = status;
    this.name = "PortfolioApiError";
  }
}

function getApiUrl(pathname: string, baseUrl: string) {
  const origin = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(pathname.replace(/^\/+/, ""), origin);
}

export function slugifySnippetName(name: string): string {
  const trimmed = name.trim();
  const extensionMatch = trimmed.match(/(\.[a-z0-9]+)$/i);
  const extension = extensionMatch?.[1].toLowerCase() ?? "";
  const stem = extension ? trimmed.slice(0, -extension.length) : trimmed;
  const slug = stem
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return (slug || "document") + extension;
}

export function getSnippetPageUrl(metadata: Pick<SnippetMetadata, "id" | "name">): string {
  return `${PORTFOLIO_SITE_ORIGIN}/snippets/document/${encodeURIComponent(String(metadata.id))}/${encodeURIComponent(slugifySnippetName(metadata.name))}/`;
}

export function getSnippetDownloadUrl(id: number): string {
  return `${DEFAULT_API_ORIGIN}/api/v2/snippets/${encodeURIComponent(String(id))}/content`;
}

export function flattenSnippetTree(nodes: SnippetNode[], pathSegments: string[] = []) {
  const files: Array<SnippetNode & { path_segments: string[] }> = [];

  for (const node of nodes) {
    const nextPath = [...pathSegments, node.name];
    if (node.type === "file") {
      files.push({ ...node, path_segments: nextPath });
    } else if (node.children) {
      files.push(...flattenSnippetTree(node.children, nextPath));
    }
  }

  return files;
}

export function createPortfolioApiClient(environment: PortfolioApiEnvironment) {
  const baseUrl = environment.PORTFOLIO_API_BASE_URL ?? DEFAULT_API_ORIGIN;

  async function request(pathname: string) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const requestUrl = getApiUrl(pathname, baseUrl);
    const request = new Request(requestUrl, {
      method: "GET",
      headers: { Accept: "application/json, text/plain" },
    });

    try {
      const response = environment.PORTFOLIO_API
        ? await environment.PORTFOLIO_API.fetch(request, { signal: controller.signal })
        : await fetch(request, { signal: controller.signal });

      if (!response.ok) {
        throw new PortfolioApiError(`Portfolio API request failed (${response.status}).`, response.status);
      }

      return response;
    } catch (error) {
      if (error instanceof PortfolioApiError) throw error;
      throw new PortfolioApiError("Portfolio API is unavailable.", 502);
    } finally {
      clearTimeout(timeout);
    }
  }

  async function getJson<T>(pathname: string): Promise<T> {
    const response = await request(pathname);
    try {
      return (await response.json()) as T;
    } catch {
      throw new PortfolioApiError("Portfolio API returned invalid JSON.", 502);
    }
  }

  async function getText(pathname: string) {
    const response = await request(pathname);
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > MAX_TEXT_BYTES) {
      throw new PortfolioApiError("The requested snippet exceeds the public MCP text limit.", 413);
    }

    return {
      text: new TextDecoder().decode(bytes),
      size_bytes: bytes.byteLength,
      content_type: response.headers.get("content-type") ?? "text/plain; charset=utf-8",
    };
  }

  async function getOverview(): Promise<PortfolioOverview> {
    const [settings, profile, sectionRows] = await Promise.all([
      getJson<Record<string, string>>("/api/settings"),
      getJson<ProfileRecord[]>("/api/profile"),
      getJson<Array<{ id: number; title: string; section_type: string }>>("/api/sections"),
    ]);
    const sections = await Promise.all(
      sectionRows.map(async (section) => ({
        ...section,
        items: await getJson<SectionItem[]>(`/api/sections/${section.id}/items`),
      })),
    );

    const publicSiteKeys = new Set(["headerPhrase", "mobileHeaderPhrase", "profileImage", "status"]);
    return {
      site: Object.fromEntries(Object.entries(settings).filter(([key]) => publicSiteKeys.has(key))),
      profile,
      sections,
    };
  }

  return {
    getOverview,
    getAllProjects: () => getJson<ProjectRecord[]>("/api/projects"),
    getAllCertificates: () => getJson<CertificateRecord[]>("/api/certificates"),
    getProject: async (id: number) => {
      const [project, gallery] = await Promise.all([
        getJson<ProjectRecord>(`/api/project/${id}`),
        getJson<Array<{ id: number; project_id: number; type: "video" | "image"; url: string; display_order: number }>>(
          `/api/project/${id}/gallery`,
        ),
      ]);
      return { project, gallery };
    },
    getCertificate: async (id: number) => {
      const [certificate, items] = await Promise.all([
        getJson<CertificateRecord>(`/api/certificates/${id}`),
        getJson<Array<{ id: number; certificate_id: number; type: "video" | "image"; url: string; display_order: number }>>(
          `/api/certificates/${id}/items`,
        ),
      ]);
      return { certificate, items };
    },
    listProjects: (limit: number, cursor?: string) => {
      const search = new URLSearchParams({ limit: String(limit) });
      if (cursor) search.set("cursor", cursor);
      return getJson<ArchivePage<ProjectRecord>>(`/api/v2/projects/archive?${search}`);
    },
    listCertificates: (limit: number, cursor?: string) => {
      const search = new URLSearchParams({ limit: String(limit) });
      if (cursor) search.set("cursor", cursor);
      return getJson<ArchivePage<CertificateRecord>>(`/api/v2/certificates/archive?${search}`);
    },
    getSnippetTree: async () => {
      const response = await getJson<{ success: true; data: SnippetNode[] }>("/api/snippets");
      return response.data;
    },
    getSnippetMetadata: async (id: number) => {
      const response = await getJson<{ success: true; data: SnippetMetadata }>(`/api/v2/snippets/${id}`);
      return response.data;
    },
    getSnippetPreview: async (id: number) => {
      const response = await getJson<{ success: true; data: SnippetPreview }>(`/api/v2/snippets/${id}/preview`);
      return response.data;
    },
    getSnippetText: (id: number) => getText(`/api/v2/snippets/${id}/content`),
  };
}

export type PortfolioApiClient = ReturnType<typeof createPortfolioApiClient>;
