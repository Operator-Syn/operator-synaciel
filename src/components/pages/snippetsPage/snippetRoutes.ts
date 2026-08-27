export const SNIPPETS_ROOT_PATH = "/snippets";
export const SNIPPETS_DOCUMENT_ROUTE_PREFIX = "/snippets/document";

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

export function getSnippetDocumentRoute(id: number, name: string): string {
  return (
    SNIPPETS_DOCUMENT_ROUTE_PREFIX +
    "/" +
    encodeURIComponent(String(id)) +
    "/" +
    encodeURIComponent(slugifySnippetName(name)) +
    "/"
  );
}

export function getSnippetDisplayPath(pathSegments: string[]): string {
  return `/${pathSegments.join("/")}/`;
}
