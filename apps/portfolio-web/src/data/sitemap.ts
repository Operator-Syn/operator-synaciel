import { type ContentCache, defaultCache, fetchContentText } from "../../functions/contentFetch.ts";
import { getSnippetDocumentRoute } from "../components/pages/snippetsPage/snippetRoutes.ts";
import { SITEMAP_STATIC_ROUTES } from "./canonicalRoutes.ts";
import { STATIC_ROUTE_LASTMOD } from "./contentDates.ts";
import { collectAllProjects, createProjectPageFetcher } from "./projectArchive.ts";
import { projectPath } from "./projectRoutes.ts";

const SITE_ORIGIN = "https://syn-forge.com";

const SITEMAP_CONTENT_TYPE = "application/xml; charset=utf-8";

/**
 * Browser cache: five minutes. The `s-maxage` and `stale-while-revalidate`
 * directives are advisory for any downstream cache in front of this site.
 *
 * They do NOT make the Pages edge reuse this response. A Function response is
 * not placed in Cloudflare's edge cache by a Cache-Control header; that
 * requires an explicit `cache.put`. So the origin cost is controlled by
 * `fetchContentText`'s cached API body below, plus the last-known-good copy
 * this module stores on every successful build. Sending a long `s-maxage` here
 * is still correct — it costs nothing and helps any proxy that does honour it —
 * but do not read it as "the edge serves this for an hour".
 */
const SITEMAP_CACHE_CONTROL = "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400";

/**
 * Cache key for the last complete sitemap this edge built. The path is internal
 * (it is never linked or routed); it only names the `caches.default` entry.
 */
export const SITEMAP_LAST_GOOD_URL = `${SITE_ORIGIN}/.sitemap-last-good.xml`;

const SITEMAP_LAST_GOOD_CACHE_CONTROL = "public, max-age=604800";

function escapeXml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character] ??
      character,
  );
}

function parseSnippetModified(value: unknown): number | undefined {
  if (typeof value !== "string") return undefined;

  // D1's datetime('now') is UTC even though its serialized value has no timezone.
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)
    ? `${value.replace(" ", "T")}Z`
    : value;
  const timestamp = Date.parse(normalized);
  return Number.isFinite(timestamp) ? timestamp : undefined;
}

function snippetEntries(nodes: unknown): { entries: string[]; latestModified?: string } {
  let latest = 0;

  function walk(items: unknown): string[] {
    if (!Array.isArray(items)) throw new Error("Invalid snippet tree");
    return items.flatMap((node: unknown) => {
      if (!node || typeof node !== "object") throw new Error("Invalid snippet node");
      const { id, name, type, children, modified } = node as Record<string, unknown>;
      if (!Number.isSafeInteger(id) || Number(id) <= 0 || typeof name !== "string") {
        throw new Error("Invalid snippet identity");
      }
      if (type === "dir") return walk(children ?? []);
      if (type !== "file") throw new Error("Invalid snippet type");

      const timestamp = parseSnippetModified(modified);
      if (timestamp !== undefined) latest = Math.max(latest, timestamp);

      const location = escapeXml(SITE_ORIGIN + getSnippetDocumentRoute(Number(id), name));
      const lastmod = timestamp ? `<lastmod>${new Date(timestamp).toISOString()}</lastmod>` : "";
      return [`<url><loc>${location}</loc>${lastmod}</url>`];
    });
  }

  const entries = walk(nodes);
  return {
    entries,
    latestModified: latest ? new Date(latest).toISOString() : undefined,
  };
}

/**
 * Build the sitemap entries for every project detail page.
 *
 * Read through the injected fetch and cache, so the suite can drive this path without the network. No
 * `<lastmod>`: the table has no `updated_at`, and a creation date would misstate an edit as no change.
 *
 * Algorithm:
 * 1. Enumerate the archive with `collectAllProjects`, which refuses to return a partial collection.
 * 2. Map each project to its canonical detail path.
 * 3. Throw when the enumeration cannot be completed, so the caller falls into its last-known-good branch
 *    rather than publishing a sitemap that silently omits every project.
 *
 * @param apiUrl The API base.
 * @param fetchContent Injected transport.
 * @param cache Injected cache.
 * @returns One `<url>` entry per project.
 * @throws When the archive cannot be read completely.
 */
export async function projectSitemapEntries(
  apiUrl: string,
  fetchContent: typeof fetch,
  cache: ContentCache | undefined,
): Promise<string[]> {
  const collection = await collectAllProjects(
    createProjectPageFetcher({ base: apiUrl, fetchContent, cache }),
  );
  if (!collection.ok) throw new Error(`Project archive unavailable: ${collection.reason}`);

  return collection.projects.map((project) => urlEntry(projectPath(project.id, project.title)));
}

function urlEntry(path: string, lastmod?: string) {
  const location = escapeXml(SITE_ORIGIN + path);
  const lastmodTag = lastmod ? `<lastmod>${lastmod}</lastmod>` : "";
  return `<url><loc>${location}</loc>${lastmodTag}</url>`;
}

function staticEntries(routes: readonly string[], snippetsLastmod?: string) {
  return ["/", ...routes].map((path) => {
    const lastmod =
      path === "/snippets"
        ? (snippetsLastmod ?? STATIC_ROUTE_LASTMOD[path])
        : STATIC_ROUTE_LASTMOD[path];
    return urlEntry(path, lastmod);
  });
}

function buildSitemapXml(entries: readonly string[]) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${[...new Set(entries)].join("")}</urlset>`;
}

function lastGoodRequest() {
  return new Request(SITEMAP_LAST_GOOD_URL);
}

async function readLastGood(cache: ContentCache | undefined, method: string) {
  if (!cache) return null;

  try {
    const cached = await cache.match(lastGoodRequest());
    if (!cached) return null;

    return new Response(method === "HEAD" ? null : await cached.text(), {
      status: 200,
      headers: {
        "Content-Type": SITEMAP_CONTENT_TYPE,
        "Cache-Control": "no-store",
        "X-Sitemap-Fallback": "last-known-good",
      },
    });
  } catch {
    return null;
  }
}

export async function createSitemapResponse(
  request: Request,
  apiUrl: string | undefined,
  fetchContent: typeof fetch = fetch,
  indexableRoutes: readonly string[] = SITEMAP_STATIC_ROUTES,
  cache: ContentCache | undefined = defaultCache(),
): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response(null, {
      status: 405,
      headers: {
        "Content-Type": SITEMAP_CONTENT_TYPE,
        "Cache-Control": "no-store",
        Allow: "GET, HEAD",
      },
    });
  }
  try {
    if (!apiUrl) throw new Error("Missing sitemap API URL");
    const result = await fetchContentText(`${apiUrl.replace(/\/+$/, "")}/snippets`, {
      timeoutMs: 4000,
      cacheTtlSeconds: 86_400,
      fetchContent,
      cache,
    });
    if (!result.ok) throw new Error("Snippet API unavailable");
    const payload: unknown = JSON.parse(result.body);
    if (!payload || typeof payload !== "object" || !("data" in payload)) {
      throw new Error("Invalid snippet response");
    }

    const snippets = snippetEntries(payload.data);
    const projects = await projectSitemapEntries(apiUrl, fetchContent, cache);
    const entries = [
      ...staticEntries(indexableRoutes, snippets.latestModified),
      ...snippets.entries,
      ...projects,
    ];
    const xml = buildSitemapXml(entries);

    if (cache) {
      try {
        await cache.put(
          lastGoodRequest(),
          new Response(xml, {
            headers: {
              "Content-Type": SITEMAP_CONTENT_TYPE,
              "Cache-Control": SITEMAP_LAST_GOOD_CACHE_CONTROL,
            },
          }),
        );
      } catch {
        // The last-known-good copy is an optimization; a cache failure must not
        // break a successful sitemap response.
      }
    }

    return new Response(request.method === "HEAD" ? null : xml, {
      headers: {
        "Content-Type": SITEMAP_CONTENT_TYPE,
        "Cache-Control": SITEMAP_CACHE_CONTROL,
      },
    });
  } catch {
    const lastGood = await readLastGood(cache, request.method);
    if (lastGood) return lastGood;

    // No last-known-good copy exists on this edge. A 200 with only the static
    // routes would present the missing document URLs as authoritative, so the
    // cold edge reports a temporary failure and lets crawlers retry.
    return new Response(request.method === "HEAD" ? null : "Sitemap temporarily unavailable", {
      status: 503,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "Retry-After": "60",
      },
    });
  }
}
