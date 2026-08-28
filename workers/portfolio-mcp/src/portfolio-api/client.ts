import { createPortfolioApiTransport, type PortfolioApiTransportOptions } from "./transport.ts";
import type {
  ArchivePage,
  CertificateDetails,
  CertificateMediaItem,
  CertificateRecord,
  PortfolioApiClient,
  PortfolioApiEnvironment,
  PortfolioOverview,
  PortfolioSite,
  ProfileRecord,
  ProjectDetails,
  ProjectGalleryItem,
  ProjectRecord,
  SectionItem,
  SectionRecord,
  SnippetMetadata,
  SnippetNode,
  SnippetPreview,
} from "./types.ts";

const PUBLIC_SITE_KEYS = ["headerPhrase", "mobileHeaderPhrase", "profileImage", "status"] as const;

function toPublicSite(settings: Record<string, string>): PortfolioSite {
  const site: PortfolioSite = {};

  for (const key of PUBLIC_SITE_KEYS) {
    const value = settings[key];
    if (typeof value === "string") {
      site[key] = value;
    }
  }

  return site;
}

function toProfileRecord(record: ProfileRecord): ProfileRecord {
  return {
    label: record.label,
    value: record.value,
  };
}

function toSectionItem(item: SectionItem): SectionItem {
  return {
    label: item.label,
    content: item.content,
    image_url: item.image_url,
    target_url: item.target_url,
  };
}

function toProjectRecord(project: ProjectRecord): ProjectRecord {
  return {
    id: project.id,
    title: project.title,
    type: project.type,
    url: project.url,
    short_description: project.short_description,
    long_description: project.long_description,
    project_link: project.project_link,
    display_order: project.display_order,
    created_at: project.created_at,
  };
}

function toProjectGalleryItem(item: ProjectGalleryItem): ProjectGalleryItem {
  return {
    id: item.id,
    project_id: item.project_id,
    type: item.type,
    url: item.url,
    display_order: item.display_order,
  };
}

function toCertificateRecord(certificate: CertificateRecord): CertificateRecord {
  return {
    id: certificate.id,
    title: certificate.title,
    type: certificate.type,
    url: certificate.url,
    short_description: certificate.short_description,
    long_description: certificate.long_description,
    certificate_link: certificate.certificate_link,
    display_order: certificate.display_order,
    created_at: certificate.created_at,
  };
}

function toCertificateMediaItem(item: CertificateMediaItem): CertificateMediaItem {
  return {
    id: item.id,
    certificate_id: item.certificate_id,
    type: item.type,
    url: item.url,
    display_order: item.display_order,
  };
}

function toSnippetNode(node: SnippetNode): SnippetNode {
  const base: SnippetNode = {
    id: node.id,
    name: node.name,
    type: node.type,
    modified: node.modified,
  };

  if (node.type === "dir") {
    return {
      ...base,
      children: (node.children ?? []).map(toSnippetNode),
    };
  }

  return {
    ...base,
    ...(node.size === undefined ? {} : { size: node.size }),
    ...(node.format === undefined ? {} : { format: node.format }),
  };
}

function toSnippetMetadata(metadata: SnippetMetadata): SnippetMetadata {
  return {
    id: metadata.id,
    name: metadata.name,
    type: "file",
    modified: metadata.modified,
    size: metadata.size,
    format: metadata.format,
    path_segments: [...metadata.path_segments],
  };
}

function toSnippetPreview(preview: SnippetPreview): SnippetPreview {
  return {
    ...toSnippetMetadata(preview),
    excerpt: preview.excerpt,
    truncated: preview.truncated,
  };
}

export function createPortfolioApiClient(
  environment: PortfolioApiEnvironment,
  transportOptions?: PortfolioApiTransportOptions,
): PortfolioApiClient {
  const { getJson, getText } = createPortfolioApiTransport(environment, transportOptions);

  async function getOverview(): Promise<PortfolioOverview> {
    const [settings, profile, sectionRows] = await Promise.all([
      getJson<Record<string, string>>("/api/settings"),
      getJson<ProfileRecord[]>("/api/profile"),
      getJson<Array<Pick<SectionRecord, "id" | "title" | "section_type">>>("/api/sections"),
    ]);
    const sections = await Promise.all(
      sectionRows.map(async (section) => ({
        id: section.id,
        title: section.title,
        section_type: section.section_type,
        items: (
          await getJson<SectionItem[]>(
            `/api/sections/${encodeURIComponent(String(section.id))}/items`,
          )
        ).map(toSectionItem),
      })),
    );

    return {
      site: toPublicSite(settings),
      profile: profile.map(toProfileRecord),
      sections,
    };
  }

  async function getProject(id: number): Promise<ProjectDetails> {
    const [project, gallery] = await Promise.all([
      getJson<ProjectRecord>(`/api/project/${encodeURIComponent(String(id))}`),
      getJson<ProjectGalleryItem[]>(`/api/project/${encodeURIComponent(String(id))}/gallery`),
    ]);
    return {
      project: toProjectRecord(project),
      gallery: gallery.map(toProjectGalleryItem),
    };
  }

  async function getCertificate(id: number): Promise<CertificateDetails> {
    const [certificate, items] = await Promise.all([
      getJson<CertificateRecord>(`/api/certificates/${encodeURIComponent(String(id))}`),
      getJson<CertificateMediaItem[]>(`/api/certificates/${encodeURIComponent(String(id))}/items`),
    ]);
    return {
      certificate: toCertificateRecord(certificate),
      items: items.map(toCertificateMediaItem),
    };
  }

  async function listProjects(limit: number, cursor?: string): Promise<ArchivePage<ProjectRecord>> {
    const search = new URLSearchParams({ limit: String(limit) });
    if (cursor) search.set("cursor", cursor);
    const page = await getJson<ArchivePage<ProjectRecord>>(
      `/api/v2/projects/archive?${search.toString()}`,
    );
    return {
      data: page.data.map(toProjectRecord),
      pagination: {
        limit: page.pagination.limit,
        total: page.pagination.total,
        has_more: page.pagination.has_more,
        next_cursor: page.pagination.next_cursor,
      },
    };
  }

  async function listCertificates(
    limit: number,
    cursor?: string,
  ): Promise<ArchivePage<CertificateRecord>> {
    const search = new URLSearchParams({ limit: String(limit) });
    if (cursor) search.set("cursor", cursor);
    const page = await getJson<ArchivePage<CertificateRecord>>(
      `/api/v2/certificates/archive?${search.toString()}`,
    );
    return {
      data: page.data.map(toCertificateRecord),
      pagination: {
        limit: page.pagination.limit,
        total: page.pagination.total,
        has_more: page.pagination.has_more,
        next_cursor: page.pagination.next_cursor,
      },
    };
  }

  async function getSnippetTree(): Promise<SnippetNode[]> {
    const response = await getJson<{ success: true; data: SnippetNode[] }>("/api/snippets");
    return response.data.map(toSnippetNode);
  }

  async function getSnippetMetadata(id: number): Promise<SnippetMetadata> {
    const response = await getJson<{ success: true; data: SnippetMetadata }>(
      `/api/v2/snippets/${encodeURIComponent(String(id))}`,
    );
    return toSnippetMetadata(response.data);
  }

  async function getSnippetPreview(id: number): Promise<SnippetPreview> {
    const response = await getJson<{ success: true; data: SnippetPreview }>(
      `/api/v2/snippets/${encodeURIComponent(String(id))}/preview`,
    );
    return toSnippetPreview(response.data);
  }

  return {
    getOverview,
    getAllProjects: async () => {
      const projects = await getJson<ProjectRecord[]>("/api/projects");
      return projects.map(toProjectRecord);
    },
    getAllCertificates: async () => {
      const certificates = await getJson<CertificateRecord[]>("/api/certificates");
      return certificates.map(toCertificateRecord);
    },
    getProject,
    getCertificate,
    listProjects,
    listCertificates,
    getSnippetTree,
    getSnippetMetadata,
    getSnippetPreview,
    getSnippetText: (id: number) =>
      getText(`/api/v2/snippets/${encodeURIComponent(String(id))}/content`),
  };
}
