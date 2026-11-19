/**
 * Bounded, edge-cached text fetch for the Pages Functions path.
 *
 * The sitemap and snippet-document metadata both need the same primitive:
 * fetch a remote body with a hard timeout, keep a copy in `caches.default`
 * for a caller-supplied window, and fall back to that copy when the origin
 * fails. Building it once avoids two independent caches with different
 * failure semantics.
 *
 * The result is discriminated rather than thrown, so callers can choose
 * between serving stale text and returning their own error response without
 * wrapping every call in try/catch. An empty successful body is a success;
 * only a result with `ok: false` means "no body".
 */

/** Why a fetch produced no usable body and no usable cache entry. */
export type ContentFetchFailureReason = "timeout" | "http" | "network";

/** An origin response with a non-200 status, carrying the status it returned. */
export type ContentFetchHttpFailure = {
  readonly ok: false;
  readonly reason: "http";
  readonly status: number;
};

/**
 * `fromCache` marks either a fresh cache hit or a stale fallback; `stale`
 * distinguishes the two. A stale result only appears after the origin failed.
 *
 * The `"http"` failure carries the origin status so callers can tell a 404
 * ("this document does not exist") from a 5xx ("the API is broken"). They are
 * not interchangeable for an existence check.
 */
export type ContentFetchResult =
  | { ok: true; body: string; fromCache: boolean; stale: boolean }
  | ContentFetchHttpFailure
  | { ok: false; reason: "timeout" | "network" };

/**
 * Classifies a result for a document existence check.
 *
 * Only an explicit 404 from the origin proves the document is missing.
 * Everything else is "unknown" — a timeout, a network error, a 5xx, and also
 * an unexpected 4xx. Callers must keep serving the page on "unknown"; turning
 * a broken or misconfigured API into a 404 would take working deep links down.
 */
export type ContentExistence = "present" | "missing" | "unknown";

export function classifyContentExistence(result: ContentFetchResult): ContentExistence {
  if (result.ok) return "present";
  if (result.reason === "http" && result.status === 404) return "missing";
  return "unknown";
}

/**
 * The slice of the Cache API this helper needs. Declared locally so the
 * module typechecks both under `@cloudflare/workers-types` (where
 * `caches.default` exists) and under the DOM lib used by the node:test
 * project (where it does not).
 */
export interface ContentCache {
  match(request: Request): Promise<Response | undefined>;
  put(request: Request, response: Response): Promise<void>;
}

export interface ContentFetchOptions {
  /** Hard upper bound on the origin request, in milliseconds. */
  timeoutMs: number;
  /** Lifetime of a successful origin response in the edge cache, in seconds. */
  cacheTtlSeconds: number;
  /** Injected in tests; defaults to the global `fetch`. */
  fetchContent?: typeof fetch;
  /** Injected in tests; defaults to `caches.default` when that exists. */
  cache?: ContentCache | undefined;
}

export function defaultCache(): ContentCache | undefined {
  if (typeof caches === "undefined") return undefined;
  return (caches as unknown as { default?: ContentCache }).default;
}

/**
 * Absolute, origin-scoped cache key. A request for the same path on another
 * origin produces a different key because the origin is part of the URL; the
 * fragment is dropped because it never reaches an origin or the cache.
 */
function cacheKeyFor(url: string): Request {
  const absolute = new URL(url);
  absolute.hash = "";
  return new Request(absolute.toString(), { method: "GET" });
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { name?: unknown }).name === "AbortError"
  );
}

async function readCachedBody(
  cache: ContentCache | undefined,
  key: Request,
): Promise<string | undefined> {
  if (!cache) return undefined;
  try {
    const cached = await cache.match(key);
    if (!cached) return undefined;
    return await cached.text();
  } catch {
    // A cache read or body read failure degrades to a cache miss.
    return undefined;
  }
}

async function writeCachedBody(
  cache: ContentCache | undefined,
  key: Request,
  body: string,
  upstream: Response,
  cacheTtlSeconds: number,
): Promise<void> {
  if (!cache) return;
  const contentType = upstream.headers.get("content-type") ?? "text/plain; charset=utf-8";
  const maxAge = Math.max(0, Math.floor(cacheTtlSeconds));
  const response = new Response(body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": `public, max-age=${maxAge}`,
    },
  });
  try {
    await cache.put(key, response);
  } catch {
    // Caching is best-effort: a successful origin response is still returned.
  }
}

/**
 * Fetch `url` as text, using the edge cache and falling back to a cached copy
 * when the origin returns a non-200, aborts on timeout, or fails at the
 * network layer.
 *
 * `url` must be absolute. Body shape is deliberately not validated: the
 * sitemap parses XML and snippet metadata parses JSON.
 */
export async function fetchContentText(
  url: string,
  { timeoutMs, cacheTtlSeconds, fetchContent = fetch, cache = defaultCache() }: ContentFetchOptions,
): Promise<ContentFetchResult> {
  const key = cacheKeyFor(url);

  const fresh = await readCachedBody(cache, key);
  if (fresh !== undefined) {
    return { ok: true, body: fresh, fromCache: true, stale: false };
  }

  let failure: ContentFetchHttpFailure | { ok: false; reason: "timeout" | "network" } = {
    ok: false,
    reason: "network",
  };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchContent(url, {
      signal: controller.signal,
      cache: "no-store",
    });
    if (response.status === 200) {
      const body = await response.text();
      await writeCachedBody(cache, key, body, response, cacheTtlSeconds);
      return { ok: true, body, fromCache: false, stale: false };
    }
    failure = { ok: false, reason: "http", status: response.status };
  } catch (error) {
    failure = {
      ok: false,
      reason: controller.signal.aborted || isAbortError(error) ? "timeout" : "network",
    };
  } finally {
    clearTimeout(timer);
  }

  // The origin failed after a miss. A concurrent write, or a cache that still
  // retains an expired entry, may still have a last-known-good body.
  const stale = await readCachedBody(cache, key);
  if (stale !== undefined) {
    return { ok: true, body: stale, fromCache: true, stale: true };
  }

  return failure;
}
