import { createPortfolioApiTransport } from "./transport.ts";
import type {
  ArchivePage,
  CertificateDetails,
  CertificateMediaItem,
  CertificateRecord,
  PortfolioApiClient,
  PortfolioApiEnvironment,
  PortfolioOverview,
  ProfileRecord,
  ProjectDetails,
  ProjectGalleryItem,
  ProjectRecord,
  SectionItem,
  SnippetMetadata,
  SnippetNode,
  SnippetPreview,
} from "./types.ts";

export function createPortfolioApiClient(environment: PortfolioApiEnvironment): PortfolioApiClient {
  const { getJson, getText } = createPortfolioApiTransport(environment);

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

    const publicSiteKeys = new Set([
      "headerPhrase",
      "mobileHeaderPhrase",
      "profileImage",
      "status",
    ]);
    return {
      site: Object.fromEntries(Object.entries(settings).filter(([key]) => publicSiteKeys.has(key))),
      profile,
      sections,
    };
  }

  async function getProject(id: number): Promise<ProjectDetails> {
    const [project, gallery] = await Promise.all([
      getJson<ProjectRecord>(`/api/project/${id}`),
      getJson<ProjectGalleryItem[]>(`/api/project/${id}/gallery`),
    ]);
    return { project, gallery };
  }

  async function getCertificate(id: number): Promise<CertificateDetails> {
    const [certificate, items] = await Promise.all([
      getJson<CertificateRecord>(`/api/certificates/${id}`),
      getJson<CertificateMediaItem[]>(`/api/certificates/${id}/items`),
    ]);
    return { certificate, items };
  }

  async function listProjects(limit: number, cursor?: string): Promise<ArchivePage<ProjectRecord>> {
    const search = new URLSearchParams({ limit: String(limit) });
    if (cursor) search.set("cursor", cursor);
    return getJson<ArchivePage<ProjectRecord>>(`/api/v2/projects/archive?${search.toString()}`);
  }

  async function listCertificates(
    limit: number,
    cursor?: string,
  ): Promise<ArchivePage<CertificateRecord>> {
    const search = new URLSearchParams({ limit: String(limit) });
    if (cursor) search.set("cursor", cursor);
    return getJson<ArchivePage<CertificateRecord>>(
      `/api/v2/certificates/archive?${search.toString()}`,
    );
  }

  async function getSnippetTree(): Promise<SnippetNode[]> {
    const response = await getJson<{ success: true; data: SnippetNode[] }>("/api/snippets");
    return response.data;
  }

  async function getSnippetMetadata(id: number): Promise<SnippetMetadata> {
    const response = await getJson<{ success: true; data: SnippetMetadata }>(
      `/api/v2/snippets/${id}`,
    );
    return response.data;
  }

  async function getSnippetPreview(id: number): Promise<SnippetPreview> {
    const response = await getJson<{ success: true; data: SnippetPreview }>(
      `/api/v2/snippets/${id}/preview`,
    );
    return response.data;
  }

  return {
    getOverview,
    getAllProjects: () => getJson<ProjectRecord[]>("/api/projects"),
    getAllCertificates: () => getJson<CertificateRecord[]>("/api/certificates"),
    getProject,
    getCertificate,
    listProjects,
    listCertificates,
    getSnippetTree,
    getSnippetMetadata,
    getSnippetPreview,
    getSnippetText: (id: number) => getText(`/api/v2/snippets/${id}/content`),
  };
}
