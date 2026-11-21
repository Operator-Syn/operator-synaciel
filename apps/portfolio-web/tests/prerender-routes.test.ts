/**
 * The prerendered body fragments: the route map, the copy they carry, and the markup they emit.
 *
 * These are the crawler-visible strings, so a change here is a change to what a non-JS client reads. The
 * tests pin the copy against the exported constants rather than literals, which is what makes a page copy
 * change fail until the fragment moves with it.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { formatArchiveCount } from "../src/data/archiveCount";
import {
  buildPrerenderFragment,
  escapeHtml,
  PRERENDER_NAV_LINKS,
  PRERENDER_ROUTES,
  PROJECTS_HEADING,
  PROJECTS_LEAD,
  prerenderSlugFor,
  SNIPPETS_LEAD,
} from "../src/data/prerenderRoutes";

test("covers exactly the seven public routes with unique slugs", () => {
  assert.deepEqual(
    PRERENDER_ROUTES.map((route) => route.path),
    [
      "/",
      "/projects",
      "/certificates",
      "/snippets",
      "/ai",
      "/privacy-policy",
      "/terms-and-conditions",
    ],
  );
  assert.equal(new Set(PRERENDER_ROUTES.map((route) => route.slug)).size, 7);
});

test("resolves a slug for prerendered paths only", () => {
  assert.equal(prerenderSlugFor("/projects"), "projects");
  assert.equal(prerenderSlugFor("/privacy-policy"), "privacy");
  assert.equal(prerenderSlugFor("/netbird"), null);
  assert.equal(prerenderSlugFor("/atelier"), null);
  assert.equal(prerenderSlugFor("/agent"), null);
  assert.equal(prerenderSlugFor("/snippets/document/3/readme-md"), null);
  assert.equal(prerenderSlugFor("/projects/extra"), null);
});

test("every route carries a heading and a lead of real length", () => {
  for (const route of PRERENDER_ROUTES) {
    assert.ok(route.heading.length > 0, `${route.path} has no heading`);
    assert.ok(route.lead.length > 40, `${route.path} lead is too short: ${route.lead.length}`);
  }
  assert.equal(PRERENDER_ROUTES[1].heading, PROJECTS_HEADING);
  assert.equal(PRERENDER_ROUTES[1].lead, PROJECTS_LEAD);
  assert.equal(PRERENDER_ROUTES[3].lead, SNIPPETS_LEAD);
});

test("the count line adds the future-card slot exactly once", () => {
  assert.equal(formatArchiveCount(7, "projects"), "[ 8 projects ]");
  assert.equal(formatArchiveCount(0, "certifications"), "[ 1 certifications ]");
  assert.equal(formatArchiveCount(12, "projects"), "[ 13 projects ]");
});

test("escapes the characters that would break out of text or an attribute", () => {
  assert.equal(escapeHtml(`a & b < c > d " e ' f`), "a &amp; b &lt; c &gt; d &quot; e &#39; f");
});

test("links the fragment carries cover all seven routes", () => {
  assert.deepEqual(
    PRERENDER_NAV_LINKS.map((link) => link.href),
    PRERENDER_ROUTES.map((route) => route.path),
  );
});

test("renders a main with one heading, a lead, a nav of seven links and no inline style", () => {
  const fragment = buildPrerenderFragment(PRERENDER_ROUTES[1]);

  assert.match(fragment, /^<main class="prerender-body"/);
  assert.equal(fragment.match(/<h1>/g)?.length, 1);
  assert.equal(fragment.match(/<a href="/g)?.length, 7);
  assert.ok(fragment.includes('<nav aria-label="Site sections">'));
  assert.ok(!fragment.includes("style="));
  assert.ok(!fragment.includes("<script"));
});

test("adds the count line and rows only when the caller supplies them", () => {
  const plain = buildPrerenderFragment(PRERENDER_ROUTES[1]);
  assert.ok(!plain.includes("prerender-count"));
  assert.ok(!plain.includes("prerender-items"));

  const enriched = buildPrerenderFragment(PRERENDER_ROUTES[1], {
    count: `[ ${7 + 1} projects ]`,
    items: [{ title: "BAI Finance", description: "A platform for the community." }],
  });

  assert.ok(enriched.includes('<p class="prerender-count">[ 8 projects ]</p>'));
  assert.ok(enriched.includes("<h2>BAI Finance</h2>"));
  assert.ok(enriched.includes("<p>A platform for the community.</p>"));
});

test("escapes API text rather than trusting it", () => {
  const fragment = buildPrerenderFragment(PRERENDER_ROUTES[1], {
    items: [{ title: "<script>alert(1)</script>", description: "Tom & Jerry" }],
  });

  assert.ok(!fragment.includes("<script>"));
  assert.ok(fragment.includes("&lt;script&gt;"));
  assert.ok(fragment.includes("Tom &amp; Jerry"));
});
