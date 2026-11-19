/**
 * Last significant content update for each static route, used as the sitemap
 * `<lastmod>` value.
 *
 * These dates are checked in on purpose. A value read from the request clock
 * changes on every fetch and tells crawlers the page churns constantly, which is
 * worse than omitting the field. Update the matching entry when the page's copy
 * changes; document entries keep the modification date reported by the snippet
 * API.
 */
export const STATIC_ROUTE_LASTMOD: Readonly<Record<string, string>> = {
  "/": "2026-10-20",
  "/projects": "2026-09-20",
  "/certificates": "2026-09-20",
  "/snippets": "2026-09-23",
  "/privacy-policy": "2026-08-28",
  "/terms-and-conditions": "2026-08-28",
  "/ai": "2026-10-20",
};
