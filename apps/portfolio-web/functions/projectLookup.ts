/**
 * Project lookups for the Pages Function.
 *
 * Two callers, two cache policies:
 *
 * - {@link lookupProject} answers "does this project exist?" and must read the origin every time. A
 *   list cached for an hour can be missing a project created five minutes ago, and treating that gap as
 *   absence would 404 a live page. The no-op cache is explicit rather than `undefined`, because
 *   `fetchContentText` defaults the property to `caches.default`.
 * - {@link fetchCachedProjectList} feeds the archive page's `ItemList`, where a stale member is
 *   harmless and a successful response matters more than freshness.
 */

import {
  collectAllProjects,
  createProjectPageFetcher,
  findProjectById,
  type ProjectCollection,
  type ProjectLookup,
  type ProjectPageFetcher,
} from "../src/data/projectArchive.ts";
import type { ContentCache } from "./contentFetch.ts";

/**
 * A cache that never stores and never answers, so every read reaches the origin.
 *
 * Passing `cache: undefined` cannot express this: the fetch helper's parameter default applies to
 * `undefined` and installs `caches.default` in the Workers runtime.
 */
export const NO_CACHE: ContentCache = {
  match: async () => undefined,
  put: async () => undefined,
};

/**
 * Build a page fetcher that always reads the origin.
 *
 * The cache is fixed to {@link NO_CACHE} rather than exposed as an option: that is the property this
 * function exists to guarantee, and a caller who could pass a cache could silently reintroduce the
 * stale-list 404. Only the transport is injectable, so tests can count origin reads.
 *
 * @param apiUrl The API base, e.g. `https://host/api`.
 * @param fetchContent Injected transport; defaults to the platform's `fetch`.
 * @returns A fetcher for the project archive walk.
 */
export function createFreshProjectPageFetcher(
  apiUrl: string,
  fetchContent?: typeof fetch,
): ProjectPageFetcher {
  return createProjectPageFetcher({ base: apiUrl, fetchContent, cache: NO_CACHE });
}

/**
 * Resolve one project from a fresh read of the archive.
 *
 * @param apiUrl The API base.
 * @param id The project id.
 * @param options.maxPages Ceiling on pages per walk.
 * @returns `found`, `missing` only from a complete fresh walk, or `unknown` with the reason.
 */
export async function lookupProject(
  apiUrl: string | undefined,
  id: number,
  options: { readonly maxPages?: number } = {},
): Promise<ProjectLookup> {
  if (!apiUrl) return { status: "unknown", reason: "no API URL is configured" };
  return findProjectById(createFreshProjectPageFetcher(apiUrl), id, options);
}

/**
 * Read the whole project collection through the edge cache.
 *
 * @param apiUrl The API base.
 * @param dependencies Injected transport and cache, defaulting to the platform's.
 * @returns The complete collection, or the reason it could not be completed.
 */
export async function fetchCachedProjectList(
  apiUrl: string | undefined,
  dependencies: { readonly fetchContent?: typeof fetch; readonly cache?: ContentCache } = {},
): Promise<ProjectCollection> {
  if (!apiUrl) return { ok: false, reason: "no API URL is configured" };

  return collectAllProjects(
    createProjectPageFetcher({
      base: apiUrl,
      fetchContent: dependencies.fetchContent,
      cache: dependencies.cache,
    }),
  );
}
