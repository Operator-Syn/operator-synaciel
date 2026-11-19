import { SITEMAP_STATIC_ROUTES } from "../src/data/canonicalRoutes.ts";

const KNOWN_STATIC_ROUTES = new Set<string>(["/", ...SITEMAP_STATIC_ROUTES]);
const SNIPPET_DOCUMENT_ROUTE = /^\/snippets\/document\/\d+\/[^/]+$/;
const LEGACY_SNIPPET_INDEX = "/snippets/root";
const SNIPPET_INDEX = "/snippets";

/**
 * Builds a permanent redirect for a request path that is not already canonical.
 *
 * The algorithm works in four steps:
 * 1. Lowercase the request path so `/PROJECTS/` and `/projects/` share one form.
 * 2. Collapse repeated slashes and remove any trailing slash, keeping `/` intact.
 * 3. Map the retired `/snippets/root` index onto `/snippets`.
 * 4. Redirect with a 308 only when the result is a known route and the result
 *    differs from the requested path. Unknown paths and `/` return `null` so the
 *    middleware can run its case fold or serve its 404. The query string and
 *    hash survive because only the pathname is replaced.
 */
export function createCanonicalRouteRedirect(requestUrl: string): Response | null {
  const source = new URL(requestUrl);
  const normalizedPath = normalizePathname(source.pathname);
  const canonicalPath = normalizedPath === LEGACY_SNIPPET_INDEX ? SNIPPET_INDEX : normalizedPath;
  const isKnownRoute =
    KNOWN_STATIC_ROUTES.has(canonicalPath) || SNIPPET_DOCUMENT_ROUTE.test(canonicalPath);

  if (!isKnownRoute || source.pathname === canonicalPath) {
    return null;
  }

  source.pathname = canonicalPath;

  return new Response(null, {
    status: 308,
    headers: { Location: source.href },
  });
}

function normalizePathname(pathname: string) {
  const collapsed = pathname.toLowerCase().replace(/\/+/g, "/");
  return collapsed === "/" ? collapsed : collapsed.replace(/\/+$/, "");
}
