import { SERVED_STATIC_ROUTES } from "../src/data/canonicalRoutes.ts";

const KNOWN_STATIC_ROUTES = new Set<string>(["/", ...SERVED_STATIC_ROUTES]);
const SNIPPETS_PREFIX = "/snippets/";

function normalizePathForMatch(pathname: string) {
  return pathname === "/" ? pathname : pathname.replace(/\/+$/, "");
}

/**
 * Decides whether the Pages Function may serve the app shell for a path.
 *
 * Every path under `/snippets/` is accepted here so real folder URLs can be
 * served. The middleware checks D1 first and uses the cached API tree when D1
 * cannot answer. Missing folders 404; unknown folder state still serves. This allowlist
 * only decides whether the Function runs.
 */
export function isKnownRoute(pathname: string) {
  const normalized = normalizePathForMatch(pathname);
  return KNOWN_STATIC_ROUTES.has(normalized) || normalized.startsWith(SNIPPETS_PREFIX);
}
