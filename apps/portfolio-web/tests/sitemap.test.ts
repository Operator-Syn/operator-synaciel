import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import type { ContentCache } from "../functions/contentFetch.ts";
import { SITEMAP_STATIC_ROUTES } from "../src/data/canonicalRoutes.ts";
import { STATIC_ROUTE_LASTMOD } from "../src/data/contentDates.ts";
import { projectPath } from "../src/data/projectRoutes.ts";
import { createSitemapResponse, SITEMAP_LAST_GOOD_URL } from "../src/data/sitemap.ts";

const EDGE_CACHE_CONTROL = "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400";

const request = new Request("https://preview.example/sitemap.xml");
const apiUrl = "https://api.example/api";
const file = (id: number, name: string, modified = "2026-10-05 01:02:03") => ({
  id,
  name,
  type: "file",
  modified,
});

/** One archive page carrying the given projects. */
const projectPage = (projects: unknown[] = []) => ({
  data: projects,
  pagination: { limit: 12, total: projects.length, has_more: false, next_cursor: null },
});

/** One archive page, by cursor, for multi-page fixtures. */
type ArchivePage = {
  readonly projects: unknown[];
  readonly total: number;
  readonly hasMore: boolean;
  readonly nextCursor: string | null;
};

/**
 * Answer the snippet tree and a cursor-addressed set of project pages.
 *
 * The single-page helper below cannot express a walk, and the sitemap's completeness claim is about
 * enumerating the whole archive, so this variant keys pages by the cursor the sitemap sends.
 */
function pagedSitemapFetch(
  snippetBody: unknown,
  pages: ReadonlyMap<string | null, ArchivePage>,
): typeof fetch {
  return (async (input: string | URL | Request, options?: RequestInit) => {
    const url = String(input);
    assert.equal(options?.cache, "no-store");
    assert.ok(options?.signal);
    if (url.startsWith(`${apiUrl}/v2/projects/archive`)) {
      const cursor = new URL(url).searchParams.get("cursor");
      const page = pages.get(cursor);
      assert.ok(page, `unexpected project cursor: ${cursor}`);
      return Response.json({
        data: page.projects,
        pagination: {
          limit: 12,
          total: page.total,
          has_more: page.hasMore,
          next_cursor: page.nextCursor,
        },
      });
    }
    if (url === `${apiUrl}/snippets`) return Response.json(snippetBody);
    throw new Error(`unexpected fetch: ${url}`);
  }) as unknown as typeof fetch;
}

/**
 * Answer both endpoints the sitemap reads.
 *
 * The sitemap fetches the snippet tree and the project archive. A stub that returns the snippet shape to
 * both URLs makes the project parse fail and turns every test into a 503, so the stub is URL-aware and
 * keeps the transport assertions the suite relies on.
 */
function sitemapFetch(snippetBody: unknown, projects: unknown[] = []): typeof fetch {
  return (async (input: string | URL | Request, options?: RequestInit) => {
    const url = String(input);
    assert.equal(options?.cache, "no-store");
    assert.ok(options?.signal);
    if (url.startsWith(`${apiUrl}/v2/projects/archive`)) {
      return Response.json(projectPage(projects));
    }
    if (url === `${apiUrl}/snippets`) return Response.json(snippetBody);
    throw new Error(`unexpected fetch: ${url}`);
  }) as unknown as typeof fetch;
}

test("sitemap reflects additions, renames, edits and deletions on consecutive requests", async () => {
  let data: unknown[] = [file(1, "Old Name.md")];
  const read = async () => {
    // Built per read: the stub captures the tree, and this test mutates it between requests.
    const response = await createSitemapResponse(
      request,
      `${apiUrl}/`,
      sitemapFetch({ success: true, data }),
    );
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), EDGE_CACHE_CONTROL);
    assert.equal(response.headers.get("content-type"), "application/xml; charset=utf-8");
    return response.text();
  };
  assert.match(await read(), /\/1\/old-name.md/);
  data = [
    {
      id: 3,
      name: "Folder",
      type: "dir",
      children: [file(1, "Renamed.md", "2026-10-05 02:03:04"), file(2, "New.pdf")],
    },
  ];
  const updated = await read();
  assert.doesNotMatch(updated, /old-name/);
  assert.match(updated, /\/1\/renamed.md/);
  assert.match(updated, /\/2\/new.pdf/);
  assert.match(updated, /<lastmod>2026-10-05T02:03:04.000Z<\/lastmod>/);
  assert.doesNotMatch(updated, /preview.example|Folder/);
  data = [];
  const deleted = await read();
  assert.doesNotMatch(deleted, /snippets\/document/);
  assert.match(deleted, /<loc>https:\/\/syn-forge.com\/<\/loc>/);
  assert.match(deleted, /<loc>https:\/\/syn-forge.com\/projects<\/loc>/);
});

test("sitemap rejects upstream failures when no last-known-good copy exists", async () => {
  const failures: (typeof fetch)[] = [
    async () => new Response(null, { status: 500 }),
    async () => {
      throw new Error("Network unavailable");
    },
    async () => {
      throw new DOMException("Timed out", "AbortError");
    },
    async () => new Response("invalid json"),
    async () => Response.json({}),
    async () => Response.json({ data: [{ id: 1, name: "file" }] }),
    async () => Response.json({ data: [{ id: -1, name: "file", type: "file" }] }),
    async () => Response.json({ data: [{ id: 1, name: "Folder", type: "dir", children: {} }] }),
  ];
  for (const fetchContent of failures) {
    const response = await createSitemapResponse(request, apiUrl, fetchContent);
    assert.equal(response.status, 503);
    assert.equal(response.headers.get("content-type"), "text/plain; charset=utf-8");
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("retry-after"), "60");
    assert.doesNotMatch(await response.text(), /<urlset>/);
  }
  assert.equal((await createSitemapResponse(request, undefined)).status, 503);
});

test("sitemap supports HEAD and rejects writes without calling the content API", async () => {
  const fetchContent = sitemapFetch({ data: [file(1, "Notes.md")] });
  const head = await createSitemapResponse(
    new Request(request, { method: "HEAD" }),
    apiUrl,
    fetchContent,
  );
  assert.equal(head.status, 200);
  assert.equal(await head.text(), "");
  const post = await createSitemapResponse(
    new Request(request, { method: "POST" }),
    apiUrl,
    async () => {
      assert.fail("Writes must not fetch content");
    },
  );
  assert.equal(post.status, 405);
  assert.equal(post.headers.get("allow"), "GET, HEAD");
});

test("sitemap omits invalid modification dates and deduplicates document entries", async () => {
  const response = await createSitemapResponse(
    request,
    apiUrl,
    sitemapFetch({ data: [file(1, "A & <B>.md", "invalid"), file(1, "A & <B>.md", "invalid")] }),
  );
  const xml = await response.text();
  assert.equal(xml.match(/\/1\/a-b.md/g)?.length, 1);
  assert.doesNotMatch(xml, /\/1\/a-b\.md<\/loc><lastmod>/);
  assert.doesNotMatch(xml, /<B>/);
});

test("a cached snippet payload serves the sitemap and stores the last-known-good copy", async () => {
  const puts: string[] = [];
  const cache: ContentCache = {
    async match(key) {
      assert.equal(key.method, "GET");
      if (key.url === `${apiUrl}/snippets`) {
        return new Response(JSON.stringify({ success: true, data: [file(7, "From Cache.md")] }));
      }
      // The project archive is not cached in this test, so its read goes to the transport below.
      return undefined;
    },
    async put(key) {
      puts.push(key.url);
    },
  };
  let snippetCalls = 0;
  const fetchContent: typeof fetch = async (input) => {
    if (String(input) === `${apiUrl}/snippets`) {
      snippetCalls += 1;
      throw new Error("the snippet body must not be fetched on a cache hit");
    }
    return Response.json(projectPage());
  };
  const response = await createSitemapResponse(request, apiUrl, fetchContent, undefined, cache);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), EDGE_CACHE_CONTROL);
  const xml = await response.text();
  assert.match(xml, /\/snippets\/document\/7\/from-cache\.md/);
  assert.match(xml, /<lastmod>2026-10-05T01:02:03\.000Z<\/lastmod>/);
  assert.equal(snippetCalls, 0);
  assert.ok(puts.includes(SITEMAP_LAST_GOOD_URL), "the last-known-good copy must be written");
  // The project page is cached under its own key; only the last-known-good key is the sitemap.
  for (const key of puts.filter((url) => url !== SITEMAP_LAST_GOOD_URL)) {
    assert.match(key, /\/v2\/projects\/archive\?/);
  }
});

test("the sitemap writes last-known-good through the platform cache by default", async () => {
  const puts: string[] = [];
  const stub: ContentCache = {
    async match() {
      return undefined;
    },
    async put(key) {
      puts.push(key.url);
    },
  };
  const globals = globalThis as unknown as { caches?: unknown };
  const original = globals.caches;
  globals.caches = { default: stub };

  try {
    const response = await createSitemapResponse(
      request,
      apiUrl,
      sitemapFetch({ success: true, data: [file(1, "Notes.md")] }),
    );
    assert.equal(response.status, 200);
    assert.ok(
      puts.includes(SITEMAP_LAST_GOOD_URL),
      `last-known-good was not written: ${puts.join(", ")}`,
    );
  } finally {
    if (original === undefined) delete globals.caches;
    else globals.caches = original;
  }
});

test("an API failure with no cached body returns a non-cacheable 503", async () => {
  const response = await createSitemapResponse(request, apiUrl, async () => {
    throw new TypeError("connection reset");
  });
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("content-type"), "text/plain; charset=utf-8");
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("retry-after"), "60");
});

test("an API failure serves the last-known-good sitemap from the edge cache", async () => {
  const cachedXml =
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://syn-forge.com/</loc><lastmod>2026-10-20</lastmod></url></urlset>';
  const cache: ContentCache = {
    async match(key) {
      if (key.url === SITEMAP_LAST_GOOD_URL) return new Response(cachedXml);
      return undefined;
    },
    async put() {
      assert.fail("a failed build must not write to the cache");
    },
  };
  const response = await createSitemapResponse(
    request,
    apiUrl,
    async () => {
      throw new TypeError("connection reset");
    },
    undefined,
    cache,
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "application/xml; charset=utf-8");
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("x-sitemap-fallback"), "last-known-good");
  assert.equal(await response.text(), cachedXml);
});

test("withheld utility routes stay out of the sitemap", async () => {
  const response = await createSitemapResponse(
    request,
    apiUrl,
    sitemapFetch({ success: true, data: [] }),
  );
  const xml = await response.text();
  for (const withheld of ["/netbird", "/atelier", "/agent"]) {
    assert.ok(
      !xml.includes(`<loc>https://syn-forge.com${withheld}</loc>`),
      `${withheld} must not be in the sitemap`,
    );
  }
  assert.match(xml, /<loc>https:\/\/syn-forge\.com\/ai<\/loc>/);
  assert.match(xml, /<loc>https:\/\/syn-forge\.com\/projects<\/loc>/);
});

test("static routes carry a stable lastmod and /snippets follows the newest document", async () => {
  const response = await createSitemapResponse(
    request,
    apiUrl,
    sitemapFetch({ success: true, data: [file(1, "Notes.md")] }),
  );
  const xml = await response.text();
  const entries = new Map<string, string | undefined>();
  for (const match of xml.matchAll(
    /<url><loc>([^<]+)<\/loc>(?:<lastmod>([^<]+)<\/lastmod>)?<\/url>/g,
  )) {
    entries.set(match[1], match[2]);
  }
  for (const route of ["/", ...SITEMAP_STATIC_ROUTES]) {
    const loc = `https://syn-forge.com${route}`;
    assert.ok(entries.has(loc), `${route} must be in the sitemap`);
    const lastmod = entries.get(loc);
    assert.ok(lastmod, `${route} must carry <lastmod>`);
    if (route === "/snippets") {
      assert.equal(lastmod, "2026-10-05T01:02:03.000Z");
    } else {
      assert.equal(lastmod, STATIC_ROUTE_LASTMOD[route]);
    }
  }
  assert.match(
    xml,
    /<loc>https:\/\/syn-forge\.com\/snippets\/document\/1\/notes\.md<\/loc><lastmod>2026-10-05T01:02:03\.000Z<\/lastmod>/,
  );
});

test("lists every project detail page without a lastmod", async () => {
  const projects = [
    { id: 8, title: "BAI Finance Website" },
    { id: 9, title: "BAI HR" },
  ];
  const response = await createSitemapResponse(
    request,
    apiUrl,
    sitemapFetch({ success: true, data: [] }, projects),
  );
  const xml = await response.text();

  assert.match(
    xml,
    /<url><loc>https:\/\/syn-forge\.com\/projects\/8\/bai-finance-website<\/loc><\/url>/,
  );
  assert.match(xml, /<url><loc>https:\/\/syn-forge\.com\/projects\/9\/bai-hr<\/loc><\/url>/);
  // A creation date would misstate an edit, and the table has no updated_at, so the entry carries none.
  assert.doesNotMatch(xml, /bai-finance-website<\/loc><lastmod>/);
});

test("enumerates a two-page project archive and lists all thirteen pages", async () => {
  const pages = new Map<string | null, ArchivePage>([
    [
      null,
      {
        projects: Array.from({ length: 12 }, (_, index) => ({
          id: index + 1,
          title: `Project ${index + 1}`,
        })),
        total: 13,
        hasMore: true,
        nextCursor: "c1",
      },
    ],
    [
      "c1",
      {
        projects: [{ id: 13, title: "Thirteenth Project" }],
        total: 13,
        hasMore: false,
        nextCursor: null,
      },
    ],
  ]);

  const response = await createSitemapResponse(
    request,
    apiUrl,
    pagedSitemapFetch({ success: true, data: [] }, pages),
  );
  assert.equal(response.status, 200);
  const xml = await response.text();

  const firstPage = pages.get(null);
  const secondPage = pages.get("c1");
  assert.ok(firstPage && secondPage, "the fixture must define both pages");

  for (const project of [...firstPage.projects, ...secondPage.projects]) {
    const entry = project as { id: number; title: string };
    // The expected URL comes from the production rule, not a second slug implementation.
    const loc = `https://syn-forge.com${projectPath(entry.id, entry.title)}`;
    assert.ok(xml.includes(`<url><loc>${loc}</loc></url>`), `${entry.title} must be listed`);
  }
  assert.equal(xml.match(/<loc>https:\/\/syn-forge\.com\/projects\/\d+\//g)?.length, 13);
  assert.doesNotMatch(xml, /<loc>https:\/\/syn-forge\.com\/projects\/\d+\/[^<]*<\/loc><lastmod>/);
});

test("a page with an unusable project row fails closed instead of dropping it", async () => {
  const page = {
    total: 2,
    hasMore: false,
    nextCursor: null,
    projects: [{ id: 8, title: "BAI Finance Website" }, { id: 9 }],
  };
  const response = await createSitemapResponse(
    request,
    apiUrl,
    pagedSitemapFetch({ success: true, data: [] }, new Map([[null, page]])),
  );

  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /<urlset>/);
});

test("an empty project archive is a valid sitemap, not a failure", async () => {
  const response = await createSitemapResponse(
    request,
    apiUrl,
    sitemapFetch({ success: true, data: [] }, []),
  );

  assert.equal(response.status, 200);
  const xml = await response.text();
  assert.match(xml, /<loc>https:\/\/syn-forge\.com\/projects<\/loc>/);
  assert.doesNotMatch(xml, /<loc>https:\/\/syn-forge\.com\/projects\/\d/);
});

test("an unreadable project archive makes the sitemap unavailable rather than dropping projects", async () => {
  const fetchContent: typeof fetch = async (input) => {
    const url = String(input);
    if (url.startsWith(`${apiUrl}/v2/projects/archive`)) return Response.json({ error: "boom" });
    return Response.json({ success: true, data: [] });
  };

  const response = await createSitemapResponse(request, apiUrl, fetchContent);
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /<urlset>/);
});

test("every indexable static route has a valid content date", () => {
  for (const route of ["/", ...SITEMAP_STATIC_ROUTES]) {
    const date = STATIC_ROUTE_LASTMOD[route];
    assert.ok(date, `${route} needs a STATIC_ROUTE_LASTMOD entry`);
    assert.ok(!Number.isNaN(Date.parse(date)), `${route} has an invalid date`);
  }
});

test("Pages routes sitemap through runtime middleware without a build-time snapshot", async () => {
  const routes = JSON.parse(
    await readFile(new URL("../public/_routes.json", import.meta.url), "utf8"),
  );
  assert.ok(routes.include.includes("/*"));
  assert.ok(!routes.exclude.includes("/sitemap.xml"));
  const vite = await readFile(new URL("../vite.config.ts", import.meta.url), "utf8");
  assert.doesNotMatch(vite, /vite-plugin-sitemap|fetchSnippetRoutes/);
  const middleware = await readFile(
    new URL("../functions/_middleware.ts", import.meta.url),
    "utf8",
  );
  assert.match(middleware, /createSitemapResponse/);
  assert.ok(
    middleware.indexOf("return (await createSitemapResponse") <
      middleware.indexOf("const canonicalRedirect = createCanonicalRouteRedirect"),
  );
});
