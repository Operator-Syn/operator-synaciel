/**
 * Scroll restoration for the archive routes.
 *
 * The problem this exists for: both archives fetch their rows after mount, so the document
 * is several hundred pixels shorter at the moment the browser performs its own scroll
 * restoration. The browser restores the saved offset against that short skeleton, the offset
 * clamps to the document's maximum, and when the rows arrive the reader is pinned to the
 * bottom of the page. Reloading `/projects` after reading the footer put you at the footer.
 *
 * So the offset is remembered here, the browser's restoration is turned off for the route,
 * and the position is applied once — after the rows exist and the height is final.
 *
 * Everything decision-shaped lives in pure functions so it can be tested without a browser;
 * the hook only wires storage, timing and one `scrollTo`.
 */

/** Key prefix; the route path is appended so each archive keeps its own position. */
const STORAGE_PREFIX = "archive-scroll:";

/** How close to the bottom counts as "the reader was at the end". */
const BOTTOM_TOLERANCE_PX = 2;

/** A saved position together with the document height at the time it was saved. */
export interface SavedScrollPosition {
  readonly y: number;
  readonly max: number;
}

/**
 * Parse a stored position.
 *
 * Algorithm:
 * 1. Treat a missing value as absent.
 * 2. Parse JSON and require a finite, non-negative `y`.
 * 3. Treat a missing or non-numeric `max` as unknown, reported as `0`.
 *
 * @param raw The stored string, or `null` when absent.
 * @returns The position, or `null` when the stored value is unusable.
 */
export function parseSavedScroll(raw: string | null): SavedScrollPosition | null {
  if (raw === null) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null) return null;
    const record = parsed as Record<string, unknown>;
    if (typeof record.y !== "number" || !Number.isFinite(record.y) || record.y < 0) return null;
    const max = typeof record.max === "number" && Number.isFinite(record.max) ? record.max : 0;
    return { y: record.y, max };
  } catch {
    return null;
  }
}

/**
 * Build the storage key for a route.
 *
 * @param path Route pathname as the router reports it.
 * @returns The key used in `sessionStorage`.
 */
export function scrollStorageKey(path: string): string {
  return `${STORAGE_PREFIX}${path}`;
}

/**
 * Decide whether a stored offset should be reapplied.
 *
 * Algorithm:
 * 1. A missing, non-numeric or negative value is not a position — do nothing.
 * 2. Zero means the reader was at the top; there is nothing to restore.
 * 3. Otherwise restore, clamped to the current maximum with {@link clampScrollOffset}.
 *
 * @param raw The stored string, or `null` when absent.
 * @param maxOffset The document's current maximum scroll offset.
 * @returns The offset to apply, or `null` when no restoration is warranted.
 */
export function resolveScrollRestore(raw: string | null, maxOffset: number): number | null {
  if (raw === null) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  if (parsed === 0) return null;
  return clampScrollOffset(parsed, maxOffset);
}

/**
 * Clamp an offset to what the document can actually scroll to.
 *
 * @param offset Requested offset.
 * @param maxOffset Maximum offset for the current document.
 * @returns The offset, bounded to `0..maxOffset`.
 */
export function clampScrollOffset(offset: number, maxOffset: number): number {
  if (maxOffset <= 0) return 0;
  return Math.min(Math.max(offset, 0), maxOffset);
}

/**
 * Report whether the reader is at the bottom of the document.
 *
 * Used to skip restoring a "bottom" position: a reader who left at the end of the archive
 * expects the top of the archive on a fresh visit, not the footer.
 *
 * @param offset Current scroll offset.
 * @param maxOffset Maximum offset for the current document.
 * @returns `true` when the reader is within a couple of pixels of the end.
 */
export function isAtDocumentEnd(offset: number, maxOffset: number): boolean {
  return maxOffset > 0 && offset >= maxOffset - BOTTOM_TOLERANCE_PX;
}

/**
 * Whether the saved position should be applied at all.
 *
 * A reader who left the page at the very bottom was looking at the footer, not at the
 * archive; restoring that position is what made a refresh look like a forced jump to the
 * bottom. In that case the page starts at the top instead.
 *
 * @param saved Resolved offset from {@link resolveScrollRestore}.
 * @param previousMaxOffset The document height at the time the offset was saved.
 * @returns `true` when the offset is worth reapplying.
 */
export function shouldRestoreOffset(saved: number | null, previousMaxOffset: number): boolean {
  if (saved === null) return false;
  return !isAtDocumentEnd(saved, previousMaxOffset);
}
