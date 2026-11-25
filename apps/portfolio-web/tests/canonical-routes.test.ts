import assert from "node:assert/strict";
import { test } from "node:test";
import { createCanonicalRouteRedirect } from "../functions/canonicalRedirect.ts";
import { SITEMAP_STATIC_ROUTES } from "../src/data/canonicalRoutes.ts";
import { projectPath } from "../src/data/projectRoutes.ts";

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

test("normalizes project detail paths without looping on the canonical form", () => {
  const canonical = projectPath(8, "BAI Finance Website");
  assert.equal(canonical, "/projects/8/bai-finance-website");

  const cases = [
    ["/PROJECTS/8/BAI-Finance-Website", `https://syn-forge.com${canonical}`],
    ["/projects/8/bai-finance-website/", `https://syn-forge.com${canonical}`],
    ["/projects//8//bai-finance-website", `https://syn-forge.com${canonical}`],
  ];

  for (const [pathname, destination] of cases) {
    const response = createCanonicalRouteRedirect(`https://syn-forge.com${pathname}`);
    assert.ok(response, pathname);
    assert.equal(response.status, 308);
    assert.equal(response.headers.get("location"), destination);
    assert.equal(
      createCanonicalRouteRedirect(destination),
      null,
      "the destination must not redirect",
    );
  }

  // A bare id is a known route and already lowercase, so this helper leaves it to the middleware.
  assert.equal(createCanonicalRouteRedirect("https://syn-forge.com/projects/8"), null);
});

test("a percent-encoded path does not redirect to its own re-spelled escape", () => {
  // The runtime normalises escape hex to uppercase before the Function runs, so lowercasing the whole
  // path made every such request look non-canonical and redirect forever. Both spellings of the same
  // escape must be treated as one URL.
  const settled = ["/snippets/document/22/caf%C3%A9", "/projects/8/bai%2Dfinance-website"];
  for (const pathname of settled) {
    assert.equal(
      createCanonicalRouteRedirect(`https://syn-forge.com${pathname}`),
      null,
      `${pathname} must be a fixed point`,
    );
  }

  // A case-varied path still normalises, once, to the lowercase spelling with uppercase escapes.
  const cases = [
    ["/snippets/document/22/CAF%C3%A9", "https://syn-forge.com/snippets/document/22/caf%C3%A9"],
    ["/snippets/document/22/caf%c3%a9", "https://syn-forge.com/snippets/document/22/caf%C3%A9"],
    ["/PROJECTS/8/BAI%2DFINANCE-WEBSITE", "https://syn-forge.com/projects/8/bai%2Dfinance-website"],
  ];
  for (const [pathname, destination] of cases) {
    const response = createCanonicalRouteRedirect(`https://syn-forge.com${pathname}`);
    assert.ok(response, pathname);
    assert.equal(response.headers.get("location"), destination);
    assert.equal(createCanonicalRouteRedirect(destination), null, `${destination} must settle`);
  }
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
