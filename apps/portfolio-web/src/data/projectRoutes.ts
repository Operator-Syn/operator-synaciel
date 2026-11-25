/**
 * URL grammar and head copy for `/projects/:id/:slug` detail pages.
 *
 * The project archive carries no slug column, so the id is the identity and the
 * slug is derived from the title. Both the Pages Function and the React page
 * import this module, so the URL a crawler sees and the URL the app navigates to
 * cannot be built from two different rules.
 */

import { clampDescription } from "./socialPreview.ts";

/** The archive route every detail URL is nested under. */
export const PROJECTS_ARCHIVE_PATH = "/projects";

/** One detail path: an id, optionally followed by its slug. Digits are mandatory. */
const PROJECT_DETAIL_PATH = /^\/projects\/(\d+)(?:\/([^/]+))?$/;

/** Fallback slug for a title with no alphanumerics, mirroring `slugifySnippetName`. */
const FALLBACK_SLUG = "project";

/**
 * Derive a project's URL slug from its title.
 *
 * Algorithm:
 * 1. Decompose accented characters (NFKD) and drop the combining marks, so `Café` becomes `Cafe`.
 * 2. Lowercase. This is mandatory, not cosmetic: `createCanonicalRouteRedirect` lowercases the whole
 *    request path, so a mixed-case canonical slug would redirect to itself forever.
 * 3. Collapse every run of characters outside `[a-z0-9]` into a single `-`, then trim the ends.
 * 4. Fall back to `project` when nothing survives, so the path always has a segment.
 *
 * @param title The project title exactly as the API stores it.
 * @returns A lowercase, ASCII, non-empty slug.
 */
export function projectSlug(title: string): string {
  const slug = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || FALLBACK_SLUG;
}

/**
 * Build a project's canonical detail path.
 *
 * @param id The project's numeric id.
 * @param title The project title, used only for the slug.
 * @returns `/projects/<id>/<slug>`, with the slug percent-encoded.
 */
export function projectPath(id: number, title: string): string {
  return `${PROJECTS_ARCHIVE_PATH}/${id}/${encodeURIComponent(projectSlug(title))}`;
}

/**
 * A parsed detail path, keeping both segments exactly as the request wrote them.
 *
 * Both raw spellings matter: `/projects/08/...`, `/projects/8/b%61i-...` and `/projects/8/bai-...` are
 * the same project, and only the last is canonical. Decoding before the canonical check would erase the
 * difference and publish a second indexable URL, so the segments are kept verbatim.
 */
export interface ParsedProjectPath {
  readonly id: number;
  /** The id segment exactly as written, e.g. `08`. */
  readonly idText: string;
  /** The slug segment exactly as written, including any percent-encoding, or `null` for a bare id. */
  readonly slugText: string | null;
}

/**
 * Parse a request path as a project detail path.
 *
 * Trailing slashes are tolerated so the caller can use this both before and after normalisation;
 * everything else is strict. `id` must be a positive safe integer, so `/projects/garbage` and
 * `/projects/garbage/x` are not detail paths and stay 404s.
 *
 * @param pathname A request pathname, with or without a trailing slash.
 * @returns The parsed id and slug, or `null` when the path is not a detail path.
 */
export function parseProjectPath(pathname: string): ParsedProjectPath | null {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const match = PROJECT_DETAIL_PATH.exec(normalized);
  if (!match) return null;

  const id = Number.parseInt(match[1], 10);
  if (!Number.isSafeInteger(id) || id <= 0) return null;

  return { id, idText: match[1], slugText: match[2] ?? null };
}

/**
 * Whether a path is a project detail path.
 *
 * @param pathname A request pathname.
 * @returns True when {@link parseProjectPath} accepts it.
 */
export function matchesProjectPath(pathname: string): boolean {
  return parseProjectPath(pathname) !== null;
}

/**
 * Whether a parsed path is the project's one canonical URL.
 *
 * Both segments are compared **as written**, not decoded: `/projects/08/...` and
 * `/projects/8/%62ai-...` are the same project in a different URL form, and decoding before the
 * comparison would serve each of them as a second indexable page with its own self-canonical.
 *
 * @param project The resolved project.
 * @param path The parsed request path.
 * @returns True only for `/projects/<plain id>/<derived slug>`, both spelled exactly.
 */
export function isCanonicalProjectPath(
  project: { readonly id: number; readonly title: string },
  path: ParsedProjectPath,
): boolean {
  return path.idText === String(project.id) && path.slugText === projectSlug(project.title);
}

/**
 * The description a project page advertises.
 *
 * The project's own summary, clamped to the 155-character ceiling the other indexable routes use. No
 * copy is invented for a short summary; the data's own sentence is the description.
 *
 * @param project The project record.
 * @returns The summary, truncated on a word boundary when it exceeds the ceiling.
 */
export function projectPageDescription(project: { readonly short_description: string }): string {
  return clampDescription(project.short_description);
}

/**
 * Restrict a project's outbound link to an absolute `http(s)` URL.
 *
 * The archive is data, and the link is rendered in two surfaces — the crawler fragment and the page's
 * call to action — so the check lives here rather than in either one. A `javascript:`, `data:`, or
 * relative value is dropped, never escaped into a URL.
 *
 * @param value The stored `project_link`.
 * @returns The absolute http(s) URL, or `undefined` when it is not usable.
 */
export function safeExternalHref(value: string): string | undefined {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Fragment filename stem for a project's prerendered body.
 *
 * Shared by the writer (`scripts/prerender.ts`) and the reader (`functions/_middleware.ts`) so one
 * naming rule exists. Every id has a stem, independent of whether the build wrote the file.
 *
 * @param id The project id.
 * @returns `/prerender/<stem>.html`'s stem.
 */
export function projectPrerenderSlug(id: number): string {
  return `project-${id}`;
}
