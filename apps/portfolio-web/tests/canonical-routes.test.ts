import assert from "node:assert/strict";
import { test } from "node:test";
import { createCanonicalRouteRedirect } from "../functions/canonicalRedirect.ts";
import { SITEMAP_STATIC_ROUTES } from "../src/data/canonicalRoutes.ts";

test("permanently redirects retired and slash-suffixed snippets routes to canonical URLs", () => {
  const redirects = [
    ["/snippets/root/", "https://syn-forge.com/snippets"],
    ["/snippets/", "https://syn-forge.com/snippets"],
    [
      "/snippets/document/22/database-migrations/",
      "https://syn-forge.com/snippets/document/22/database-migrations",
    ],
  ];

  for (const [pathname, destination] of redirects) {
    const response = createCanonicalRouteRedirect(`https://syn-forge.com${pathname}`);

    assert.ok(response);
    assert.equal(response.status, 308);
    assert.equal(response.headers.get("location"), destination);
  }
});

test("normalizes static trailing slashes and case in one permanent redirect", () => {
  const cases = [
    ["/projects/", "https://syn-forge.com/projects"],
    ["/projects//", "https://syn-forge.com/projects"],
    ["/PROJECTS/", "https://syn-forge.com/projects"],
    ["/ai///", "https://syn-forge.com/ai"],
  ];

  for (const [pathname, destination] of cases) {
    const response = createCanonicalRouteRedirect(`https://syn-forge.com${pathname}`);

    assert.ok(response);
    assert.equal(response.status, 308);
    assert.equal(response.headers.get("location"), destination);
  }

  const withQuery = createCanonicalRouteRedirect("https://syn-forge.com/projects/?page=2");
  assert.ok(withQuery);
  assert.equal(withQuery.headers.get("location"), "https://syn-forge.com/projects?page=2");

  assert.equal(createCanonicalRouteRedirect("https://syn-forge.com/snippets/some-folder/"), null);
  assert.equal(createCanonicalRouteRedirect("https://syn-forge.com/nope-garbage/"), null);
});

test("preserves query parameters in canonical redirects", () => {
  const response = createCanonicalRouteRedirect(
    "https://syn-forge.com/snippets/root/?source=legacy&page=2",
  );

  assert.ok(response);
  assert.equal(
    response.headers.get("location"),
    "https://syn-forge.com/snippets?source=legacy&page=2",
  );
});

test("leaves canonical and nested legacy snippet paths available", () => {
  assert.equal(createCanonicalRouteRedirect("https://syn-forge.com/snippets"), null);
  assert.equal(
    createCanonicalRouteRedirect("https://syn-forge.com/snippets/document/22/database-migrations"),
    null,
  );
  assert.equal(
    createCanonicalRouteRedirect("https://syn-forge.com/snippets/root/database/migrations/"),
    null,
  );
});

test("lists the snippets index in the same no-slash form as the sitemap output", () => {
  assert.deepEqual(
    SITEMAP_STATIC_ROUTES.filter((route) => route.startsWith("/snippets")),
    ["/snippets"],
  );
});
