/**
 * Every static path the Pages middleware serves.
 *
 * This is the routing allowlist. A route stays here even when it should not be
 * indexed: removing it would make `isKnownRoute` reject a live page.
 */
export const SERVED_STATIC_ROUTES = [
  "/projects",
  "/certificates",
  "/snippets",
  "/privacy-policy",
  "/terms-and-conditions",
  "/netbird",
  "/atelier",
  "/ai",
  "/agent",
] as const;

/**
 * Served static routes that are deliberately kept out of the sitemap.
 *
 * Empty today. Item 1.7 adds `/netbird`, `/atelier` and `/agent` here once their
 * indexability is decided. Excluding a route from the sitemap must never remove
 * it from `SERVED_STATIC_ROUTES` — that would 404 a live page.
 */
const NON_INDEXABLE_ROUTES: ReadonlySet<string> = new Set([]);

/**
 * The served static routes that belong in the sitemap.
 *
 * Derived, so the two lists cannot drift: a route added to
 * `SERVED_STATIC_ROUTES` is indexable unless it is named in
 * `NON_INDEXABLE_ROUTES`. This is an indexing decision only; serving is decided
 * by `SERVED_STATIC_ROUTES`.
 */
export const SITEMAP_STATIC_ROUTES: readonly string[] = SERVED_STATIC_ROUTES.filter(
  (route) => !NON_INDEXABLE_ROUTES.has(route),
);
