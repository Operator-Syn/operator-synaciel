import assert from "node:assert/strict";
import { test } from "node:test";
import {
  type ContentCache,
  type ContentFetchResult,
  classifyContentExistence,
  fetchContentText,
} from "../functions/contentFetch.ts";

const apiUrl = "https://api.example/snippets";

class FakeCache implements ContentCache {
  readonly entries = new Map<string, Response>();
  matches = 0;
  puts = 0;

  constructor(seed: Record<string, string> = {}) {
    for (const [url, body] of Object.entries(seed)) {
      this.entries.set(url, new Response(body));
    }
  }

  async match(request: Request): Promise<Response | undefined> {
    this.matches += 1;
    return this.entries.get(request.url)?.clone();
  }

  async put(request: Request, response: Response): Promise<void> {
    this.puts += 1;
    this.entries.set(request.url, response.clone());
  }
}

type Handler = (url: string, init: RequestInit | undefined) => Response | Promise<Response>;

function countingFetch(handler: Handler) {
  const urls: string[] = [];
  const fetchContent: typeof fetch = async (input, init) => {
    const url = String(input);
    urls.push(url);
    return handler(url, init ?? undefined);
  };
  return { fetchContent, urls };
}

test("a cache hit returns the cached body without calling fetch", async () => {
  const cache = new FakeCache({ [apiUrl]: "<urlset/>" });
  const { fetchContent, urls } = countingFetch(() => {
    throw new Error("fetch must not run on a cache hit");
  });

  const result = await fetchContentText(apiUrl, {
    timeoutMs: 100,
    cacheTtlSeconds: 60,
    fetchContent,
    cache,
  });

  assert.deepEqual(result, {
    ok: true,
    body: "<urlset/>",
    fromCache: true,
    stale: false,
  });
  assert.equal(urls.length, 0);
  assert.equal(cache.matches, 1);
  assert.equal(cache.puts, 0);
});

test("a cache miss fetches once, writes to cache, and returns the body", async () => {
  const cache = new FakeCache();
  const { fetchContent, urls } = countingFetch(
    () => new Response("hello", { headers: { "content-type": "text/plain" } }),
  );

  const result = await fetchContentText(apiUrl, {
    timeoutMs: 100,
    cacheTtlSeconds: 60,
    fetchContent,
    cache,
  });

  assert.deepEqual(result, { ok: true, body: "hello", fromCache: false, stale: false });
  assert.deepEqual(urls, [apiUrl]);
  assert.equal(cache.puts, 1);

  const cached = cache.entries.get(apiUrl);
  assert.ok(cached, "the response was stored under the absolute request URL");
  assert.equal(await cached.text(), "hello");
  assert.equal(cached.headers.get("content-type"), "text/plain");
  assert.match(cached.headers.get("cache-control") ?? "", /max-age=60/);
});

test("a second identical call is served from cache and fetch is not called again", async () => {
  const cache = new FakeCache();
  const { fetchContent, urls } = countingFetch(() => new Response("once"));

  const options = { timeoutMs: 100, cacheTtlSeconds: 60, fetchContent, cache };
  const first = await fetchContentText(apiUrl, options);
  const second = await fetchContentText(apiUrl, options);

  assert.equal(first.ok && first.fromCache, false);
  assert.equal(second.ok && second.fromCache, true);
  assert.equal(second.ok && second.body, "once");
  assert.equal(urls.length, 1);
  assert.equal(cache.puts, 1);
  assert.equal(cache.matches, 2);
});

test("a non-200 with a usable stale entry returns the cached body marked stale", async () => {
  let reads = 0;
  const cache: ContentCache = {
    async match(): Promise<Response | undefined> {
      reads += 1;
      // Miss on the pre-fetch read, hit on the post-failure fallback read.
      return reads === 1 ? undefined : new Response("last-known-good");
    },
    async put(): Promise<void> {
      throw new Error("a failed origin response must not be cached");
    },
  };
  const { fetchContent } = countingFetch(() => new Response("down", { status: 503 }));

  const result = await fetchContentText(apiUrl, {
    timeoutMs: 100,
    cacheTtlSeconds: 60,
    fetchContent,
    cache,
  });

  assert.deepEqual(result, {
    ok: true,
    body: "last-known-good",
    fromCache: true,
    stale: true,
  });
  assert.equal(reads, 2);
});

test("a timeout with no cache entry returns the timeout reason and does not throw", async () => {
  const cache = new FakeCache();
  let aborted = false;
  const fetchContent: typeof fetch = (_input, init) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        aborted = true;
        reject(new DOMException("Aborted", "AbortError"));
      });
    });

  const result = await fetchContentText(apiUrl, {
    timeoutMs: 5,
    cacheTtlSeconds: 60,
    fetchContent,
    cache,
  });

  assert.deepEqual(result, { ok: false, reason: "timeout" });
  assert.equal(aborted, true);
});

test("a non-200 with no cache entry returns the http reason", async () => {
  const cache = new FakeCache();
  const { fetchContent } = countingFetch(() => new Response("nope", { status: 502 }));

  const result = await fetchContentText(apiUrl, {
    timeoutMs: 100,
    cacheTtlSeconds: 60,
    fetchContent,
    cache,
  });

  assert.deepEqual(result, { ok: false, reason: "http", status: 502 });
  assert.equal(cache.puts, 0);
});

test("a network error with no cache entry returns the network reason", async () => {
  const cache = new FakeCache();
  const { fetchContent } = countingFetch(() => {
    throw new TypeError("connection reset");
  });

  const result = await fetchContentText(apiUrl, {
    timeoutMs: 100,
    cacheTtlSeconds: 60,
    fetchContent,
    cache,
  });

  assert.deepEqual(result, { ok: false, reason: "network" });
});

test("an empty 200 body is distinguishable from a failure", async () => {
  const { fetchContent } = countingFetch(() => new Response("", { status: 200 }));
  const success = await fetchContentText(apiUrl, {
    timeoutMs: 100,
    cacheTtlSeconds: 60,
    fetchContent,
    cache: new FakeCache(),
  });

  const { fetchContent: failingFetch } = countingFetch(() => new Response(null, { status: 500 }));
  const failure = await fetchContentText(apiUrl, {
    timeoutMs: 100,
    cacheTtlSeconds: 60,
    fetchContent: failingFetch,
    cache: new FakeCache(),
  });

  assert.deepEqual(success, { ok: true, body: "", fromCache: false, stale: false });
  assert.deepEqual(failure, { ok: false, reason: "http", status: 500 });
  assert.notDeepEqual(success, failure);
});

test("an http failure carries the origin status, so 404 and 500 differ", async () => {
  const makeFetch = (status: number) =>
    countingFetch(() => new Response(status === 404 ? "missing" : "broken", { status }))
      .fetchContent;

  const missing = await fetchContentText(apiUrl, {
    timeoutMs: 100,
    cacheTtlSeconds: 60,
    fetchContent: makeFetch(404),
    cache: new FakeCache(),
  });
  const broken = await fetchContentText(apiUrl, {
    timeoutMs: 100,
    cacheTtlSeconds: 60,
    fetchContent: makeFetch(500),
    cache: new FakeCache(),
  });

  assert.deepEqual(missing, { ok: false, reason: "http", status: 404 });
  assert.deepEqual(broken, { ok: false, reason: "http", status: 500 });
  assert.notDeepEqual(missing, broken);
});

test("classifies only an explicit 404 as missing; everything else is unknown", () => {
  const present: ContentFetchResult = {
    ok: true,
    body: "{}",
    fromCache: false,
    stale: false,
  };

  assert.equal(classifyContentExistence(present), "present");
  assert.equal(
    classifyContentExistence({
      ok: true,
      body: "{}",
      fromCache: true,
      stale: true,
    }),
    "present",
  );
  assert.equal(classifyContentExistence({ ok: false, reason: "http", status: 404 }), "missing");
  assert.equal(classifyContentExistence({ ok: false, reason: "http", status: 500 }), "unknown");
  assert.equal(classifyContentExistence({ ok: false, reason: "http", status: 503 }), "unknown");
  assert.equal(classifyContentExistence({ ok: false, reason: "http", status: 403 }), "unknown");
  assert.equal(classifyContentExistence({ ok: false, reason: "timeout" }), "unknown");
  assert.equal(classifyContentExistence({ ok: false, reason: "network" }), "unknown");
});

test("a successful fetch still returns the body with no cache available", async () => {
  const { fetchContent, urls } = countingFetch(() => new Response("uncached"));

  const result = await fetchContentText(apiUrl, {
    timeoutMs: 100,
    cacheTtlSeconds: 60,
    fetchContent,
    cache: undefined,
  });

  assert.deepEqual(result, {
    ok: true,
    body: "uncached",
    fromCache: false,
    stale: false,
  });
  assert.equal(urls.length, 1);
});

test("cache keys include the origin so two origins cannot collide", async () => {
  const cache = new FakeCache();
  const { fetchContent, urls } = countingFetch((url) => new Response(url));

  const options = { timeoutMs: 100, cacheTtlSeconds: 60, fetchContent, cache };
  await fetchContentText("https://one.example/snippets", options);
  await fetchContentText("https://two.example/snippets", options);

  assert.equal(urls.length, 2);
  assert.equal(cache.puts, 2);
  assert.deepEqual([...cache.entries.keys()].sort(), [
    "https://one.example/snippets",
    "https://two.example/snippets",
  ]);
});
