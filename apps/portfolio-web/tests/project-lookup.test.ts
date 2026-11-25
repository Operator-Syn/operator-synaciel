import assert from "node:assert/strict";
import { test } from "node:test";
import { createFreshProjectPageFetcher } from "../functions/projectLookup.ts";
import { formatArchiveCount } from "../src/data/archiveCount.ts";
import {
  type ApiProject,
  collectAllProjects,
  createProjectPageFetcher,
  findProjectById,
  PROJECT_ARCHIVE_PAGE_SIZE,
  type ProjectPageFetcher,
  type ProjectPageResult,
  projectArchiveUrl,
  readProjectPageBody,
  toMediaItem,
} from "../src/data/projectArchive.ts";

/** One archive project. */
function project(id: number, title = `Project ${id}`): ApiProject {
  return {
    id,
    title,
    type: "image",
    url: `https://personal-portfolio-bucket.syn-forge.com/Projects/${id}.png`,
    short_description: `Summary ${id}`,
    long_description: `Long description ${id}`,
    project_link: `https://example.test/${id}`,
    categories: ["demo"],
    stack: ["typescript"],
    highlights: ["One highlight"],
    display_order: id,
    created_at: "2026-01-02 03:04:05",
    gallery: [],
  };
}

/** A page result, defaulting to a complete single page. */
function page(
  projects: readonly ApiProject[],
  options: {
    total?: number;
    hasMore?: boolean;
    nextCursor?: string | null;
    fromCache?: boolean;
  } = {},
): ProjectPageResult {
  return {
    ok: true,
    projects,
    total: options.total ?? projects.length,
    hasMore: options.hasMore ?? false,
    nextCursor: options.nextCursor ?? null,
    fromCache: options.fromCache ?? false,
  };
}

/** Serve responses in order and record the cursors requested. */
function scriptedFetcher(responses: readonly ProjectPageResult[]): {
  fetchPage: ProjectPageFetcher;
  cursors: Array<string | null>;
} {
  const cursors: Array<string | null> = [];
  let index = 0;

  return {
    cursors,
    fetchPage: async (cursor) => {
      cursors.push(cursor);
      const response = responses[Math.min(index, responses.length - 1)];
      index += 1;
      return response;
    },
  };
}

test("builds the archive URL the archive page and the walk both use", () => {
  assert.equal(
    projectArchiveUrl("https://host/api", null),
    `https://host/api/v2/projects/archive?limit=${PROJECT_ARCHIVE_PAGE_SIZE}`,
  );
  assert.equal(
    projectArchiveUrl("https://host/api/", "abc"),
    `https://host/api/v2/projects/archive?limit=${PROJECT_ARCHIVE_PAGE_SIZE}&cursor=abc`,
  );
});

test("reads one page and skips entries that are not projects", () => {
  const body = JSON.stringify({
    data: [
      { id: 8, title: "BAI Finance Website", stack: ["next.js"], categories: ["fintech"] },
      { id: "9", title: "Not a project" },
      { id: 10 },
      null,
    ],
    pagination: { limit: 12, total: 3, has_more: false, next_cursor: null },
  });

  const parsed = readProjectPageBody(body);
  assert.ok(parsed);
  assert.equal(parsed.projects.length, 1);
  assert.equal(parsed.projects[0].id, 8);
  assert.deepEqual(parsed.projects[0].stack, ["next.js"]);
  assert.deepEqual(parsed.projects[0].categories, ["fintech"]);
  assert.equal(parsed.total, 3);
});

test("treats a body without a usable data array or pagination as unreadable", () => {
  assert.equal(readProjectPageBody("not json"), null);
  assert.equal(readProjectPageBody('{"data":[]}'), null);
  assert.equal(readProjectPageBody('{"data":{},"pagination":{"total":0,"has_more":false}}'), null);
  assert.equal(readProjectPageBody('{"data":[],"pagination":{"has_more":false}}'), null);
});

test("finds a project on the first page", async () => {
  const { fetchPage } = scriptedFetcher([page([project(8), project(9)])]);
  const lookup = await findProjectById(fetchPage, 9);

  assert.equal(lookup.status, "found");
  if (lookup.status === "found") assert.equal(lookup.project.id, 9);
});

test("reports absence only from a complete fresh read", async () => {
  const { fetchPage } = scriptedFetcher([page([project(8), project(9)])]);
  const lookup = await findProjectById(fetchPage, 999);

  assert.equal(lookup.status, "missing");
});

test("reports unknown when the read did not cover the whole collection", async () => {
  const { fetchPage } = scriptedFetcher([
    {
      ok: true,
      projects: [project(8)],
      total: 20,
      hasMore: true,
      nextCursor: "c1",
      fromCache: false,
    },
  ]);

  const lookup = await findProjectById(fetchPage, 999);
  assert.equal(lookup.status, "unknown");
  if (lookup.status === "unknown") assert.match(lookup.reason, /short page/);
});

test("reports unknown for a page served from the cache", async () => {
  const { fetchPage, cursors } = scriptedFetcher([page([project(8)], { fromCache: true })]);
  const lookup = await findProjectById(fetchPage, 8);

  assert.equal(lookup.status, "unknown");
  if (lookup.status === "unknown") assert.match(lookup.reason, /cache/);
  assert.deepEqual(cursors, [null]);
});

test("reports unknown when the transport, the status or the body fails", async () => {
  for (const failure of [
    { ok: false as const, reason: "timeout" },
    { ok: false as const, reason: "http 503" },
    { ok: false as const, reason: "malformed body" },
  ]) {
    const { fetchPage } = scriptedFetcher([failure]);
    const lookup = await findProjectById(fetchPage, 8);
    assert.equal(lookup.status, "unknown", failure.reason);
  }
});

test("reports unknown when the reported total changes mid-walk", async () => {
  const { fetchPage } = scriptedFetcher([
    {
      ok: true,
      projects: Array.from({ length: 12 }, (_, index) => project(index + 1)),
      total: 24,
      hasMore: true,
      nextCursor: "c1",
      fromCache: false,
    },
    {
      ok: true,
      projects: Array.from({ length: 12 }, (_, index) => project(index + 13)),
      total: 25,
      hasMore: false,
      nextCursor: null,
      fromCache: false,
    },
  ]);

  const lookup = await findProjectById(fetchPage, 999);
  assert.equal(lookup.status, "unknown");
  if (lookup.status === "unknown") assert.match(lookup.reason, /total changed/);
});

test("reports unknown when the walk sees fewer projects than the total", async () => {
  const { fetchPage } = scriptedFetcher([
    {
      ok: true,
      projects: Array.from({ length: 12 }, (_, index) => project(index + 1)),
      total: 20,
      hasMore: true,
      nextCursor: "c1",
      fromCache: false,
    },
    {
      ok: true,
      projects: [project(1), project(2)],
      total: 20,
      hasMore: false,
      nextCursor: null,
      fromCache: false,
    },
  ]);

  const lookup = await findProjectById(fetchPage, 999);
  assert.equal(lookup.status, "unknown");
  if (lookup.status === "unknown") assert.match(lookup.reason, /saw 12 of 20/);
});

test("reports unknown when a cursor repeats", async () => {
  const full = Array.from({ length: 12 }, (_, index) => project(index + 1));
  const { fetchPage, cursors } = scriptedFetcher([
    { ok: true, projects: full, total: 100, hasMore: true, nextCursor: "c1", fromCache: false },
    { ok: true, projects: full, total: 100, hasMore: true, nextCursor: "c1", fromCache: false },
  ]);

  const lookup = await findProjectById(fetchPage, 999);
  assert.equal(lookup.status, "unknown");
  if (lookup.status === "unknown") assert.match(lookup.reason, /repeated/);
  assert.equal(cursors.length, 2);
});

test("walks five pages and finds a project on the last one", async () => {
  const responses: ProjectPageResult[] = [];
  for (let pageIndex = 0; pageIndex < 5; pageIndex += 1) {
    const projects = Array.from({ length: 12 }, (_, index) => project(pageIndex * 12 + index + 1));
    responses.push({
      ok: true,
      projects,
      total: 60,
      hasMore: pageIndex < 4,
      nextCursor: pageIndex < 4 ? `c${pageIndex + 1}` : null,
      fromCache: false,
    });
  }

  const { fetchPage, cursors } = scriptedFetcher(responses);
  const lookup = await findProjectById(fetchPage, 60);

  assert.equal(lookup.status, "found");
  assert.equal(cursors.length, 5);
});

test("rejects a walk that outlives the page count its reported total implies", async () => {
  const responses: ProjectPageResult[] = [];
  for (let pageIndex = 0; pageIndex < 5; pageIndex += 1) {
    responses.push({
      ok: true,
      projects: Array.from({ length: 12 }, (_, index) => project(pageIndex * 12 + index + 1)),
      total: 60,
      hasMore: true,
      nextCursor: `c${pageIndex + 1}`,
      fromCache: false,
    });
  }

  const { fetchPage, cursors } = scriptedFetcher(responses);
  const lookup = await findProjectById(fetchPage, 999);

  assert.equal(lookup.status, "unknown");
  if (lookup.status === "unknown") assert.match(lookup.reason, /page count its total implies/);
  assert.equal(cursors.length, 5);
});

test("rejects a page wider than the requested limit", async () => {
  const { fetchPage } = scriptedFetcher([
    page(
      Array.from({ length: 13 }, (_, index) => project(index + 1)),
      { total: 13 },
    ),
  ]);

  const lookup = await findProjectById(fetchPage, 999);
  assert.equal(lookup.status, "unknown");
  if (lookup.status === "unknown") assert.match(lookup.reason, /wider than the requested limit/);
});

test("rejects a walk that sees more distinct projects than the reported total", async () => {
  const { fetchPage } = scriptedFetcher([
    page(
      Array.from({ length: 12 }, (_, index) => project(index + 1)),
      { total: 5 },
    ),
  ]);

  const lookup = await findProjectById(fetchPage, 999);
  assert.equal(lookup.status, "unknown");
  if (lookup.status === "unknown")
    assert.match(lookup.reason, /more projects than the reported total/);
});

test("stops at the hard page ceiling instead of walking forever", async () => {
  const full = Array.from({ length: 12 }, (_, index) => project(index + 1));
  const responses: ProjectPageResult[] = [];
  for (let pageIndex = 0; pageIndex < 20; pageIndex += 1) {
    responses.push({
      ok: true,
      projects: full,
      total: 121,
      hasMore: true,
      nextCursor: `c${pageIndex + 1}`,
      fromCache: false,
    });
  }

  const { fetchPage, cursors } = scriptedFetcher(responses);
  const lookup = await findProjectById(fetchPage, 999);

  assert.equal(lookup.status, "unknown");
  if (lookup.status === "unknown") assert.match(lookup.reason, /10 pages/);
  assert.equal(cursors.length, 10);
});

test("collects the whole collection for the sitemap and the ItemList", async () => {
  const { fetchPage } = scriptedFetcher([page([project(8), project(9), project(10)])]);
  const collection = await collectAllProjects(fetchPage);

  assert.equal(collection.ok, true);
  if (collection.ok)
    assert.deepEqual(
      collection.projects.map((entry) => entry.id),
      [8, 9, 10],
    );
});

test("the cached enumerator accepts pages that came from the cache", async () => {
  const { fetchPage } = scriptedFetcher([page([project(8)], { fromCache: true })]);
  const collection = await collectAllProjects(fetchPage);

  assert.equal(collection.ok, true);
});

test("the cached enumerator fails on an unreachable collection", async () => {
  const { fetchPage } = scriptedFetcher([{ ok: false, reason: "http 503" }]);
  const collection = await collectAllProjects(fetchPage);

  assert.equal(collection.ok, false);
  if (!collection.ok) assert.match(collection.reason, /503/);
});

test("maps an API project onto the archive media shape", () => {
  const item = toMediaItem({
    ...project(8, "BAI Finance Website"),
    gallery: [{ id: 1, project_id: 8, type: "video", url: "https://x/1.mp4", display_order: 1 }],
  });

  assert.equal(item.id, 8);
  assert.equal(item.title, "BAI Finance Website");
  assert.equal(item.shortDescription, "Summary 8");
  assert.equal(item.projectLink, "https://example.test/8");
  assert.deepEqual(item.gallery, [{ type: "video", url: "https://x/1.mp4" }]);
});

test("the archive count line still adds its future-project slot", () => {
  assert.equal(formatArchiveCount(7, "projects"), "[ 8 projects ]");
});

/**
 * The bypass test the plan names as the proof.
 *
 * Both cases read the same stale, complete body from the platform cache — one that does not contain the
 * requested id. With the cache in play the lookup answers `missing`; with `NO_CACHE` it must reach the
 * origin, see the fresh list, and answer `found`. If someone replaces `NO_CACHE` with `undefined`, this
 * test flips to `missing`, which is exactly the false 404 the bypass exists to prevent.
 */
test("the no-op cache forces a fresh read while the default cache would answer from the stale body", async () => {
  const staleBody = JSON.stringify({
    data: [{ id: 8, title: "BAI Finance Website" }],
    pagination: { limit: 12, total: 1, has_more: false, next_cursor: null },
  });
  const freshBody = JSON.stringify({
    data: [
      { id: 8, title: "BAI Finance Website" },
      { id: 9, title: "BAI HR" },
    ],
    pagination: { limit: 12, total: 2, has_more: false, next_cursor: null },
  });

  const matches: string[] = [];
  const cache = {
    async match(key: Request) {
      matches.push(key.url);
      return new Response(staleBody, { status: 200 });
    },
    async put() {
      return undefined;
    },
  };
  const globals = globalThis as unknown as { caches?: unknown };
  const original = globals.caches;
  globals.caches = { default: cache };

  try {
    let originCalls = 0;
    const fetchContent = (async () => {
      originCalls += 1;
      return new Response(freshBody, { status: 200 });
    }) as unknown as typeof fetch;

    // Default cache: the stale body answers, the origin is never called, and the walk refuses to
    // treat a cached page as evidence — so the answer is `unknown`, never a false `missing`.
    const cached = createProjectPageFetcher({ base: "https://host/api", fetchContent });
    const cachedPage = await cached(null);
    assert.equal(cachedPage.ok, true);
    if (cachedPage.ok) assert.equal(cachedPage.fromCache, true);
    assert.equal(originCalls, 0);
    assert.equal(matches.length, 1);

    const cachedLookup = await findProjectById(cached, 9);
    assert.equal(cachedLookup.status, "unknown");

    const cacheReadsBeforeBypass = matches.length;
    assert.equal(cacheReadsBeforeBypass, 2, "both cached reads consulted the platform cache");

    // Explicit no-op cache: the read reaches the origin, which knows about id 9, so the page is
    // found and stays indexable. Without the bypass this branch could only ever answer `unknown`.
    // This uses the production helper, so replacing its NO_CACHE with `undefined` fails this test.
    const fresh = createFreshProjectPageFetcher("https://host/api", fetchContent);
    const freshPage = await fresh(null);
    assert.equal(freshPage.ok, true);
    if (freshPage.ok) assert.equal(freshPage.fromCache, false);
    assert.equal(originCalls, 1);

    const freshLookup = await findProjectById(fresh, 9);
    assert.equal(freshLookup.status, "found");
    assert.equal(
      matches.length,
      cacheReadsBeforeBypass,
      "the no-op cache must not consult the platform cache",
    );
  } finally {
    if (original === undefined) delete globals.caches;
    else globals.caches = original;
  }
});

test("the page fetcher parses the body the API returns", async () => {
  const body = JSON.stringify({
    data: [{ id: 8, title: "BAI Finance Website" }],
    pagination: { limit: 12, total: 1, has_more: false, next_cursor: null },
  });

  const fetcher = createProjectPageFetcher({
    base: "https://host/api",
    fetchContent: async () => new Response(body, { status: 200 }),
    cache: { match: async () => undefined, put: async () => undefined },
  });

  const result = await fetcher(null);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.projects.length, 1);
    assert.equal(result.fromCache, false);
  }
});
