import assert from "node:assert/strict";
import { test } from "node:test";
import { createCanonicalRouteRedirect } from "../functions/canonicalRedirect.ts";
import {
  isCanonicalProjectPath,
  matchesProjectPath,
  parseProjectPath,
  projectPageDescription,
  projectPath,
  projectPrerenderSlug,
  projectSlug,
  safeExternalHref,
} from "../src/data/projectRoutes.ts";

/** The seven live titles, as the archive serves them. */
const LIVE_TITLES = [
  "BAI Finance Website",
  "BAI HR",
  "BAI Group Website",
  "The Hootline",
  "Simple Student Information System (CSV Version)",
  "Simple Student Information System (MySQL Version)",
  "Bilingual NLU Intent Engine (Retrieval-Based)",
];

test("derives a lowercase ASCII slug from every live title", () => {
  const expected = [
    "bai-finance-website",
    "bai-hr",
    "bai-group-website",
    "the-hootline",
    "simple-student-information-system-csv-version",
    "simple-student-information-system-mysql-version",
    "bilingual-nlu-intent-engine-retrieval-based",
  ];

  assert.deepEqual(LIVE_TITLES.map(projectSlug), expected);

  for (const slug of expected) {
    assert.match(slug, /^[a-z0-9-]+$/);
    assert.equal(slug, slug.toLowerCase());
  }
});

test("strips accents and collapses punctuation", () => {
  assert.equal(projectSlug("Café — Résumé"), "cafe-resume");
  assert.equal(projectSlug("  Data   Pipelines  "), "data-pipelines");
});

test("falls back to a non-empty slug when the title has no alphanumerics", () => {
  assert.equal(projectSlug("!!!"), "project");
  assert.equal(projectSlug(""), "project");
});

test("builds the canonical detail path with an encoded, lowercase slug", () => {
  assert.equal(projectPath(8, "BAI Finance Website"), "/projects/8/bai-finance-website");
  assert.equal(projectPath(7, "Café — Résumé"), "/projects/7/cafe-resume");
});

test("parses both detail forms and normalises a trailing slash", () => {
  assert.deepEqual(parseProjectPath("/projects/8/bai-finance-website"), {
    id: 8,
    idText: "8",
    slugText: "bai-finance-website",
  });
  assert.deepEqual(parseProjectPath("/projects/8"), { id: 8, idText: "8", slugText: null });
  assert.deepEqual(parseProjectPath("/projects/8/"), { id: 8, idText: "8", slugText: null });
  assert.deepEqual(parseProjectPath("/projects/8/bai-finance-website/"), {
    id: 8,
    idText: "8",
    slugText: "bai-finance-website",
  });
  // The slug is kept encoded: whether the spelling is canonical is decided on the raw text.
  assert.deepEqual(parseProjectPath("/projects/8/caf%C3%A9"), {
    id: 8,
    idText: "8",
    slugText: "caf%C3%A9",
  });
});

test("keeps the id segment exactly as written, so its spelling stays visible to the caller", () => {
  assert.equal(parseProjectPath("/projects/08")?.id, 8);
  assert.equal(parseProjectPath("/projects/08")?.idText, "08");
  assert.equal(parseProjectPath("/projects/0008/bai-finance-website")?.idText, "0008");
});

test("rejects paths that are not detail paths", () => {
  const rejected = [
    "/projects",
    "/projects/",
    "/projects/garbage",
    "/projects/garbage/x",
    "/projects/8/x/y",
    "/projects/0/slug",
    "/projects/-1/slug",
    "/snippets/8/slug",
  ];

  for (const pathname of rejected) {
    assert.equal(parseProjectPath(pathname), null, pathname);
    assert.equal(matchesProjectPath(pathname), false, pathname);
  }
});

test("accepts the two detail forms through the route matcher", () => {
  assert.equal(matchesProjectPath("/projects/8"), true);
  assert.equal(matchesProjectPath("/projects/8/bai-finance-website"), true);
});

test("decides canonicality from the slug and the id text together", () => {
  const project = { id: 8, title: "BAI Finance Website" };
  const canonical = parseProjectPath("/projects/8/bai-finance-website");
  assert.ok(canonical);
  assert.equal(isCanonicalProjectPath(project, canonical), true);

  for (const pathname of [
    "/projects/8",
    "/projects/8/old-slug",
    "/projects/08/bai-finance-website",
    "/projects/0008/bai-finance-website",
    "/projects/8/%62ai-finance-website",
    "/projects/8/b%61i-finance-website",
    "/projects/8/bai%2Dfinance-website",
    "/projects/8/bai-finance-website%20",
  ]) {
    const parsed = parseProjectPath(pathname);
    assert.ok(parsed, pathname);
    assert.equal(isCanonicalProjectPath(project, parsed), false, pathname);
  }
});

test("the generated path is a fixed point of the canonical redirect", () => {
  for (const title of LIVE_TITLES) {
    const path = projectPath(8, title);
    assert.equal(
      createCanonicalRouteRedirect(`https://syn-forge.com${path}`),
      null,
      `${title} must not redirect to itself`,
    );
  }
});

test("clamps the advertised description to the shared 155-character ceiling", () => {
  const short = { short_description: "A short summary." };
  assert.equal(projectPageDescription(short), "A short summary.");

  const long = { short_description: "word ".repeat(60).trim() };
  const clamped = projectPageDescription(long);
  assert.ok(clamped.length <= 155, `description is ${clamped.length} chars`);
  assert.ok(clamped.endsWith("…"));
});

test("allows only an absolute http(s) project link", () => {
  assert.equal(safeExternalHref("https://example.test/x"), "https://example.test/x");
  assert.equal(safeExternalHref("http://example.test"), "http://example.test/");
  assert.equal(safeExternalHref("javascript:alert(1)"), undefined);
  assert.equal(safeExternalHref("data:text/html,<script>"), undefined);
  assert.equal(safeExternalHref("/relative"), undefined);
  assert.equal(safeExternalHref(""), undefined);
});

test("names the fragment by id, independent of the slug", () => {
  assert.equal(projectPrerenderSlug(8), "project-8");
  assert.equal(projectPrerenderSlug(8), projectPrerenderSlug(8));
});
