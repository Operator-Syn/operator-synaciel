import {
  flattenSnippetTree,
  getSnippetDownloadUrl,
  getSnippetPageUrl,
  type SnippetNode,
} from "../portfolio-api/index.ts";

export type PublicSnippet = {
  id: number;
  name: string;
  format: "pdf" | "md" | null;
  modified: string;
  size: number;
  path_segments: string[];
  page_url: string;
  download_url: string;
};

export function flattenPublicSnippets(nodes: SnippetNode[]): PublicSnippet[] {
  return flattenSnippetTree(nodes).map((snippet) => ({
    id: snippet.id,
    name: snippet.name,
    format: snippet.format ?? null,
    modified: snippet.modified,
    size: snippet.size ?? 0,
    path_segments: snippet.path_segments,
    page_url: getSnippetPageUrl({ id: snippet.id, name: snippet.name }),
    download_url: getSnippetDownloadUrl(snippet.id),
  }));
}
