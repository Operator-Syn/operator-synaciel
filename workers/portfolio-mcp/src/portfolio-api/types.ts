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

export type ProjectGalleryItem = {
  id: number;
  project_id: number;
  type: "video" | "image";
  url: string;
  display_order: number;
};

export type ProjectDetails = {
  project: ProjectRecord;
  gallery: ProjectGalleryItem[];
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

export type CertificateMediaItem = {
  id: number;
  certificate_id: number;
  type: "video" | "image";
  url: string;
  display_order: number;
};

export type CertificateDetails = {
  certificate: CertificateRecord;
  items: CertificateMediaItem[];
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

export type SnippetText = {
  text: string;
  size_bytes: number;
  content_type: string;
};

export type PortfolioApiClient = {
  getOverview(): Promise<PortfolioOverview>;
  getAllProjects(): Promise<ProjectRecord[]>;
  getAllCertificates(): Promise<CertificateRecord[]>;
  getProject(id: number): Promise<ProjectDetails>;
  getCertificate(id: number): Promise<CertificateDetails>;
  listProjects(limit: number, cursor?: string): Promise<ArchivePage<ProjectRecord>>;
  listCertificates(limit: number, cursor?: string): Promise<ArchivePage<CertificateRecord>>;
  getSnippetTree(): Promise<SnippetNode[]>;
  getSnippetMetadata(id: number): Promise<SnippetMetadata>;
  getSnippetPreview(id: number): Promise<SnippetPreview>;
  getSnippetText(id: number): Promise<SnippetText>;
};
