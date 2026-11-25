import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { getSocialPreviewMetadata, SOCIAL_PREVIEW_ROUTES } from "../src/data/socialPreview.ts";

const repositoryRoot = resolve(import.meta.dirname, "..", "..", "..");
const appRoot = resolve(repositoryRoot, "apps/portfolio-web");

/** Routes the sitemap advertises and the head must therefore size for. */
const INDEXABLE_PATHS = [
  "/",
  "/projects",
  "/certificates",
  "/snippets",
  "/ai",
  "/privacy-policy",
  "/terms-and-conditions",
] as const;

/** `_middleware.ts` and `GlobalHeadManager` both append this suffix. */
const TITLE_SUFFIX = " | Syn-Forge";

/** Terms the audit's click-through recommendation depends on. */
const REQUIRED_TERMS: ReadonlyArray<readonly [string, readonly string[]]> = [
  ["/", ["Developer"]],
  ["/projects", ["Projects"]],
  ["/certificates", ["Certif"]],
  ["/snippets", ["Snippets"]],
];

test("emitted titles sit in the 50-60 character SERP budget", () => {
  for (const pathname of INDEXABLE_PATHS) {
    const emitted = `${getSocialPreviewMetadata(pathname).title}${TITLE_SUFFIX}`;
    assert.ok(
      emitted.length >= 50 && emitted.length <= 60,
      `${pathname} title is ${emitted.length} chars: ${emitted}`,
    );
  }
});

test("indexable descriptions sit in the 120-155 character budget", () => {
  for (const pathname of INDEXABLE_PATHS) {
    const { description } = getSocialPreviewMetadata(pathname);
    assert.ok(
      description.length >= 120 && description.length <= 155,
      `${pathname} description is ${description.length} chars`,
    );
  }
});

test("titles keep the terms the pages already rank for", () => {
  for (const [pathname, terms] of REQUIRED_TERMS) {
    const title = getSocialPreviewMetadata(pathname).title;
    for (const term of terms) {
      assert.ok(title.toLowerCase().includes(term.toLowerCase()), `${pathname} lost "${term}"`);
    }
  }
});

// Structural guard, not a regression proof: every route already had an entry
// before this increment. It exists so a future route cannot ship without one.
test("every advertised route resolves to its own metadata entry", () => {
  const advertised = new Set(SOCIAL_PREVIEW_ROUTES.map((route) => route.pathname));
  for (const pathname of INDEXABLE_PATHS) assert.ok(advertised.has(pathname), pathname);
});

/**
 * The head has one owner. A page may only pass `title`/`description` when the
 * map cannot describe it. Three documented, conditional exceptions exist:
 *
 *  - `NotFound` — `getSocialPreviewMetadata("/unknown")` falls back to the home
 *    entry, so defaulting would advertise the home page on a 404.
 *  - `SnippetDocument` — a missing document would otherwise advertise the
 *    archive or a document that does not exist; its props are conditional on
 *    `isNotFound`, which the test below enforces.
 *  - `ProjectDetail` — the map has one entry per static route, so every project
 *    URL would otherwise advertise the archive's title and description; its props
 *    are conditional on the project having resolved, which the test below enforces.
 */
const HEAD_COPY_EXCEPTIONS = new Set([
  "src/components/pages/notFoundPage/NotFound.tsx",
  "src/components/pages/snippetsPage/SnippetDocument.tsx",
  "src/components/pages/projectsPage/ProjectDetail.tsx",
]);
test("no page passes head copy except the documented exceptions", async () => {
  const pagesRoot = resolve(appRoot, "src/components/pages");
  const files = (await readdir(pagesRoot, { recursive: true }))
    .filter((file) => file.endsWith(".tsx"))
    .map((file) => resolve(pagesRoot, file));

  const offenders: string[] = [];
  for (const file of files) {
    const source = await readFile(file, "utf8");
    // Only attributes on the opening tag count; `jsonLd={{ description: … }}`
    // and unrelated JSX such as `title={item.name}` must not match. Limit: this
    // matches a self-closing tag and would miss a `>` inside an attribute
    // value, so keep the call sites self-closing.
    const tags = source.match(/<GlobalHeadManager\b[^>]*?\/>/g) ?? [];
    const passesHeadCopy = tags.some((tag) => /\b(title|description)\s*=/.test(tag));
    if (!passesHeadCopy) continue;
    const relativePath = file.replace(`${appRoot}/`, "");
    if (HEAD_COPY_EXCEPTIONS.has(relativePath)) continue;
    offenders.push(relativePath);
  }

  assert.deepEqual(offenders, []);
});

// Structural guard: the 404 props predate this increment. It pins the documented
// exception so a later "no literals anywhere" refactor cannot silently give a
// 404 the home route's metadata.
test("the 404 route keeps its explicit non-indexable metadata", async () => {
  const source = await readFile(
    resolve(appRoot, "src/components/pages/notFoundPage/NotFound.tsx"),
    "utf8",
  );
  assert.match(source, /robots="noindex, nofollow"/);
  assert.match(source, /\btitle=/);
});

// A conditional exception must stay conditional: an unconditional literal in
// the document component would reintroduce exactly the drift this increment
// removed.
// A project page may only pass head copy for a resolved project; an unconditional literal would give a
// loading or failed page the archive's metadata.
test("the project-detail exception applies only to the resolved state", async () => {
  const source = await readFile(
    resolve(appRoot, "src/components/pages/projectsPage/ProjectDetail.tsx"),
    "utf8",
  );
  // The tag must sit inside the resolved-only branch, and its props must come from the project.
  assert.match(source, /\{project && canonicalPath \? \(\s*<GlobalHeadManager\b/);
  const tag = source.match(/<GlobalHeadManager\b[\s\S]*?\/>/)?.[0] ?? "";
  assert.match(tag, /\btitle=\{project\.title\}/);
  assert.match(tag, /\bdescription=\{projectPageDescription\(project\)\}/);
});

// The app root renders a head manager for every route; on a project path it must stand aside, or it
// overwrites the server's per-project head with the archive's before the page has a title to supply.
test("the root head manager leaves project paths to the page", async () => {
  const source = await readFile(
    resolve(appRoot, "src/components/globalHeadManager/GlobalHeadManager.tsx"),
    "utf8",
  );
  assert.match(source, /if \(title === undefined && parseProjectPath\(pagePath\)\) return;/);
});

test("the snippet-document exception applies only to the not-found state", async () => {
  const source = await readFile(
    resolve(appRoot, "src/components/pages/snippetsPage/SnippetDocument.tsx"),
    "utf8",
  );
  const tag = source.match(/<GlobalHeadManager\b[\s\S]*?\/>/)?.[0] ?? "";
  assert.match(tag, /title=\{isNotFound \?/);
  assert.match(tag, /description=\{isNotFound \?/);
  assert.match(tag, /robots=\{isNotFound \?/);
});
