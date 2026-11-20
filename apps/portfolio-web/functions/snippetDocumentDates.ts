/**
 * Publication date for a snippet document, read from the Pages D1 binding.
 *
 * A snippet becomes public when it is uploaded, so the row's `created_at` is
 * the publication event and `article:published_time` can be sourced from it
 * without inventing a timestamp. `modified_at` stays a separate value.
 *
 * Reads are single-row primary-key lookups. Any failure returns `undefined` so
 * the caller emits no date tag rather than a wrong one.
 */
import type { SnippetDatabase } from "./snippetFolderProbe.ts";

const CREATED_AT_SQL = "SELECT created_at FROM Snippets WHERE id = ? AND type = 'file' LIMIT 1";

/**
 * Convert a stored timestamp to ISO 8601.
 *
 * D1 stores `datetime('now')` as UTC without a timezone suffix, so a bare
 * `YYYY-MM-DD HH:MM:SS` value is marked `Z` before parsing; anything else is
 * parsed as given. Returns `undefined` for non-strings and unparsable values.
 */
export function parseSnippetTimestamp(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(trimmed)
    ? `${trimmed.replace(" ", "T")}Z`
    : trimmed;
  const timestamp = Date.parse(normalized);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : undefined;
}

/**
 * Read a snippet document's publication date (the row's `created_at`).
 *
 * Skips D1 when the binding is absent or the id is not a positive integer.
 * Returns `undefined` on a missing row, a malformed timestamp, or any query
 * error; the header set then omits `article:published_time`.
 */
export async function readSnippetPublishedAt(
  db: SnippetDatabase | undefined,
  id: number,
): Promise<string | undefined> {
  if (!db || !Number.isSafeInteger(id) || id <= 0) return undefined;
  try {
    const { success, results } = await db.prepare(CREATED_AT_SQL).bind(id).all();
    if (!success || !Array.isArray(results) || !results.length) return undefined;
    const row = results[0];
    if (!row || typeof row !== "object") return undefined;
    return parseSnippetTimestamp((row as { created_at?: unknown }).created_at);
  } catch {
    return undefined;
  }
}
