import {
  GITHUB_BLOB_CACHE_TTL_SECONDS,
  GITHUB_COMMIT_CACHE_TTL_SECONDS,
  GITHUB_COMMIT_LIST_CACHE_TTL_SECONDS,
  GITHUB_COMMIT_REACHABILITY_CACHE_TTL_SECONDS,
  GITHUB_README_CACHE_TTL_SECONDS,
  GITHUB_REPOSITORY_CACHE_TTL_SECONDS,
  GITHUB_TREE_CACHE_TTL_SECONDS,
  PORTFOLIO_MCP_ENDPOINT,
} from "../config.ts";
import { PortfolioApiError } from "../portfolio-api/errors.ts";
import type { GitHubClientOptions, GitHubTokenScope } from "./types.ts";

const GITHUB_API_ORIGIN = "https://api.github.com";
const GITHUB_USER_AGENT = "syn-forge-portfolio-mcp";
const REQUEST_TIMEOUT_MS = 8_000;
const MAX_RESPONSE_BYTES = 4 * 1_048_576;
const CACHE_PATHNAME = "/__portfolio-mcp-github-cache";

export type GitHubTransportResponse<T> = {
  data: T;
  headers: Headers;
};

export type GitHubTransport = {
  getJson<T>(
    pathname: string,
    cacheTtlSeconds: number,
    scope: GitHubTokenScope,
  ): Promise<GitHubTransportResponse<T>>;
};

function createCacheKey(pathname: string): Request {
  const cacheUrl = new URL(PORTFOLIO_MCP_ENDPOINT);
  cacheUrl.pathname = CACHE_PATHNAME;
  cacheUrl.search = new URLSearchParams({ pathname }).toString();
  return new Request(cacheUrl, { method: "GET" });
}

function responseStatus(response: Response): number {
  if (
    response.status === 429 ||
    (response.status === 403 &&
      (response.headers.get("x-ratelimit-remaining") === "0" ||
        response.headers.has("retry-after")))
  ) {
    return 429;
  }

  return response.status;
}

function cloneResponse(response: Response): Response | undefined {
  try {
    return response.clone();
  } catch {
    return undefined;
  }
}

function scheduleCacheWrite(
  options: GitHubClientOptions,
  cacheKey: Request | undefined,
  response: Response,
  cacheTtlSeconds: number,
): void {
  const cache = options.cache;
  if (!cacheKey || !cache || response.headers.has("Set-Cookie")) return;

  try {
    response.headers.set("Cache-Control", `public, max-age=0, s-maxage=${cacheTtlSeconds}`);
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

async function decodeJsonResponse<T>(response: Response): Promise<T> {
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > MAX_RESPONSE_BYTES) {
    throw new PortfolioApiError("The GitHub response exceeds the public MCP limit.", 413);
  }

  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as T;
  } catch {
    throw new PortfolioApiError("GitHub returned invalid JSON.", 502);
  }
}

export function createGitHubTransport(options: GitHubClientOptions = {}): GitHubTransport {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const getAccessToken = options.accessToken;
  const invalidateAccessToken = options.invalidateAccessToken;

  async function requestJson(pathname: string, token: string): Promise<Response> {
    const requestUrl = new URL(pathname, GITHUB_API_ORIGIN);
    if (requestUrl.origin !== GITHUB_API_ORIGIN) {
      throw new PortfolioApiError("The GitHub request origin is invalid.", 400);
    }

    const request = new Request(requestUrl, {
      method: "GET",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "User-Agent": GITHUB_USER_AGENT,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      return await fetchImpl(request, { signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
  }

  async function getJson<T>(
    pathname: string,
    cacheTtlSeconds: number,
    scope: GitHubTokenScope,
  ): Promise<GitHubTransportResponse<T>> {
    if (!pathname.startsWith("/") || pathname.startsWith("//")) {
      throw new PortfolioApiError("The GitHub request path is invalid.", 400);
    }
    if (new URL(pathname, GITHUB_API_ORIGIN).origin !== GITHUB_API_ORIGIN) {
      throw new PortfolioApiError("The GitHub request origin is invalid.", 400);
    }
    if (!getAccessToken) {
      throw new PortfolioApiError("GitHub App credentials are not configured.", 502);
    }

    let accessToken = await getAccessToken(scope);
    const cacheKey = options.cache && cacheTtlSeconds > 0 ? createCacheKey(pathname) : undefined;

    if (cacheKey && options.cache) {
      try {
        const cached = await options.cache.match(cacheKey);
        if (cached) {
          try {
            return {
              data: await decodeJsonResponse<T>(cached),
              headers: new Headers(cached.headers),
            };
          } catch {
            // A malformed or oversized cache entry is treated as a cache miss.
          }
        }
      } catch {
        // A Cache API failure is a cache miss; GitHub remains authoritative.
      }
    }

    try {
      let response = await requestJson(pathname, accessToken);
      if (response.status === 401 && invalidateAccessToken) {
        invalidateAccessToken(accessToken);
        accessToken = await getAccessToken(scope);
        response = await requestJson(pathname, accessToken);
      }
      if (!response.ok) {
        throw new PortfolioApiError(
          `GitHub request failed (${response.status}).`,
          responseStatus(response),
        );
      }

      const cacheResponse = cacheKey ? cloneResponse(response) : undefined;
      const data = await decodeJsonResponse<T>(response);
      if (cacheResponse && cacheTtlSeconds > 0) {
        scheduleCacheWrite(options, cacheKey, cacheResponse, cacheTtlSeconds);
      }
      return { data, headers: new Headers(response.headers) };
    } catch (error) {
      if (error instanceof PortfolioApiError) throw error;
      throw new PortfolioApiError("GitHub is temporarily unavailable.", 502);
    }
  }

  return { getJson };
}

export const GITHUB_CACHE_TTLS = {
  blob: GITHUB_BLOB_CACHE_TTL_SECONDS,
  commit: GITHUB_COMMIT_CACHE_TTL_SECONDS,
  commitList: GITHUB_COMMIT_LIST_CACHE_TTL_SECONDS,
  commitReachability: GITHUB_COMMIT_REACHABILITY_CACHE_TTL_SECONDS,
  readme: GITHUB_README_CACHE_TTL_SECONDS,
  repository: GITHUB_REPOSITORY_CACHE_TTL_SECONDS,
  tree: GITHUB_TREE_CACHE_TTL_SECONDS,
} as const;
