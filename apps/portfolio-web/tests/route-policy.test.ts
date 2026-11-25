import assert from "node:assert/strict";
import { test } from "node:test";
import { isKnownRoute } from "../functions/routePolicy.ts";
import { SITEMAP_STATIC_ROUTES } from "../src/data/canonicalRoutes.ts";

test("accepts the home page and every static sitemap route", () => {
  assert.equal(isKnownRoute("/"), true);

  for (const route of SITEMAP_STATIC_ROUTES) {
    assert.equal(isKnownRoute(route), true, route);
  }
});

test("accepts snippet folder and document paths the app generates", () => {
  const pathnames = [
    "/snippets/some-folder",
    "/snippets/some-folder/",
    "/snippets/root",
    "/snippets/root/",
    "/snippets/root/database",
    "/snippets/root/database/migrations",
    "/snippets/root/database/migrations/",
    "/snippets/document/3/readme.md",
  ];

  for (const pathname of pathnames) {
    assert.equal(isKnownRoute(pathname), true, pathname);
  }
});

test("accepts the two project detail forms the app generates", () => {
  const pathnames = [
    "/projects/8",
    "/projects/8/",
    "/projects/8/bai-finance-website",
    "/projects/8/bai-finance-website/",
  ];

  for (const pathname of pathnames) {
    assert.equal(isKnownRoute(pathname), true, pathname);
  }
});

test("rejects paths under /projects/ that are not detail paths", () => {
  const pathnames = [
    "/projects/garbage",
    "/projects/garbage/",
    "/projects/garbage/x",
    "/projects/8/x/y",
    "/projects/0/slug",
  ];

  for (const pathname of pathnames) {
    assert.equal(isKnownRoute(pathname), false, pathname);
  }
});

test("rejects paths outside the allowlist", () => {
  const pathnames = [
    "/nope-garbage",
    "/nope-garbage/",
    "/sitemap_index.xml",
    "/.well-known/ai-catalog.json",
    "/assets/nope.js",
    "/snippets-archive",
  ];

  for (const pathname of pathnames) {
    assert.equal(isKnownRoute(pathname), false, pathname);
  }
});

test("deliberately accepts unknown paths under /snippets/ (existence is item 1.3)", () => {
  assert.equal(isKnownRoute("/snippets/no-such-folder"), true);
  assert.equal(isKnownRoute("/snippets/no-such-folder/"), true);
  assert.equal(isKnownRoute("/snippets/document/999/missing.md"), true);
});
