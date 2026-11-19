import { type ContentCache, fetchContentText } from "../../functions/contentFetch.ts";
import { getSnippetDocumentRoute } from "../components/pages/snippetsPage/snippetRoutes.ts";
import { SITEMAP_STATIC_ROUTES } from "./canonicalRoutes.ts";

const SITE_ORIGIN = "https://syn-forge.com";

const SITEMAP_CONTENT_TYPE = "application/xml; charset=utf-8";

/**
 * Browser cache: five minutes. The `s-maxage` and `stale-while-revalidate`
 * directives are advisory for any downstream cache in front of this site.
 *
 * They do NOT make the Pages edge reuse this response. A Function response is
 * not placed in Cloudflare's edge cache by a Cache-Control header; that
 * requires an explicit `cache.put`. So the origin cost is controlled by
 * `fetchContentText`'s cached API body below, not by this header. Sending a
 * long `s-maxage` here is still correct — it costs nothing and helps any proxy
 * that does honour it — but do not read it as "the edge serves this for an
 * hour".
 */
const SITEMAP_CACHE_CONTROL = "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400";

function escapeXml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character] ??
      character,
  );
}

function snippetEntries(nodes: unknown): string[] {
  if (!Array.isArray(nodes)) throw new Error("Invalid snippet tree");
  return nodes.flatMap((node: unknown) => {
    if (!node || typeof node !== "object") throw new Error("Invalid snippet node");
    const { id, name, type, children, modified } = node as Record<string, unknown>;
    if (!Number.isSafeInteger(id) || Number(id) <= 0 || typeof name !== "string") {
      throw new Error("Invalid snippet identity");
    }
    if (type === "dir") return snippetEntries(children ?? []);
    if (type !== "file") throw new Error("Invalid snippet type");

    // D1's datetime('now') is UTC even though its serialized value has no timezone.
    const timestamp =
      typeof modified === "string"
        ? Date.parse(
            /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(modified)
              ? `${modified.replace(" ", "T")}Z`
              : modified,
          )
        : NaN;
    const lastmod = Number.isFinite(timestamp)
      ? `<lastmod>${new Date(timestamp).toISOString()}</lastmod>`
      : "";
    const location = escapeXml(SITE_ORIGIN + getSnippetDocumentRoute(Number(id), name));
    return [`<url><loc>${location}</loc>${lastmod}</url>`];
  });
}

export async function createSitemapResponse(
  request: Request,
  apiUrl: string | undefined,
  fetchContent: typeof fetch = fetch,
  indexableRoutes: readonly string[] = SITEMAP_STATIC_ROUTES,
  cache?: ContentCache,
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
    // Static routes deliberately carry no <lastmod>. No stable per-route
    // content date exists at runtime: a value read from the request clock
    // would change on every fetch and tell crawlers the page changes
    // constantly, which is worse than omitting it. Document entries below keep
    // the date the API reports for each file.
    const entries = [
      ...["/", ...indexableRoutes].map(
        (path) => `<url><loc>${escapeXml(SITE_ORIGIN + path)}</loc></url>`,
      ),
      ...snippetEntries(payload.data),
    ];
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${[...new Set(entries)].join("")}</urlset>`;
    return new Response(request.method === "HEAD" ? null : xml, {
      headers: {
        "Content-Type": SITEMAP_CONTENT_TYPE,
        "Cache-Control": SITEMAP_CACHE_CONTROL,
      },
    });
  } catch {
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
