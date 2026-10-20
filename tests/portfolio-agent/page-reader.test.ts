import assert from "node:assert/strict";
import { test } from "node:test";
import {
  type CachedPortfolioPage,
  createReadPortfolioPageTool,
  createSqlPortfolioPageCache,
  DEFAULT_PAGE_CHUNK_CHARACTERS,
  ensurePortfolioPageCacheSchema,
  MAX_PAGE_CHUNK_CHARACTERS,
  MAX_PAGE_TEXT_CHARACTERS,
  normalizePortfolioPageText,
  type PageCacheSql,
  type PortfolioPageCache,
  type RenderedPortfolioPage,
  readPortfolioPage,
  validatePortfolioPagePath,
} from "../../workers/portfolio-agent/src/page-reader.ts";

function memoryCache(initial: CachedPortfolioPage | null = null) {
  const state = { page: initial, gets: 0, sets: 0, prunes: 0 };
  const cache: PortfolioPageCache = {
    get() {
      state.gets += 1;
      return state.page;
    },
    set(_pageUrl, page) {
      state.sets += 1;
      state.page = page;
    },
    prune() {
      state.prunes += 1;
    },
  };
  return { cache, state };
}

function fixedRenderer(page: RenderedPortfolioPage, calls: { count: number }) {
  return async () => {
    calls.count += 1;
    return page;
  };
}

test("restricts page reads to exact same-origin paths", () => {
  for (const path of [
    "/",
    "/ai",
    "/snippets",
    "/snippets/document/12/example-post",
    "/privacy-policy",
    "/foo/bar/",
  ]) {
    assert.deepEqual(validatePortfolioPagePath(path), {
      path,
      url: `https://syn-forge.com${path}`,
    });
  }

  for (const path of [
    "https://syn-forge.com/ai",
    "//syn-forge.com/ai",
    "/../secret",
    "/a/../b",
    "/a//b",
    "/a\\b",
    "/a?x=1",
    "/a#x",
    "/%2e%2e/secret",
    "/%2f%2fevil",
    "/%5c",
    "/a/%252e%252e/b",
    "/\u0000",
    "www.syn-forge.com",
    123,
    null,
  ]) {
    assert.equal(validatePortfolioPagePath(path), null);
  }
});

test("normalizes rendered page whitespace", () => {
  assert.equal(normalizePortfolioPageText("  a\r\n\r\n\r\n  b \n"), "a\n\n  b");
});

test("reads a rendered page and caches it", async () => {
  const { cache, state } = memoryCache();
  const calls = { count: 0 };
  const render = fixedRenderer(
    {
      title: "AI and MCP Access",
      text: "Portfolio, readable by agents.",
      finalUrl: "https://syn-forge.com/ai",
    },
    calls,
  );

  const first = await readPortfolioPage({ path: "/ai" }, { render, cache, now: () => 1_000 });
  assert.equal(first.ok, true);
  if (!first.ok) return;
  assert.deepEqual(first.payload, {
    path: "/ai",
    page_url: "https://syn-forge.com/ai",
    title: "AI and MCP Access",
    content: "Portfolio, readable by agents.",
    offset: 0,
    next_offset: 30,
    total_characters: 30,
    complete: true,
  });
  assert.equal(calls.count, 1);
  assert.equal(state.sets, 1);
  assert.equal(state.prunes, 1);

  const second = await readPortfolioPage({ path: "/ai" }, { render, cache, now: () => 1_000 });
  assert.equal(second.ok, true);
  assert.equal(calls.count, 1);
  assert.equal(state.gets, 2);
});

test("paginates pages beyond the default chunk without truncating the page", async () => {
  const text = "x".repeat(40_000);
  const { cache } = memoryCache();
  const calls = { count: 0 };
  const render = fixedRenderer(
    { title: "Long page", text, finalUrl: "https://syn-forge.com/snippets/document/12/post" },
    calls,
  );

  const first = await readPortfolioPage({ path: "/snippets/document/12/post" }, { render, cache });
  assert.equal(first.ok, true);
  if (!first.ok) return;
  assert.equal(first.payload.content.length, DEFAULT_PAGE_CHUNK_CHARACTERS);
  assert.equal(first.payload.next_offset, DEFAULT_PAGE_CHUNK_CHARACTERS);
  assert.equal(first.payload.total_characters, 40_000);
  assert.equal(first.payload.complete, false);

  const second = await readPortfolioPage(
    { path: "/snippets/document/12/post", offset: first.payload.next_offset },
    { render, cache },
  );
  assert.equal(second.ok, true);
  if (!second.ok) return;
  assert.equal(second.payload.offset, DEFAULT_PAGE_CHUNK_CHARACTERS);
  assert.equal(second.payload.next_offset, DEFAULT_PAGE_CHUNK_CHARACTERS * 2);
  assert.equal(second.payload.complete, false);

  const last = await readPortfolioPage(
    { path: "/snippets/document/12/post", offset: DEFAULT_PAGE_CHUNK_CHARACTERS * 3 },
    { render, cache },
  );
  assert.equal(last.ok, true);
  if (!last.ok) return;
  assert.equal(last.payload.content.length, 4_000);
  assert.equal(last.payload.complete, true);

  const largest = await readPortfolioPage(
    { path: "/snippets/document/12/post", maxChars: MAX_PAGE_CHUNK_CHARACTERS },
    { render, cache },
  );
  assert.equal(largest.ok, true);
  if (!largest.ok) return;
  assert.equal(largest.payload.content.length, MAX_PAGE_CHUNK_CHARACTERS);
  assert.equal(calls.count, 1);
});

test("rejects failed renders, empty pages, off-origin redirects, and oversized text", async () => {
  const invalidPath = await readPortfolioPage(
    { path: "https://example.com" },
    {
      render: async () => ({ title: "x", text: "x", finalUrl: "https://example.com" }),
      cache: memoryCache().cache,
    },
  );
  assert.equal(invalidPath.ok, false);
  if (invalidPath.ok) return;
  assert.equal(invalidPath.code, "INVALID_PATH");

  const renderFailed = await readPortfolioPage(
    { path: "/ai" },
    {
      render: async () => {
        throw new Error("render failed");
      },
      cache: memoryCache().cache,
    },
  );
  assert.equal(renderFailed.ok, false);
  if (renderFailed.ok) return;
  assert.equal(renderFailed.code, "PAGE_RENDER_FAILED");

  const empty = await readPortfolioPage(
    { path: "/ai" },
    {
      render: async () => ({ title: "AI", text: "   ", finalUrl: "https://syn-forge.com/ai" }),
      cache: memoryCache().cache,
    },
  );
  assert.equal(empty.ok, false);
  if (empty.ok) return;
  assert.equal(empty.code, "PAGE_EMPTY");

  const offOrigin = await readPortfolioPage(
    { path: "/ai" },
    {
      render: async () => ({ title: "AI", text: "Text", finalUrl: "https://example.com/ai" }),
      cache: memoryCache().cache,
    },
  );
  assert.equal(offOrigin.ok, false);
  if (offOrigin.ok) return;
  assert.equal(offOrigin.code, "PAGE_OFF_ORIGIN");

  const oversized = await readPortfolioPage(
    { path: "/ai" },
    {
      render: async () => ({
        title: "AI",
        text: "x".repeat(MAX_PAGE_TEXT_CHARACTERS + 1),
        finalUrl: "https://syn-forge.com/ai",
      }),
      cache: memoryCache().cache,
    },
  );
  assert.equal(oversized.ok, false);
  if (oversized.ok) return;
  assert.equal(oversized.code, "PAGE_TOO_LARGE");
});

test("limits page reads per turn and returns the MCP-shaped result", async () => {
  const { cache } = memoryCache();
  const calls = { count: 0 };
  const pageTool = createReadPortfolioPageTool({
    render: fixedRenderer(
      { title: "AI", text: "Portfolio text", finalUrl: "https://syn-forge.com/ai" },
      calls,
    ),
    cache,
    maxReadsPerTurn: 2,
  });
  const execute = pageTool.execute;
  assert.ok(execute);

  const first = await execute({ path: "/ai" }, { toolCallId: "1", messages: [] } as never);
  const firstStructured = first as {
    isError?: boolean;
    structuredContent?: { page_url?: string; content?: string };
  };
  assert.equal(firstStructured.isError, undefined);
  assert.equal(firstStructured.structuredContent?.page_url, "https://syn-forge.com/ai");
  assert.equal(firstStructured.structuredContent?.content, "Portfolio text");

  await execute({ path: "/ai" }, { toolCallId: "2", messages: [] } as never);
  const limited = await execute({ path: "/ai" }, { toolCallId: "3", messages: [] } as never);
  const limitedStructured = limited as {
    isError?: boolean;
    structuredContent?: { error?: { code?: string } };
  };
  assert.equal(limitedStructured.isError, true);
  assert.equal(limitedStructured.structuredContent?.error?.code, "PAGE_READ_LIMIT");
});

test("stores, expires, and prunes SQL cache rows", () => {
  const queries: Array<{ query: string[]; values: Array<string | number> }> = [];
  let now = 1_000_000;
  const sql: PageCacheSql = (query, ...values) => {
    queries.push({ query, values });
    if (query[0]?.startsWith("SELECT") === true) {
      return [
        {
          final_url: "https://syn-forge.com/ai",
          title: "AI",
          content: "Portfolio text",
          fetched_at: 1_000_000,
        },
      ];
    }
    return [];
  };

  ensurePortfolioPageCacheSchema(sql);
  const cache = createSqlPortfolioPageCache(sql, () => now);
  const cached = cache.get("https://syn-forge.com/ai");
  assert.equal(cached?.title, "AI");
  assert.equal(cached?.pageUrl, "https://syn-forge.com/ai");

  cache.set("https://syn-forge.com/ai", {
    pageUrl: "https://syn-forge.com/ai",
    title: "AI",
    text: "Portfolio text",
    fetchedAt: now,
  });
  cache.prune(now);

  now += 60 * 60 * 1_000 + 1;
  assert.equal(cache.get("https://syn-forge.com/ai"), null);

  assert.ok(queries.some(({ query }) => query[0]?.includes("CREATE TABLE") === true));
  assert.ok(queries.some(({ query }) => query[0]?.includes("INSERT INTO") === true));
  assert.equal(
    queries.filter(({ query }) => query[0]?.startsWith("DELETE FROM") === true).length,
    2,
  );
});
