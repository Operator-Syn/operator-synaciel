import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";
import { createCanonicalRouteRedirect } from "../functions/canonicalRedirect.ts";
import { isKnownRoute } from "../functions/routePolicy.ts";
import {
  NON_INDEXABLE_ROUTES,
  SERVED_STATIC_ROUTES,
  SITEMAP_STATIC_ROUTES,
} from "../src/data/canonicalRoutes.ts";
import { createSitemapResponse } from "../src/data/sitemap.ts";

const EXPECTED_SERVED_STATIC_ROUTES = [
  "/projects",
  "/certificates",
  "/snippets",
  "/privacy-policy",
  "/terms-and-conditions",
  "/netbird",
  "/atelier",
  "/ai",
  "/agent",
];

// Item 1.7: six static routes stay indexable; `/netbird`, `/atelier` and
// `/agent` are served but withheld. `/` is always indexable and is not in this
// list.
const EXPECTED_SITEMAP_STATIC_ROUTES = [
  "/projects",
  "/certificates",
  "/snippets",
  "/privacy-policy",
  "/terms-and-conditions",
  "/ai",
];

const EXPECTED_NON_INDEXABLE_ROUTES = ["/netbird", "/atelier", "/agent"];

const request = new Request("https://preview.example/sitemap.xml");
const apiUrl = "https://api.example/api";
const emptySnippets: typeof fetch = async () => Response.json({ data: [] });

function loc(route: string) {
  return new RegExp(`<loc>https://syn-forge\\.com${route}</loc>`);
}

test("serves nine static routes but lists only six in the sitemap", () => {
  assert.deepEqual([...SERVED_STATIC_ROUTES], EXPECTED_SERVED_STATIC_ROUTES);
  assert.deepEqual([...SITEMAP_STATIC_ROUTES], EXPECTED_SITEMAP_STATIC_ROUTES);
  assert.equal(isKnownRoute("/"), true);

  for (const route of SITEMAP_STATIC_ROUTES) {
    assert.ok(
      (SERVED_STATIC_ROUTES as readonly string[]).includes(route),
      `${route} is indexable but not served`,
    );
  }
});

test("withholds exactly the three utility routes from the index without unpublishing them", async () => {
  assert.deepEqual([...NON_INDEXABLE_ROUTES].sort(), [...EXPECTED_NON_INDEXABLE_ROUTES].sort());

  for (const route of EXPECTED_NON_INDEXABLE_ROUTES) {
    assert.ok(
      (SERVED_STATIC_ROUTES as readonly string[]).includes(route),
      `${route} is noindex but no longer served`,
    );
    assert.ok(!(SITEMAP_STATIC_ROUTES as readonly string[]).includes(route));
    assert.equal(isKnownRoute(route), true, `${route} must still return 200`);
    assert.equal(isKnownRoute(`${route}/`), true, `${route}/ must still redirect`);
  }

  const response = await createSitemapResponse(request, apiUrl, emptySnippets);
  assert.equal(response.status, 200);
  const xml = await response.text();

  for (const route of EXPECTED_NON_INDEXABLE_ROUTES) {
    assert.doesNotMatch(xml, loc(route), `${route} must be absent from the sitemap`);
  }
  assert.match(xml, loc("/ai"));
  assert.match(xml, loc("/projects"));
});

test("corrects the middleware so the noindex header is server-level and scoped", async () => {
  const middleware = await readFile(
    resolve(import.meta.dirname, "../functions/_middleware.ts"),
    "utf8",
  );

  // The decision is derived from the same set that drives the sitemap, not a
  // second literal list in the middleware.
  assert.match(middleware, /import \{ NON_INDEXABLE_ROUTES \}/);
  assert.match(middleware, /if \(NON_INDEXABLE_ROUTES\.has\(url\.pathname\)\) \{/);
  assert.match(middleware, /headers\.set\("X-Robots-Tag", "noindex, follow"\)/);

  // The 404 path keeps exactly the bare `noindex` value, and the served-path
  // header is set after the shared HTML headers are applied.
  assert.match(middleware, /headers\.set\("X-Robots-Tag", "noindex"\);/);
  assert.ok(
    middleware.indexOf('headers.set("X-Robots-Tag", "noindex, follow")') >
      middleware.indexOf("applyHtmlHeaders(headers);"),
  );
});

test("every served route canonicalises, including the ones held back from the index", () => {
  for (const route of SERVED_STATIC_ROUTES) {
    const response = createCanonicalRouteRedirect(`https://syn-forge.com${route}/`);
    assert.ok(response, `${route}/ produced no redirect`);
    assert.equal(response.status, 308, `${route}/ did not return 308`);
    assert.equal(
      response.headers.get("location"),
      `https://syn-forge.com${route}`,
      `${route}/ did not lose its trailing slash`,
    );
  }
});

test("the default sitemap lists every indexable route and none of the withheld ones", async () => {
  const response = await createSitemapResponse(request, apiUrl, emptySnippets);
  assert.equal(response.status, 200);
  const xml = await response.text();
  assert.match(xml, loc("/"));

  for (const route of SITEMAP_STATIC_ROUTES) {
    assert.match(xml, loc(route), route);
  }

  for (const route of NON_INDEXABLE_ROUTES) {
    assert.doesNotMatch(xml, loc(route), route);
  }
});
