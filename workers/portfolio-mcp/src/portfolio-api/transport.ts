import { PORTFOLIO_MCP_CACHE_TTL_SECONDS, PORTFOLIO_MCP_ENDPOINT } from "../config.ts";
import { PortfolioApiError } from "./errors.ts";
import type { PortfolioApiEnvironment, SnippetText } from "./types.ts";
import { DEFAULT_API_ORIGIN, getApiUrl } from "./urls.ts";

const REQUEST_TIMEOUT_MS = 8_000;
const MAX_TEXT_BYTES = 1_048_576;
const CACHE_PATHNAME = "/__portfolio-mcp-api-cache";

export type PortfolioApiTransport = {
  getJson<T>(pathname: string): Promise<T>;
  getText(pathname: string): Promise<SnippetText>;
};

export type PortfolioApiTransportOptions = {
  cache?: Pick<Cache, "match" | "put">;
  waitUntil?: (promise: Promise<unknown>) => void;
};

type PortfolioApiResponse = {
  cacheKey?: Request;
  response: Response;
};

function createCacheKey(requestUrl: URL): Request {
  const cacheUrl = new URL(PORTFOLIO_MCP_ENDPOINT);
  cacheUrl.pathname = CACHE_PATHNAME;
  cacheUrl.search = new URLSearchParams({
    origin: requestUrl.origin,
    path: requestUrl.pathname,
    query: requestUrl.search,
  }).toString();

  return new Request(cacheUrl, { method: "GET" });
}

function cloneResponse(response: Response): Response | undefined {
  try {
    return response.clone();
  } catch {
    return undefined;
  }
}

export function createPortfolioApiTransport(
  environment: PortfolioApiEnvironment,
  options: PortfolioApiTransportOptions = {},
): PortfolioApiTransport {
  const baseUrl = environment.PORTFOLIO_API_BASE_URL ?? DEFAULT_API_ORIGIN;

  function scheduleCacheWrite(cacheKey: Request | undefined, response: Response): void {
    const cache = options.cache;
    if (!cacheKey || !cache || response.headers.has("Set-Cookie")) return;

    try {
      response.headers.set(
        "Cache-Control",
        `public, max-age=0, s-maxage=${PORTFOLIO_MCP_CACHE_TTL_SECONDS}`,
      );
      response.headers.delete("Pragma");
      response.headers.delete("Expires");

      const write = Promise.resolve()
        .then(() => cache.put(cacheKey, response))
        .catch(() => undefined);

      if (!options.waitUntil) {
        void write;
        return;
      }

      try {
        options.waitUntil(write);
      } catch {
        void write;
      }
    } catch {
      // Cache preparation is best effort and never changes the public response.
    }
  }

  async function request(pathname: string): Promise<PortfolioApiResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const requestUrl = getApiUrl(pathname, baseUrl);
    const request = new Request(requestUrl, {
      method: "GET",
      headers: { Accept: "application/json, text/plain" },
    });
    const cacheKey = options.cache ? createCacheKey(requestUrl) : undefined;

    try {
      if (cacheKey && options.cache) {
        try {
          const cached = await options.cache.match(cacheKey);
          if (cached) return { response: cached };
        } catch {
          // A Cache API failure is a cache miss; the public API remains authoritative.
        }
      }

      const response = environment.PORTFOLIO_API
        ? await environment.PORTFOLIO_API.fetch(request, { signal: controller.signal })
        : await fetch(request, { signal: controller.signal });

      if (!response.ok) {
        throw new PortfolioApiError(
          `Portfolio API request failed (${response.status}).`,
          response.status,
        );
      }

      return { cacheKey, response };
    } catch (error) {
      if (error instanceof PortfolioApiError) throw error;
      throw new PortfolioApiError("Portfolio API is unavailable.", 502);
    } finally {
      clearTimeout(timeout);
    }
  }

  async function getJson<T>(pathname: string): Promise<T> {
    const { cacheKey, response } = await request(pathname);
    const cacheResponse = cacheKey ? cloneResponse(response) : undefined;
    try {
      const value = (await response.json()) as T;
      if (cacheResponse) scheduleCacheWrite(cacheKey, cacheResponse);
      return value;
    } catch {
      throw new PortfolioApiError("Portfolio API returned invalid JSON.", 502);
    }
  }

  async function getText(pathname: string): Promise<SnippetText> {
    const { cacheKey, response } = await request(pathname);
    const cacheResponse = cacheKey ? cloneResponse(response) : undefined;
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > MAX_TEXT_BYTES) {
      throw new PortfolioApiError("The requested snippet exceeds the public MCP text limit.", 413);
    }

    if (cacheResponse) scheduleCacheWrite(cacheKey, cacheResponse);
    return {
      text: new TextDecoder().decode(bytes),
      size_bytes: bytes.byteLength,
      content_type: response.headers.get("content-type") ?? "text/plain; charset=utf-8",
    };
  }

  return { getJson, getText };
}
