import { SERVED_STATIC_ROUTES } from "../src/data/canonicalRoutes.ts";
import { matchesProjectPath } from "../src/data/projectRoutes.ts";

const KNOWN_STATIC_ROUTES = new Set<string>(["/", ...SERVED_STATIC_ROUTES]);
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
    KNOWN_STATIC_ROUTES.has(canonicalPath) ||
    SNIPPET_DOCUMENT_ROUTE.test(canonicalPath) ||
    matchesProjectPath(canonicalPath);

  if (!isKnownRoute || source.pathname === canonicalPath) {
    return null;
  }

  source.pathname = canonicalPath;

  return new Response(null, {
    status: 308,
    headers: { Location: source.href },
  });
}

/** A percent-encoded octet, e.g. `%2D` or `%C3`. */
const ESCAPE = /%[0-9a-f]{2}/g;

function normalizePathname(pathname: string) {
  const collapsed = pathname.toLowerCase().replace(/\/+/g, "/");
  // Lowercasing whole paths also lowercases percent-escape hex digits, and the runtime normalises
  // them back to uppercase before the Function sees them. A lowercased escape therefore differs from
  // every subsequent request for the same URL, which redirected forever. Escape hex is case-
  // insignificant, so it is restored to uppercase after the case fold and never counts as a change.
  const stable = collapsed.replace(ESCAPE, (sequence) => sequence.toUpperCase());
  return stable === "/" ? stable : stable.replace(/\/+$/, "");
}
