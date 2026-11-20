/** Check a single snippet folder path against the Pages D1 binding. */
const MAX_DEPTH = 8;
const MAX_PARENTS = 90;
const ROOT_SQL = "SELECT id, name FROM Snippets WHERE parent_id IS NULL AND type = 'dir'";

declare const supportedPath: unique symbol;
type SupportedFolderPath = readonly string[] & { readonly [supportedPath]: true };
export type ProbeResult = "yes" | "no" | "unknown";

type Query = { all(): Promise<{ success: boolean; results?: unknown }> };
export type SnippetDatabase = {
  prepare(sql: string): Query & { bind(...ids: number[]): Query };
};

/** Copy a path that is safe for the bounded probe; otherwise leave it to the legacy lookup. */
function toSupportedFolderPath(segments: readonly string[]): SupportedFolderPath | undefined {
  if (!segments.length || segments.length > MAX_DEPTH) return undefined;
  if (segments.some((segment) => !segment.trim() || segment.includes("\u0000"))) return undefined;
  return [...segments] as unknown as SupportedFolderPath;
}

/** Read the directory chain. A binding failure or invalid result never proves absence. */
export async function folderExists(
  db: SnippetDatabase,
  segments: SupportedFolderPath,
): Promise<ProbeResult> {
  // Start at the root, then read children of every matching parent; duplicate
  // names can hide the real branch. Stop before issuing an over-wide query.
  // Only a successful, valid read can rule out a name. An empty root cannot
  // distinguish an empty database from a bad binding, so leave it unknown.
  let parents = new Set<number>();
  try {
    for (const [depth, segment] of segments.entries()) {
      if (parents.size > MAX_PARENTS) return "unknown";
      const query =
        depth === 0
          ? db.prepare(ROOT_SQL)
          : db
              .prepare(
                `SELECT id, name FROM Snippets WHERE parent_id IN (${Array(parents.size).fill("?").join(", ")}) AND type = 'dir'`,
              )
              .bind(...parents);
      const { success, results } = await query.all();
      if (!success || !Array.isArray(results) || (depth === 0 && !results.length)) return "unknown";

      const matches = new Set<number>();
      for (const entry of results as unknown[]) {
        if (!entry || typeof entry !== "object") return "unknown";
        const { id, name } = entry as { id?: unknown; name?: unknown };
        if (typeof id !== "number" || !Number.isSafeInteger(id) || typeof name !== "string") {
          return "unknown";
        }
        const trimmed = name.trim();
        if (!trimmed || trimmed.includes("\u0000")) return "unknown";
        if (trimmed === segment) matches.add(id);
      }
      if (!matches.size) return "no";
      parents = matches;
    }
    return "yes";
  } catch {
    return "unknown";
  }
}

/** Skip D1 when the binding or a supported path is absent. */
export async function probeSnippetFolder(
  db: SnippetDatabase | undefined,
  segments: readonly string[],
): Promise<ProbeResult> {
  const path = db && toSupportedFolderPath(segments);
  return db && path ? folderExists(db, path) : "unknown";
}
