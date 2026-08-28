import { PortfolioApiError } from "./errors.ts";
import type { PortfolioApiEnvironment, SnippetText } from "./types.ts";
import { DEFAULT_API_ORIGIN, getApiUrl } from "./urls.ts";

const REQUEST_TIMEOUT_MS = 8_000;
const MAX_TEXT_BYTES = 1_048_576;

export type PortfolioApiTransport = {
  getJson<T>(pathname: string): Promise<T>;
  getText(pathname: string): Promise<SnippetText>;
};

export function createPortfolioApiTransport(
  environment: PortfolioApiEnvironment,
): PortfolioApiTransport {
  const baseUrl = environment.PORTFOLIO_API_BASE_URL ?? DEFAULT_API_ORIGIN;

  async function request(pathname: string): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const requestUrl = getApiUrl(pathname, baseUrl);
    const request = new Request(requestUrl, {
      method: "GET",
      headers: { Accept: "application/json, text/plain" },
    });

    try {
      const response = environment.PORTFOLIO_API
        ? await environment.PORTFOLIO_API.fetch(request, { signal: controller.signal })
        : await fetch(request, { signal: controller.signal });

      if (!response.ok) {
        throw new PortfolioApiError(
          `Portfolio API request failed (${response.status}).`,
          response.status,
        );
      }

      return response;
    } catch (error) {
      if (error instanceof PortfolioApiError) throw error;
      throw new PortfolioApiError("Portfolio API is unavailable.", 502);
    } finally {
      clearTimeout(timeout);
    }
  }

  async function getJson<T>(pathname: string): Promise<T> {
    const response = await request(pathname);
    try {
      return (await response.json()) as T;
    } catch {
      throw new PortfolioApiError("Portfolio API returned invalid JSON.", 502);
    }
  }

  async function getText(pathname: string): Promise<SnippetText> {
    const response = await request(pathname);
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > MAX_TEXT_BYTES) {
      throw new PortfolioApiError("The requested snippet exceeds the public MCP text limit.", 413);
    }

    return {
      text: new TextDecoder().decode(bytes),
      size_bytes: bytes.byteLength,
      content_type: response.headers.get("content-type") ?? "text/plain; charset=utf-8",
    };
  }

  return { getJson, getText };
}
