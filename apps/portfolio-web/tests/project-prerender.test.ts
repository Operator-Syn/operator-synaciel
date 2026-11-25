import assert from "node:assert/strict";
import { test } from "node:test";
import {
  type ProjectDescriptionBlock,
  parseProjectDescription,
} from "../src/components/pages/projectsPage/projectDescription.ts";
import { PRERENDER_NAV_LINKS } from "../src/data/prerenderRoutes.ts";
import type { ApiProject } from "../src/data/projectArchive.ts";
import { buildProjectFragment } from "../src/data/projectPrerender.ts";

/** A project with the fields the fragment renders. */
function project(overrides: Partial<ApiProject> = {}): ApiProject {
  return {
    id: 8,
    title: "BAI Finance Website",
    type: "image",
    url: "https://personal-portfolio-bucket.syn-forge.com/Projects/8.png",
    short_description: "A professional digital platform for the Filipino-Australian community.",
    long_description:
      "First paragraph.\nSecond line of it.\n\n- One bullet\n- Two bullets\n\nClosing.",
    project_link: "https://www.baifinance.com.au/",
    categories: ["client-website", "fintech"],
    stack: ["next.js", "react"],
    highlights: ["Live conversion", "Loan calculators"],
    display_order: 1,
    created_at: "2026-08-27 08:45:50",
    gallery: [],
    ...overrides,
  };
}

test("splits a description into paragraphs and bullet lists", () => {
  const blocks = parseProjectDescription(
    "First paragraph.\nSecond line of it.\n\n- One bullet\n- Two bullets\n\nClosing.",
  );

  assert.deepEqual(blocks, [
    { id: "block-0", kind: "paragraph", text: "First paragraph. Second line of it." },
    { id: "block-1", kind: "list", items: ["One bullet", "Two bullets"] },
    { id: "block-2", kind: "paragraph", text: "Closing." },
  ]);
});

test("a description with bullets only yields one list, and an empty one yields nothing", () => {
  assert.deepEqual(parseProjectDescription("- Only bullet"), [
    { id: "block-0", kind: "list", items: ["Only bullet"] },
  ]);
  assert.deepEqual(parseProjectDescription(""), []);
  assert.deepEqual(parseProjectDescription("\n\n  \n"), []);
});

test("bullet characters other than a hyphen also open a list", () => {
  assert.deepEqual(parseProjectDescription("• First\n• Second"), [
    { id: "block-0", kind: "list", items: ["First", "Second"] },
  ]);
});

test("renders the heading, summary, facets, description and navigation", () => {
  const blocks: ProjectDescriptionBlock[] = parseProjectDescription(project().long_description);
  const html = buildProjectFragment(project(), blocks);

  assert.match(html, /^<main class="prerender-body prerender-project" id="prerender-body">/);
  assert.match(html, /<h1>BAI Finance Website<\/h1>/);
  assert.match(html, /<p class="prerender-lead">A professional digital platform/);
  assert.match(html, /<h2>Stack<\/h2><ul><li>next\.js<\/li><li>react<\/li><\/ul>/);
  assert.match(
    html,
    /<h2>Highlights<\/h2><ul><li>Live conversion<\/li><li>Loan calculators<\/li><\/ul>/,
  );
  assert.match(html, /<p>First paragraph\. Second line of it\.<\/p>/);
  assert.match(html, /<ul><li>One bullet<\/li><li>Two bullets<\/li><\/ul>/);
  assert.match(
    html,
    /<p class="prerender-project-link"><a href="https:\/\/www\.baifinance\.com\.au\/"/,
  );

  for (const link of PRERENDER_NAV_LINKS) {
    assert.ok(html.includes(`<a href="${link.href}">${link.label}</a>`), link.label);
  }
});

test("omits the facets, the link and the summary when the project has none", () => {
  const bare = project({
    short_description: "",
    project_link: "",
    stack: [],
    highlights: [],
    long_description: "",
  });
  const html = buildProjectFragment(bare, []);

  assert.doesNotMatch(html, /prerender-lead/);
  assert.doesNotMatch(html, /prerender-project-link/);
  assert.doesNotMatch(html, /<h2>Stack<\/h2>/);
  assert.doesNotMatch(html, /<h2>Highlights<\/h2>/);
  assert.match(html, /<h1>BAI Finance Website<\/h1>/);
});

test("drops a project link that is not absolute http(s)", () => {
  const html = buildProjectFragment(project({ project_link: "javascript:alert(1)" }), []);
  assert.doesNotMatch(html, /javascript:/);
  assert.doesNotMatch(html, /prerender-project-link/);
});

test("escapes every interpolated value", () => {
  const html = buildProjectFragment(
    project({
      title: "A & B <script>alert(1)</script>",
      short_description: "Quote \" and ' and >",
      stack: ["a<b"],
      highlights: ["c&d"],
      project_link: "https://example.test/?a=1&b=2",
    }),
    [{ id: "block-0", kind: "paragraph", text: "<img src=x onerror=alert(1)>" }],
  );

  assert.ok(!html.includes("<script>"));
  assert.ok(!html.includes("<img"));
  assert.match(html, /A &amp; B &lt;script&gt;/);
  assert.match(html, /Quote &quot; and &#39; and &gt;/);
  assert.match(html, /a&lt;b/);
  assert.match(html, /c&amp;d/);
  assert.match(html, /href="https:\/\/example\.test\/\?a=1&amp;b=2"/);
});

test("the fragment carries no script, style or image", () => {
  const html = buildProjectFragment(project(), parseProjectDescription(project().long_description));

  assert.doesNotMatch(html, /<script/i);
  assert.doesNotMatch(html, /<style/i);
  assert.doesNotMatch(html, /<img/i);
  assert.doesNotMatch(html, /\sstyle=/i);
});
