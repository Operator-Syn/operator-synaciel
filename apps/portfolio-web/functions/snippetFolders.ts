import type { ProbeResult } from "./snippetFolderProbe.ts";

const SNIPPET_DOCUMENT_ROUTE = /^\/snippets\/document\/\d+\/[^/]+$/;
const FOLDER_KEY_SEPARATOR = "\u0000";

function normalizePath(pathname: string) {
  return pathname === "/" ? pathname : pathname.replace(/\/+$/, "");
}

function decodeSegment(segment: string) {
  try {
    return decodeURIComponent(segment).trim();
  } catch {
    return segment.trim();
  }
}

function folderKey(segments: readonly string[]) {
  return segments.join(FOLDER_KEY_SEPARATOR);
}

/**
 * Returns the folder path segments for a snippet folder URL, or `null` when the
 * path is the snippets index, a snippet document, or not under `/snippets/`.
 *
 * The SPA emits no trailing slash (`/snippets/Database%20Practices`); a trailing
 * slash is normalised here so the middleware can redirect it only after the
 * folder is known to exist. The legacy `/snippets/root` prefix is stripped to
 * match `getInternalPathFromRoutePath`.
 */
export function parseSnippetFolderSegments(pathname: string): string[] | null {
  const normalized = normalizePath(pathname);
  if (normalized === "/snippets" || normalized === "/snippets/root") return null;
  if (!normalized.startsWith("/snippets/")) return null;
  if (SNIPPET_DOCUMENT_ROUTE.test(normalized)) return null;

  let segments = normalized
    .slice("/snippets/".length)
    .split("/")
    .filter(Boolean)
    .map(decodeSegment);

  // `/snippets/root/...` is the retired legacy index alias. Only that exact
  // prefix is stripped; a real top-level folder named `root` would be ambiguous
  // with it, which matches the SPA's `usesLegacyRoot` behaviour.
  const usesLegacyRoot = normalized.startsWith("/snippets/root/");
  if (usesLegacyRoot) segments = segments.slice(1);
  return segments.length ? segments : null;
}

/**
 * Collects every directory path in the snippet tree. Files are not folders; a
 * URL that names a file is not a folder and is reported as missing.
 */
export function collectSnippetFolderPaths(nodes: unknown): ReadonlySet<string> {
  const folders = new Set<string>();

  function walk(items: unknown, parents: readonly string[]) {
    if (!Array.isArray(items)) throw new Error("Invalid snippet tree");

    for (const node of items) {
      if (!node || typeof node !== "object") throw new Error("Invalid snippet node");
      const { name, type, children } = node as Record<string, unknown>;
      if (typeof name !== "string") throw new Error("Invalid snippet name");

      if (type === "dir") {
        const segments = [...parents, name.trim()];
        if (!segments[segments.length - 1]) throw new Error("Invalid snippet folder name");
        folders.add(folderKey(segments));
        walk(children ?? [], segments);
      } else if (type !== "file") {
        throw new Error("Invalid snippet type");
      }
    }
  }

  walk(nodes, []);
  return folders;
}

export function hasSnippetFolder(
  folders: ReadonlySet<string>,
  segments: readonly string[],
): boolean {
  return folders.has(folderKey(segments));
}

export type SnippetFolderRouteDecision =
  | { readonly action: "serve" }
  | { readonly action: "not-found" }
  | { readonly action: "redirect"; readonly pathname: string };

/**
 * Pure route decision for a snippet folder request.
 *
 * `segments` is null for the index/document paths, and `folders` is undefined
 * when the tree could not be read; both cases serve the app rather than invent a
 * 404. A known folder with a trailing slash redirects to the SPA's no-slash
 * canonical; a known folder without one serves; an explicit tree without the
 * folder is the only 404.
 */
export function decideSnippetFolderRoute(
  pathname: string,
  segments: readonly string[] | null,
  folders: ReadonlySet<string> | undefined,
): SnippetFolderRouteDecision {
  if (!segments || !folders) return { action: "serve" };
  if (!hasSnippetFolder(folders, segments)) return { action: "not-found" };
  if (!pathname.endsWith("/")) return { action: "serve" };
  return { action: "redirect", pathname: pathname.replace(/\/+$/, "") };
}

/** Resolve a folder route without HTTP when D1 gives a definitive answer. */
export async function resolveSnippetFolderRoute(
  pathname: string,
  segments: readonly string[] | null,
  probe: (path: readonly string[]) => Promise<ProbeResult>,
  loadApiFolders: () => Promise<ReadonlySet<string> | undefined>,
): Promise<SnippetFolderRouteDecision> {
  // Skip non-folder routes. For folder routes, translate a definite answer
  // into membership in a set; only uncertainty uses the existing API lookup.
  if (!segments) return { action: "serve" };
  const result = await probe(segments);
  const folders =
    result === "unknown"
      ? await loadApiFolders()
      : new Set(result === "yes" ? [folderKey(segments)] : []);
  return decideSnippetFolderRoute(pathname, segments, folders);
}
