import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { createSitemapResponse } from "../../apps/portfolio-web/src/data/sitemap.ts";

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
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.match(response.headers.get("content-type") ?? "", /application\/xml/);
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

test("Pages routes sitemap through runtime middleware without a build-time snapshot", async () => {
  const routes = JSON.parse(
    await readFile(
      new URL("../../apps/portfolio-web/public/_routes.json", import.meta.url),
      "utf8",
    ),
  );
  assert.ok(routes.include.includes("/sitemap.xml"));
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
      middleware.indexOf("context.next()"),
  );
});
