import { SERVED_STATIC_ROUTES } from "../src/data/canonicalRoutes.ts";

const KNOWN_STATIC_ROUTES = new Set<string>(["/", ...SERVED_STATIC_ROUTES]);
const SNIPPETS_PREFIX = "/snippets/";

function normalizePathForMatch(pathname: string) {
  return pathname === "/" ? pathname : pathname.replace(/\/+$/, "");
}

/**
 * Decides whether the Pages middleware serves the app shell for a path.
 *
 * Every path under `/snippets/` is accepted on purpose: the Snippets page
 * generates and documents folder URLs, and the SPA parses them. A snippet
 * document existence check belongs to item 1.3, not this allowlist.
 */
export function isKnownRoute(pathname: string) {
  const normalized = normalizePathForMatch(pathname);
  return KNOWN_STATIC_ROUTES.has(normalized) || normalized.startsWith(SNIPPETS_PREFIX);
}
