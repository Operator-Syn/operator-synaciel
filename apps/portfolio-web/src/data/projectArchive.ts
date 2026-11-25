/**
 * Project archive access shared by the React page and the Pages Function.
 *
 * The public archive endpoint is the only source of project data. It is cursor-paginated and caps a
 * page at twelve records, so every reader here walks it the same way: request the maximum page size,
 * follow `next_cursor`, and prove completeness before treating an absent id as missing.
 *
 * Two callers need different cache semantics, so the cache is an injected dependency rather than a
 * default: the existence check must read the origin every time (a stale list would let it 404 a live
 * project), while the sitemap and the archive's own ItemList read through the edge cache on purpose.
 * The walk itself is one implementation — {@link walkProjectPages} — with the stop condition as a
 * parameter.
 */

import { type ContentCache, fetchContentText } from "../../functions/contentFetch.ts";
import type { MediaItem } from "../types/MediaCardTypes.ts";

/** The archive's maximum page size, and the value every caller asks for. */
export const PROJECT_ARCHIVE_PAGE_SIZE = 12;

/** Hard ceiling on pages per walk, independent of what the API reports. */
export const PROJECT_WALK_MAX_PAGES = 10;

/** One gallery item as the archive returns it. */
export interface ApiGalleryItem {
  readonly id: number;
  readonly project_id: number;
  readonly type: "image" | "video";
  readonly url: string;
  readonly display_order: number;
}

/** One project as the archive returns it. */
export interface ApiProject {
  readonly id: number;
  readonly title: string;
  readonly type: "image" | "video";
  readonly url: string;
  readonly short_description: string;
  readonly long_description: string;
  readonly project_link: string;
  readonly categories: readonly string[];
  readonly stack: readonly string[];
  readonly highlights: readonly string[];
  readonly display_order: number;
  readonly created_at: string;
  readonly gallery: readonly ApiGalleryItem[];
}

/** The fields one archive page carries, independent of where the body came from. */
export interface ProjectPage {
  readonly projects: readonly ApiProject[];
  readonly total: number;
  readonly hasMore: boolean;
  readonly nextCursor: string | null;
}

/** A page read, with the cache provenance the existence walk needs to judge it. */
export type ProjectPageResult =
  | ({ readonly ok: true; readonly fromCache: boolean } & ProjectPage)
  | { readonly ok: false; readonly reason: string };

/** Reads one archive page. Injected so callers choose their own transport and cache. */
export type ProjectPageFetcher = (cursor: string | null) => Promise<ProjectPageResult>;

/** The three-state answer to "does this project exist, and what are its facts?". */
export type ProjectLookup =
  | { readonly status: "found"; readonly project: ApiProject }
  | { readonly status: "missing" }
  | { readonly status: "unknown"; readonly reason: string };

/** A complete enumeration, or the reason it could not be completed. */
export type ProjectCollection =
  | { readonly ok: true; readonly projects: readonly ApiProject[] }
  | { readonly ok: false; readonly reason: string };

/**
 * Build one archive page URL.
 *
 * @param base The API base, with or without a trailing slash, e.g. `https://host/api`.
 * @param cursor The cursor of the page to read, or `null` for the first page.
 * @returns The absolute URL, always asking for {@link PROJECT_ARCHIVE_PAGE_SIZE} records.
 */
export function projectArchiveUrl(base: string, cursor: string | null): string {
  const params = new URLSearchParams({ limit: String(PROJECT_ARCHIVE_PAGE_SIZE) });
  if (cursor) params.set("cursor", cursor);
  return `${base.replace(/\/+$/, "")}/v2/projects/archive?${params.toString()}`;
}

/** Read a string property from an unknown object. */
function readString(value: unknown, key: string): string | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const candidate = (value as Record<string, unknown>)[key];
  return typeof candidate === "string" ? candidate : undefined;
}

/** Read an array-of-strings property, defaulting to an empty list. */
function readStringArray(value: unknown, key: string): readonly string[] {
  if (typeof value !== "object" || value === null) return [];
  const candidate = (value as Record<string, unknown>)[key];
  if (!Array.isArray(candidate)) return [];
  return candidate.filter((entry): entry is string => typeof entry === "string");
}

/** Narrow one gallery entry, or `undefined` when it is not a usable media item. */
function readGalleryItem(value: unknown): ApiGalleryItem | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const record = value as Record<string, unknown>;
  if (!Number.isSafeInteger(record.id) || typeof record.url !== "string") return undefined;
  if (record.type !== "image" && record.type !== "video") return undefined;
  return {
    id: Number(record.id),
    project_id: typeof record.project_id === "number" ? record.project_id : 0,
    type: record.type,
    url: record.url,
    display_order: typeof record.display_order === "number" ? record.display_order : 0,
  };
}

/**
 * Narrow one project entry.
 *
 * Entries without a positive integer `id` or a string `title` are skipped rather than failing the
 * page: the archive is data, and one malformed row must not turn a live page into an error. A skipped
 * row also keeps the completeness proof honest — it is counted in `total` but never marked seen, so
 * the walk answers `unknown` instead of `missing`.
 */
function readProject(value: unknown): ApiProject | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const record = value as Record<string, unknown>;
  if (!Number.isSafeInteger(record.id) || Number(record.id) <= 0) return undefined;
  const title = readString(value, "title");
  if (!title) return undefined;

  const gallery = Array.isArray(record.gallery)
    ? record.gallery
        .map(readGalleryItem)
        .filter((item): item is ApiGalleryItem => item !== undefined)
    : [];

  return {
    id: Number(record.id),
    title,
    type: record.type === "video" ? "video" : "image",
    url: readString(value, "url") ?? "",
    short_description: readString(value, "short_description") ?? "",
    long_description: readString(value, "long_description") ?? "",
    project_link: readString(value, "project_link") ?? "",
    categories: readStringArray(value, "categories"),
    stack: readStringArray(value, "stack"),
    highlights: readStringArray(value, "highlights"),
    display_order: typeof record.display_order === "number" ? record.display_order : 0,
    created_at: readString(value, "created_at") ?? "",
    gallery,
  };
}

/**
 * Parse one archive response body.
 *
 * Algorithm:
 * 1. Decode JSON; a body that is not an object with an array `data` is unreadable → `null`.
 * 2. Require a `pagination` object carrying a finite `total` and a boolean `has_more`; its
 *    `next_cursor` is a string or `null`.
 * 3. Narrow each entry with {@link readProject}, dropping the ones that are not usable.
 *
 * @param body The response body text.
 * @returns The page, or `null` when the body cannot be trusted.
 */
export function readProjectPageBody(body: string): ProjectPage | null {
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return null;
  }

  if (typeof payload !== "object" || payload === null) return null;
  const record = payload as Record<string, unknown>;
  if (!Array.isArray(record.data)) return null;

  const pagination = record.pagination;
  if (typeof pagination !== "object" || pagination === null) return null;
  const paginationRecord = pagination as Record<string, unknown>;
  const { total, has_more: hasMore } = paginationRecord;
  if (typeof total !== "number" || !Number.isFinite(total) || total < 0) return null;
  if (typeof hasMore !== "boolean") return null;

  const nextCursor =
    typeof paginationRecord.next_cursor === "string" ? paginationRecord.next_cursor : null;

  return {
    projects: record.data
      .map(readProject)
      .filter((project): project is ApiProject => Boolean(project)),
    total,
    hasMore,
    nextCursor,
  };
}

/**
 * Build the page fetcher used by every caller.
 *
 * @param options.base API base, e.g. `https://host/api`.
 * @param options.fetchContent Injected transport, for tests and for the sitemap's own stub.
 * @param options.cache Injected cache. Pass a no-op cache to force every read to the origin.
 * @param options.timeoutMs Hard ceiling per request.
 * @param options.cacheTtlSeconds Lifetime of a successful body in the injected cache.
 * @returns A fetcher that parses each page and reports whether it came from the cache.
 */
export function createProjectPageFetcher(options: {
  readonly base: string;
  readonly fetchContent?: typeof fetch;
  readonly cache?: ContentCache;
  readonly timeoutMs?: number;
  readonly cacheTtlSeconds?: number;
}): ProjectPageFetcher {
  const { base, fetchContent, cache, timeoutMs = 4000, cacheTtlSeconds = 3600 } = options;

  return async (cursor) => {
    const result = await fetchContentText(projectArchiveUrl(base, cursor), {
      timeoutMs,
      cacheTtlSeconds,
      fetchContent,
      cache,
    });
    if (!result.ok) {
      return {
        ok: false,
        reason: result.reason === "http" ? `http ${result.status}` : result.reason,
      };
    }

    const page = readProjectPageBody(result.body);
    if (!page) return { ok: false, reason: "malformed body" };

    return { ok: true, ...page, fromCache: result.fromCache };
  };
}

type WalkOutcome =
  | { readonly kind: "found"; readonly project: ApiProject }
  | { readonly kind: "complete"; readonly projects: readonly ApiProject[] }
  | { readonly kind: "unknown"; readonly reason: string };

/**
 * Walk the archive once, stopping early on an id or at the end of the collection.
 *
 * Algorithm:
 * 1. For each page: fetch it and bail out on a transport or parse failure.
 * 2. Reject a page served from cache when the caller requires an origin read.
 * 3. Require the page's `total` to match the first page's, and reject a page wider than the limit.
 * 4. Record each entry; stop at `stopAtId` when the caller supplied one.
 * 5. When `has_more` is false, accept completeness only if the number of distinct ids seen equals
 *    `total`; otherwise the walk is incomplete and the answer is `unknown`.
 * 6. Otherwise require a fresh, non-repeating cursor and continue, refusing to exceed the page count
 *    the reported `total` implies or the caller's ceiling.
 *
 * The completeness rule is the reason this exists: a cursor walk is not a snapshot, so "absent from
 * the last page" is only evidence when the pages add up to the reported collection.
 *
 * @param fetchPage The page reader.
 * @param options.maxPages Ceiling on pages per walk.
 * @param options.rejectCached Whether a cache-served page invalidates the walk.
 * @param options.stopAtId Id to stop on, for an existence check.
 * @returns The found project, the complete collection, or why the walk could not answer.
 */
async function walkProjectPages(
  fetchPage: ProjectPageFetcher,
  options: {
    readonly maxPages: number;
    readonly rejectCached: boolean;
    readonly stopAtId?: number;
  },
): Promise<WalkOutcome> {
  const { maxPages, rejectCached, stopAtId } = options;
  const seen = new Map<number, ApiProject>();
  const cursors = new Set<string>();
  let cursor: string | null = null;
  let total: number | null = null;

  for (let pageIndex = 0; pageIndex < maxPages; pageIndex += 1) {
    const page = await fetchPage(cursor);
    if (!page.ok) return { kind: "unknown", reason: `page ${pageIndex + 1}: ${page.reason}` };
    if (rejectCached && page.fromCache) {
      return { kind: "unknown", reason: `page ${pageIndex + 1}: served from cache` };
    }
    if (page.projects.length > PROJECT_ARCHIVE_PAGE_SIZE) {
      return { kind: "unknown", reason: `page ${pageIndex + 1}: wider than the requested limit` };
    }
    // A page that reports more results but is not full is inconsistent: rows and the count were not
    // read together, so the walk cannot trust either.
    if (page.hasMore && page.projects.length !== PROJECT_ARCHIVE_PAGE_SIZE) {
      return {
        kind: "unknown",
        reason: `page ${pageIndex + 1}: short page while reporting more results`,
      };
    }
    if (total === null) {
      total = page.total;
    } else if (page.total !== total) {
      return { kind: "unknown", reason: "the reported total changed during the walk" };
    }

    for (const project of page.projects) {
      seen.set(project.id, project);
      if (stopAtId !== undefined && project.id === stopAtId) {
        return { kind: "found", project };
      }
    }

    if (seen.size > total) {
      return { kind: "unknown", reason: "the walk saw more projects than the reported total" };
    }

    if (!page.hasMore) {
      if (seen.size !== total) {
        return {
          kind: "unknown",
          reason: `the walk saw ${seen.size} of ${total} projects`,
        };
      }
      return { kind: "complete", projects: [...seen.values()] };
    }

    const next = page.nextCursor;
    if (!next) return { kind: "unknown", reason: "a page reported more results without a cursor" };
    if (cursors.has(next)) return { kind: "unknown", reason: "a cursor repeated during the walk" };
    cursors.add(next);
    cursor = next;

    const impliedPages = Math.ceil(total / PROJECT_ARCHIVE_PAGE_SIZE);
    if (pageIndex + 1 >= impliedPages) {
      return { kind: "unknown", reason: "the walk exceeded the page count its total implies" };
    }
  }

  return { kind: "unknown", reason: `the walk exceeded ${maxPages} pages` };
}

/**
 * Resolve one project by id.
 *
 * Absence is only reported when a fresh walk covered the whole collection; every other outcome is
 * `unknown`, so the caller serves the page instead of 404ing on a guess.
 *
 * @param fetchPage The page reader; pass one backed by a no-op cache for the production check.
 * @param id The project id.
 * @param options.maxPages Ceiling on pages per walk.
 * @returns `found`, `missing`, or `unknown` with the reason.
 */
export async function findProjectById(
  fetchPage: ProjectPageFetcher,
  id: number,
  options: { readonly maxPages?: number } = {},
): Promise<ProjectLookup> {
  if (!Number.isSafeInteger(id) || id <= 0) {
    return { status: "unknown", reason: "the id is not a positive integer" };
  }

  const outcome = await walkProjectPages(fetchPage, {
    maxPages: options.maxPages ?? PROJECT_WALK_MAX_PAGES,
    rejectCached: true,
    stopAtId: id,
  });

  if (outcome.kind === "found") return { status: "found", project: outcome.project };
  if (outcome.kind === "complete") return { status: "missing" };
  return { status: "unknown", reason: outcome.reason };
}

/**
 * Read the whole collection.
 *
 * Cached pages are valid here: the callers are the sitemap and the archive's ItemList, where a stale
 * member is harmless and a 503 is not.
 *
 * @param fetchPage The page reader.
 * @param options.maxPages Ceiling on pages per walk.
 * @returns The complete collection, or the reason it could not be completed.
 */
export async function collectAllProjects(
  fetchPage: ProjectPageFetcher,
  options: { readonly maxPages?: number } = {},
): Promise<ProjectCollection> {
  const outcome = await walkProjectPages(fetchPage, {
    maxPages: options.maxPages ?? PROJECT_WALK_MAX_PAGES,
    rejectCached: false,
  });

  if (outcome.kind === "complete") return { ok: true, projects: outcome.projects };
  if (outcome.kind === "found") return { ok: false, reason: "the walk stopped early" };
  return { ok: false, reason: outcome.reason };
}

/**
 * Map one API project onto the archive page's media shape.
 *
 * @param project The API record.
 * @returns The item the archive grid and the detail page render.
 */
export function toMediaItem(project: ApiProject): MediaItem {
  return {
    id: project.id,
    title: project.title,
    type: project.type,
    url: project.url,
    shortDescription: project.short_description,
    longDescription: project.long_description,
    projectLink: project.project_link,
    gallery: project.gallery.map((media) => ({ type: media.type, url: media.url })),
  };
}
