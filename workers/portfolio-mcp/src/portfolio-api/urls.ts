import type { SnippetMetadata } from "./types.ts";

export const DEFAULT_API_ORIGIN = "https://personal-portfolio.syn-forge.com";

export const PORTFOLIO_SITE_ORIGIN = "https://syn-forge.com";

export function getApiUrl(pathname: string, baseUrl: string): URL {
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
