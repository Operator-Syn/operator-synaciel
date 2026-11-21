/**
 * Write the crawler-visible body fragments for the public routes.
 *
 * The app renders into an empty `#root`, so a client that does not execute JavaScript sees headings in
 * `<head>` and no body. This script produces one HTML fragment per public route and the Pages middleware
 * injects the matching one into the shell.
 *
 * Algorithm:
 * 1. Resolve the API base from the environment or the repository's `.env` files. Never from
 *    `import.meta.env`: that is a Vite transform and is undefined in this process.
 * 2. Empty the output directory, so a fragment from an earlier build can never ship alongside this one.
 * 3. For every route, render its static fragment — heading, lead and the seven navigation links. This step
 *    needs no network and cannot fail.
 * 4. Optionally enrich the three archive routes with rows from the API, under a hard timeout. A failure here
 *    logs one line and leaves the static fragment in place: a build without API access must still deliver
 *    body content.
 * 5. Verify every expected file exists and carries its heading, and exit non-zero when one does not. A build
 *    that silently produces no fragments would look successful while shipping the same empty shell.
 */

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import {
  collectSnippetDocuments,
  type SnippetNode,
} from "../src/components/pages/snippetsPage/snippetDocuments";
import { formatArchiveCount } from "../src/data/archiveCount";
import {
  buildPrerenderFragment,
  escapeHtml,
  PRERENDER_ROUTES,
  type PrerenderEnrichment,
} from "../src/data/prerenderRoutes";

const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const repositoryRoot = resolve(appRoot, "../..");
const outputDirectory = resolve(appRoot, "public/prerender");

/** How long one enrichment request may take before the build stops waiting for it. */
const ENRICHMENT_TIMEOUT_MS = 5_000;

/** Rows fetched per archive page; the API's whole result set fits in one request. */
const ARCHIVE_LIMIT = 12;

/**
 * Resolve the API base URL the same way the app does.
 *
 * @returns The API base without a trailing slash, or `undefined` when none is configured.
 */
function resolveApiBase(): string | undefined {
  const fromEnvironment = process.env.VITE_API_URL;
  if (fromEnvironment) return fromEnvironment.replace(/\/+$/, "");

  const fromFiles = loadEnv("production", repositoryRoot, "").VITE_API_URL;
  return fromFiles ? fromFiles.replace(/\/+$/, "") : undefined;
}

/**
 * Fetch one JSON endpoint, or `undefined` when the request fails or times out.
 *
 * @param url Absolute URL to fetch.
 * @returns The parsed body, or `undefined` on any failure. Callers treat absence as "no enrichment".
 */
async function fetchJson(url: string): Promise<unknown> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(ENRICHMENT_TIMEOUT_MS) });
    if (!response.ok) return undefined;
    return (await response.json()) as unknown;
  } catch {
    return undefined;
  }
}

/** Read a string property from an unknown object, or `undefined` when absent or not a string. */
function readString(value: unknown, key: string): string | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const candidate = (value as Record<string, unknown>)[key];
  return typeof candidate === "string" ? candidate : undefined;
}

/**
 * Turn an API list response into fragment rows.
 *
 * Algorithm:
 * 1. Read `data` as an array; stop when it is not.
 * 2. For each entry take `title` and `short_description` — the API's own field names.
 * 3. Drop entries with no title.
 *
 * @param body The parsed response.
 * @param descriptionKey Key holding the description.
 * @returns Rows in response order.
 */
function toItems(body: unknown, descriptionKey: string): { title: string; description?: string }[] {
  if (typeof body !== "object" || body === null) return [];
  const data = (body as Record<string, unknown>).data;
  if (!Array.isArray(data)) return [];

  const items: { title: string; description?: string }[] = [];
  for (const entry of data) {
    const title = readString(entry, "title");
    if (!title) continue;
    items.push({ title, description: readString(entry, descriptionKey) });
  }
  return items;
}

/**
 * Turn the snippet tree into fragment rows by reusing the page's own flattener.
 *
 * `collectSnippetDocuments` is what `/snippets` renders, so importing it is what keeps the crawler-visible
 * rows identical to the page: a change to filtering or path formatting moves both at once.
 *
 * @param body The parsed `/snippets` response.
 * @returns One row per document leaf, titled by its path.
 */
function snippetItems(body: unknown): { title: string }[] {
  if (typeof body !== "object" || body === null) return [];
  const data = (body as Record<string, unknown>).data;
  if (!Array.isArray(data)) return [];

  // Validate before flattening: `collectSnippetDocuments` dereferences `type`, `name` and `children`, so one
  // malformed entry would throw and, without this filter, fail the build for an optional enhancement.
  return collectSnippetDocuments(data.filter(isSnippetNode)).map((document) => ({
    title: document.path,
  }));
}

/** Narrow an unknown entry to a snippet node, so one bad row cannot throw during the build. */
function isSnippetNode(value: unknown): value is SnippetNode {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.name === "string" && (record.type === "file" || record.type === "dir");
}

/**
 * Build the per-route enrichment, treating any failure as "no enrichment".
 *
 * The contract is that a build without API access still delivers body content, so an unexpected response
 * shape must not be able to fail the build. One log line, then the static fragments are written.
 *
 * @param apiBase The API base URL.
 * @returns The enrichment map, empty when the API could not be used.
 */
async function collectEnrichmentSafely(
  apiBase: string,
): Promise<Record<string, PrerenderEnrichment>> {
  try {
    return await collectEnrichment(apiBase);
  } catch (error) {
    console.warn(`[prerender] enrichment unavailable: ${String(error)}`);
    return {};
  }
}

/**
 * Build the per-route enrichment from the API.
 *
 * @param apiBase The API base URL.
 * @returns A partial map from route path to enrichment; absent keys mean "static fragment only".
 */
async function collectEnrichment(apiBase: string): Promise<Record<string, PrerenderEnrichment>> {
  const result: Record<string, PrerenderEnrichment> = {};

  const projects = await fetchJson(`${apiBase}/v2/projects/archive?limit=${ARCHIVE_LIMIT}`);
  const projectsTotal = readTotal(projects);
  if (projectsTotal !== undefined) {
    // The page counts one extra card for the "future project" slot, so the fragment must add it too.
    result["/projects"] = {
      count: formatArchiveCount(projectsTotal, "projects"),
      items: toItems(projects, "short_description"),
    };
  }

  const certificates = await fetchJson(`${apiBase}/v2/certificates/archive?limit=${ARCHIVE_LIMIT}`);
  const certificatesTotal = readTotal(certificates);
  if (certificatesTotal !== undefined) {
    result["/certificates"] = {
      count: formatArchiveCount(certificatesTotal, "certifications"),
      items: toItems(certificates, "short_description"),
    };
  }

  const snippets = await fetchJson(`${apiBase}/snippets`);
  const snippetRows = snippetItems(snippets);
  if (snippetRows.length > 0) result["/snippets"] = { items: snippetRows };

  return result;
}

/** Read `pagination.total` from an archive response, or `undefined` when it is not a number. */
function readTotal(body: unknown): number | undefined {
  if (typeof body !== "object" || body === null) return undefined;
  const pagination = (body as Record<string, unknown>).pagination;
  if (typeof pagination !== "object" || pagination === null) return undefined;
  const total = (pagination as Record<string, unknown>).total;
  return typeof total === "number" ? total : undefined;
}

/**
 * Run the build step.
 *
 * @throws When a fragment is missing or lacks its heading after writing.
 */
async function main(): Promise<void> {
  const apiBase = resolveApiBase();
  await rm(outputDirectory, { recursive: true, force: true });
  await mkdir(outputDirectory, { recursive: true });

  const enrichment = apiBase ? await collectEnrichmentSafely(apiBase) : {};
  if (!apiBase) {
    console.warn("[prerender] no VITE_API_URL; writing static fragments without archive rows");
  }

  for (const route of PRERENDER_ROUTES) {
    const fragment = buildPrerenderFragment(route, enrichment[route.path] ?? {});
    await writeFile(resolve(outputDirectory, `${route.slug}.html`), fragment, "utf8");
  }

  // Verify rather than trust: a build that wrote nothing would otherwise pass silently.
  const missing: string[] = [];
  for (const route of PRERENDER_ROUTES) {
    const path = resolve(outputDirectory, `${route.slug}.html`);
    const contents = await readFile(path, "utf8").catch(() => undefined);
    if (!contents || !contents.includes(`<h1>${escapeHtml(route.heading)}</h1>`)) {
      missing.push(route.slug);
    }
  }

  if (missing.length > 0)
    throw new Error(`[prerender] fragments missing or empty: ${missing.join(", ")}`);
  console.log(`[prerender] wrote ${PRERENDER_ROUTES.length} fragments to public/prerender`);
}

await main();
