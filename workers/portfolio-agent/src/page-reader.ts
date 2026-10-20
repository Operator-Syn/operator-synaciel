import puppeteer, { type BrowserWorker } from "@cloudflare/puppeteer";
import { tool } from "ai";
import { z } from "zod";

export const PORTFOLIO_PAGE_ORIGIN = "https://syn-forge.com";
export const DEFAULT_PAGE_CHUNK_CHARACTERS = 12_000;
export const MAX_PAGE_CHUNK_CHARACTERS = 32_000;
export const MAX_PAGE_TEXT_CHARACTERS = 1_000_000;
export const MAX_PAGE_READS_PER_TURN = 3;
export const PAGE_CACHE_TTL_MS = 60 * 60 * 1_000;
export const PAGE_CACHE_RETENTION_MS = 24 * 60 * 60 * 1_000;
export const PAGE_CACHE_MAX_ENTRIES = 20;
export const PAGE_RENDER_TIMEOUT_MS = 20_000;
export const MAX_PAGE_PATH_CHARACTERS = 2_048;

export type PortfolioPagePayload = {
  path: string;
  page_url: string;
  title: string;
  content: string;
  offset: number;
  next_offset: number;
  total_characters: number;
  complete: boolean;
};

export type RenderedPortfolioPage = {
  title: string;
  text: string;
  finalUrl: string;
};

export type CachedPortfolioPage = {
  pageUrl: string;
  title: string;
  text: string;
  fetchedAt: number;
};

export type PortfolioPageCache = {
  get(pageUrl: string): CachedPortfolioPage | null;
  set(pageUrl: string, page: CachedPortfolioPage): void;
  prune(now: number): void;
};

export type PortfolioPageRenderer = (url: string) => Promise<RenderedPortfolioPage>;

export type PageCacheSql = (
  query: string[],
  ...values: Array<string | number>
) => Array<Record<string, unknown>>;

export type PortfolioPageReadResult =
  | { ok: true; payload: PortfolioPagePayload }
  | { ok: false; code: string; message: string };

function containsControlCharacter(value: string): boolean {
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

function decodedPathIsUnsafe(value: string): boolean {
  if (containsControlCharacter(value) || value.includes("\\")) return true;
  if (value.includes("?") || value.includes("#") || value.includes("//")) return true;
  return value.split("/").some((segment) => segment === "." || segment === "..");
}

export function validatePortfolioPagePath(value: unknown): { path: string; url: string } | null {
  if (typeof value !== "string") return null;
  const path = value.trim();
  if (!path || path.length > MAX_PAGE_PATH_CHARACTERS) return null;
  if (!path.startsWith("/") || path.startsWith("//")) return null;
  if (path.includes("?") || path.includes("#") || path.includes("//")) return null;

  let decoded = path;
  for (let pass = 0; pass < 2; pass += 1) {
    try {
      decoded = decodeURIComponent(decoded);
    } catch {
      return null;
    }
    if (decodedPathIsUnsafe(decoded)) return null;
  }

  let url: URL;
  try {
    url = new URL(path, PORTFOLIO_PAGE_ORIGIN);
  } catch {
    return null;
  }
  if (url.origin !== PORTFOLIO_PAGE_ORIGIN || url.pathname !== path) return null;
  return { path, url: url.href };
}

export function normalizePortfolioPageText(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function createPortfolioPageRenderer(environment: {
  BROWSER: BrowserWorker;
}): PortfolioPageRenderer {
  return async (url) => {
    const browser = await puppeteer.launch(environment.BROWSER);
    try {
      const page = await browser.newPage();
      await page.goto(url, { waitUntil: "networkidle2", timeout: PAGE_RENDER_TIMEOUT_MS });
      await page.waitForSelector("main", { timeout: 10_000 }).catch(() => undefined);
      return await page.evaluate(() => {
        const main = document.querySelector("main");
        const text = main instanceof HTMLElement ? main.innerText : document.body.innerText;
        return { title: document.title, text, finalUrl: location.href };
      });
    } finally {
      await browser.close().catch(() => undefined);
    }
  };
}

export function ensurePortfolioPageCacheSchema(sql: PageCacheSql): void {
  sql([
    "CREATE TABLE IF NOT EXISTS portfolio_page_cache (page_url TEXT PRIMARY KEY, final_url TEXT NOT NULL, title TEXT NOT NULL, content TEXT NOT NULL, fetched_at INTEGER NOT NULL)",
  ]);
}

export function createSqlPortfolioPageCache(
  sql: PageCacheSql,
  now: () => number = Date.now,
): PortfolioPageCache {
  return {
    get(pageUrl) {
      const row = sql(
        [
          "SELECT final_url, title, content, fetched_at FROM portfolio_page_cache WHERE page_url = ? LIMIT 1",
        ],
        pageUrl,
      )[0];
      if (
        !row ||
        typeof row.final_url !== "string" ||
        typeof row.title !== "string" ||
        typeof row.content !== "string"
      ) {
        return null;
      }
      const fetchedAt = Number(row.fetched_at);
      if (!Number.isFinite(fetchedAt) || now() - fetchedAt > PAGE_CACHE_TTL_MS) return null;
      return { pageUrl: row.final_url, title: row.title, text: row.content, fetchedAt };
    },
    set(pageUrl, page) {
      sql(
        [
          "INSERT INTO portfolio_page_cache (page_url, final_url, title, content, fetched_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(page_url) DO UPDATE SET final_url = excluded.final_url, title = excluded.title, content = excluded.content, fetched_at = excluded.fetched_at",
        ],
        pageUrl,
        page.pageUrl,
        page.title,
        page.text,
        page.fetchedAt,
      );
    },
    prune(currentTime) {
      sql(
        ["DELETE FROM portfolio_page_cache WHERE fetched_at < ?"],
        currentTime - PAGE_CACHE_RETENTION_MS,
      );
      sql(
        [
          "DELETE FROM portfolio_page_cache WHERE page_url IN (SELECT page_url FROM portfolio_page_cache ORDER BY fetched_at DESC LIMIT -1 OFFSET ?)",
        ],
        PAGE_CACHE_MAX_ENTRIES,
      );
    },
  };
}

export async function readPortfolioPage(
  input: { path: string; offset?: number; maxChars?: number },
  options: {
    render: PortfolioPageRenderer;
    cache: PortfolioPageCache;
    now?: () => number;
  },
): Promise<PortfolioPageReadResult> {
  const validated = validatePortfolioPagePath(input.path);
  if (!validated) {
    return {
      ok: false,
      code: "INVALID_PATH",
      message: "Use a path beginning with / under https://syn-forge.com.",
    };
  }

  const now = options.now ?? Date.now;
  const currentTime = now();
  let page: CachedPortfolioPage | null = null;
  try {
    page = options.cache.get(validated.url);
  } catch {
    page = null;
  }

  if (!page) {
    let rendered: RenderedPortfolioPage;
    try {
      rendered = await options.render(validated.url);
    } catch {
      return {
        ok: false,
        code: "PAGE_RENDER_FAILED",
        message: "The page could not be rendered.",
      };
    }

    let finalUrl: URL;
    try {
      finalUrl = new URL(rendered.finalUrl);
    } catch {
      return {
        ok: false,
        code: "PAGE_OFF_ORIGIN",
        message: "The page redirected outside https://syn-forge.com.",
      };
    }
    if (finalUrl.origin !== PORTFOLIO_PAGE_ORIGIN) {
      return {
        ok: false,
        code: "PAGE_OFF_ORIGIN",
        message: "The page redirected outside https://syn-forge.com.",
      };
    }

    const text = normalizePortfolioPageText(rendered.text);
    if (!text) {
      return {
        ok: false,
        code: "PAGE_EMPTY",
        message: "The page did not contain readable text.",
      };
    }
    if (text.length > MAX_PAGE_TEXT_CHARACTERS) {
      return {
        ok: false,
        code: "PAGE_TOO_LARGE",
        message: "The page text exceeded the bounded storage limit.",
      };
    }

    page = {
      pageUrl: finalUrl.href,
      title: rendered.title.trim().slice(0, 256) || validated.path,
      text,
      fetchedAt: currentTime,
    };
    try {
      options.cache.set(validated.url, page);
    } catch {
      // A cache failure must not hide a successfully rendered page.
    }
    try {
      options.cache.prune(currentTime);
    } catch {
      // Pruning is best effort.
    }
  }

  const start = Math.min(Math.max(input.offset ?? 0, 0), page.text.length);
  const chunkSize = Math.min(
    Math.max(input.maxChars ?? DEFAULT_PAGE_CHUNK_CHARACTERS, 1),
    MAX_PAGE_CHUNK_CHARACTERS,
  );
  const end = Math.min(start + chunkSize, page.text.length);

  return {
    ok: true,
    payload: {
      path: validated.path,
      page_url: page.pageUrl,
      title: page.title,
      content: page.text.slice(start, end),
      offset: start,
      next_offset: end,
      total_characters: page.text.length,
      complete: end >= page.text.length,
    },
  };
}

function pageResult(payload: PortfolioPagePayload) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload) }],
    structuredContent: payload,
  };
}

function pageError(code: string, message: string) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify({ error: { code, message } }) }],
    structuredContent: { error: { code, message } },
    isError: true,
  };
}

export function createReadPortfolioPageTool(options: {
  render: PortfolioPageRenderer;
  cache: PortfolioPageCache;
  maxReadsPerTurn?: number;
  now?: () => number;
}) {
  let reads = 0;
  const maxReads = options.maxReadsPerTurn ?? MAX_PAGE_READS_PER_TURN;

  return tool({
    description:
      "Read rendered text from a public page under https://syn-forge.com. Use this for static prose or rendered blog/snippet pages that the MCP does not cover. Provide a path beginning with /; external URLs, query strings, hashes, and encoded traversal are rejected. Long pages return a chunk with next_offset and complete; continue with next_offset when complete is false.",
    inputSchema: z.strictObject({
      path: z
        .string()
        .trim()
        .min(1)
        .max(MAX_PAGE_PATH_CHARACTERS)
        .describe("Same-origin path such as /ai or /snippets/document/12/example-post."),
      offset: z
        .number()
        .int()
        .safe()
        .min(0)
        .max(MAX_PAGE_TEXT_CHARACTERS)
        .optional()
        .describe("UTF-16 character offset for the next text chunk."),
      max_chars: z
        .number()
        .int()
        .safe()
        .min(1)
        .max(MAX_PAGE_CHUNK_CHARACTERS)
        .optional()
        .describe("Maximum text characters in this response."),
    }),
    execute: async ({ path, offset, max_chars }) => {
      if (reads >= maxReads) {
        return pageError(
          "PAGE_READ_LIMIT",
          `At most ${maxReads} portfolio page reads are allowed in one turn.`,
        );
      }
      reads += 1;

      const result = await readPortfolioPage(
        { path, offset, maxChars: max_chars },
        { render: options.render, cache: options.cache, now: options.now },
      );
      return result.ok ? pageResult(result.payload) : pageError(result.code, result.message);
    },
  });
}
