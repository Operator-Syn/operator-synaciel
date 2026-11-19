import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import type { ContentCache } from "../../apps/portfolio-web/functions/contentFetch.ts";
import { createSitemapResponse } from "../../apps/portfolio-web/src/data/sitemap.ts";

const EDGE_CACHE_CONTROL = "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400";

const request = new Request("https://preview.example/sitemap.xml");
const apiUrl = "https://api.example/api";
const file = (id: number, name: string, modified = "2026-10-05 01:02:03") => ({
  id,
  name,
  type: "file",
  modified,
});

test("sitemap reflects additions, renames, edits and deletions on consecutive requests", async () => {
  let data: unknown[] = [file(1, "Old Name.md")];
  const fetchContent: typeof fetch = async (url, options) => {
    assert.equal(url, `${apiUrl}/snippets`);
    assert.equal(options?.cache, "no-store");
    assert.ok(options?.signal);
    return Response.json({ success: true, data });
  };
  const read = async () => {
    const response = await createSitemapResponse(request, `${apiUrl}/`, fetchContent);
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

test("sitemap rejects upstream failures and malformed trees instead of dropping documents", async () => {
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
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("retry-after"), "60");
    assert.doesNotMatch(await response.text(), /<urlset>/);
  }
  assert.equal((await createSitemapResponse(request, undefined)).status, 503);
});

test("sitemap supports HEAD and rejects writes without calling the content API", async () => {
  const fetchContent: typeof fetch = async () => Response.json({ data: [file(1, "Notes.md")] });
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
  const response = await createSitemapResponse(request, apiUrl, async () =>
    Response.json({ data: [file(1, "A & <B>.md", "invalid"), file(1, "A & <B>.md", "invalid")] }),
  );
  const xml = await response.text();
  assert.equal(xml.match(/\/1\/a-b.md/g)?.length, 1);
  assert.doesNotMatch(xml, /<lastmod>|<B>/);
});

test("a cached snippet payload serves the sitemap without calling the content API", async () => {
  const cache: ContentCache = {
    async match(key) {
      assert.equal(key.url, `${apiUrl}/snippets`);
      assert.equal(key.method, "GET");
      return new Response(JSON.stringify({ success: true, data: [file(7, "From Cache.md")] }));
    },
    async put() {
      assert.fail("a cache hit must not write to the cache");
    },
  };
  let calls = 0;
  const fetchContent: typeof fetch = async () => {
    calls += 1;
    throw new Error("fetch must not run on a cache hit");
  };
  const response = await createSitemapResponse(request, apiUrl, fetchContent, undefined, cache);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), EDGE_CACHE_CONTROL);
  const xml = await response.text();
  assert.match(xml, /\/snippets\/document\/7\/from-cache\.md/);
  assert.match(xml, /<lastmod>2026-10-05T01:02:03\.000Z<\/lastmod>/);
  assert.equal(calls, 0);
});

test("an API failure with no cached body still returns a non-cacheable 503", async () => {
  const response = await createSitemapResponse(request, apiUrl, async () => {
    throw new TypeError("connection reset");
  });
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("content-type"), "text/plain; charset=utf-8");
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("retry-after"), "60");
});

test("withheld utility routes stay out of the sitemap", async () => {
  const response = await createSitemapResponse(request, apiUrl, async () =>
    Response.json({ success: true, data: [] }),
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

test("static routes carry no lastmod while document entries keep theirs", async () => {
  const response = await createSitemapResponse(request, apiUrl, async () =>
    Response.json({ success: true, data: [file(1, "Notes.md")] }),
  );
  const xml = await response.text();
  const staticEntries = xml.match(/<url><loc>https:\/\/syn-forge\.com\/[^<]*<\/loc><\/url>/g) ?? [];
  assert.ok(staticEntries.length > 0, "the sitemap must contain static routes");
  for (const entry of staticEntries) {
    assert.doesNotMatch(entry, /<lastmod>/);
  }
  assert.match(
    xml,
    /<loc>https:\/\/syn-forge\.com\/snippets\/document\/1\/notes\.md<\/loc><lastmod>2026-10-05T01:02:03\.000Z<\/lastmod>/,
  );
});

test("Pages routes sitemap through runtime middleware without a build-time snapshot", async () => {
  const routes = JSON.parse(
    await readFile(
      new URL("../../apps/portfolio-web/public/_routes.json", import.meta.url),
      "utf8",
    ),
  );
  assert.ok(routes.include.includes("/*"));
  assert.ok(!routes.exclude.includes("/sitemap.xml"));
  const vite = await readFile(
    new URL("../../apps/portfolio-web/vite.config.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(vite, /vite-plugin-sitemap|fetchSnippetRoutes/);
  const middleware = await readFile(
    new URL("../../apps/portfolio-web/functions/_middleware.ts", import.meta.url),
    "utf8",
  );
  assert.match(middleware, /createSitemapResponse/);
  assert.ok(
    middleware.indexOf("return (await createSitemapResponse") <
      middleware.indexOf("const canonicalRedirect = createCanonicalRouteRedirect"),
  );
});
