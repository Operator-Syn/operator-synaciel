import { getSnippetDocumentRoute } from "../components/pages/snippetsPage/snippetRoutes.ts";
import { SITEMAP_STATIC_ROUTES } from "./canonicalRoutes.ts";

const SITE_ORIGIN = "https://syn-forge.com";

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
): Promise<Response> {
  const headers = {
    "Content-Type": "application/xml; charset=utf-8",
    "Cache-Control": "no-store",
  };
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response(null, { status: 405, headers: { ...headers, Allow: "GET, HEAD" } });
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
  try {
    if (!apiUrl) throw new Error("Missing sitemap API URL");
    const response = await fetchContent(`${apiUrl.replace(/\/+$/, "")}/snippets`, {
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) throw new Error("Snippet API unavailable");
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== "object" || !("data" in payload)) {
      throw new Error("Invalid snippet response");
    }
    const entries = [
      ...["/", ...SITEMAP_STATIC_ROUTES].map(
        (path) => `<url><loc>${escapeXml(SITE_ORIGIN + path)}</loc></url>`,
      ),
      ...snippetEntries(payload.data),
    ];
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${[...new Set(entries)].join("")}</urlset>`;
    return new Response(request.method === "HEAD" ? null : xml, { headers });
  } catch {
    return new Response(request.method === "HEAD" ? null : "Sitemap temporarily unavailable", {
      status: 503,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "Retry-After": "60",
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}
