import assert from "node:assert/strict";
import { test } from "node:test";
import { createCanonicalRouteRedirect } from "../../apps/portfolio-web/functions/canonicalRedirect.ts";
import { isKnownRoute } from "../../apps/portfolio-web/functions/routePolicy.ts";
import {
  SERVED_STATIC_ROUTES,
  SITEMAP_STATIC_ROUTES,
} from "../../apps/portfolio-web/src/data/canonicalRoutes.ts";
import { createSitemapResponse } from "../../apps/portfolio-web/src/data/sitemap.ts";

const EXPECTED_STATIC_ROUTES = [
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

const request = new Request("https://preview.example/sitemap.xml");
const apiUrl = "https://api.example/api";
const emptySnippets: typeof fetch = async () => Response.json({ data: [] });

test("both lists hold exactly the nine static routes, and the served list covers the sitemap list", () => {
  assert.deepEqual([...SERVED_STATIC_ROUTES], EXPECTED_STATIC_ROUTES);
  assert.deepEqual([...SITEMAP_STATIC_ROUTES], EXPECTED_STATIC_ROUTES);
  assert.equal(isKnownRoute("/"), true);

  for (const route of SITEMAP_STATIC_ROUTES) {
    assert.ok(
      (SERVED_STATIC_ROUTES as readonly string[]).includes(route),
      `${route} is indexable but not served`,
    );
  }
});

test("a served route held back from the indexable list is still served and absent from the sitemap", async () => {
  const heldBack = "/agent";
  assert.ok((SERVED_STATIC_ROUTES as readonly string[]).includes(heldBack));

  const indexableWithoutHeldBack = SITEMAP_STATIC_ROUTES.filter((route) => route !== heldBack);
  assert.ok(!(indexableWithoutHeldBack as readonly string[]).includes(heldBack));

  assert.equal(isKnownRoute(heldBack), true);
  assert.equal(isKnownRoute(`${heldBack}/`), true);

  const response = await createSitemapResponse(
    request,
    apiUrl,
    emptySnippets,
    indexableWithoutHeldBack,
  );
  assert.equal(response.status, 200);
  const xml = await response.text();
  assert.doesNotMatch(xml, /<loc>https:\/\/syn-forge\.com\/agent<\/loc>/);
  assert.match(xml, /<loc>https:\/\/syn-forge\.com\/projects<\/loc>/);
  assert.match(xml, /<loc>https:\/\/syn-forge\.com\/ai<\/loc>/);
});

test("every served route canonicalises, including any held back from the sitemap", () => {
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

test("the default sitemap still lists every currently indexable route", async () => {
  const response = await createSitemapResponse(request, apiUrl, emptySnippets);
  assert.equal(response.status, 200);
  const xml = await response.text();
  assert.match(xml, /<loc>https:\/\/syn-forge\.com\/<\/loc>/);

  for (const route of SITEMAP_STATIC_ROUTES) {
    assert.match(xml, new RegExp(`<loc>https://syn-forge\\.com${route}</loc>`), route);
  }
});
