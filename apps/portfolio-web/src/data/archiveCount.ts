/**
 * The archive count line, e.g. `[ 8 projects ]`.
 *
 * Both archive pages render one extra card for the "future project"/"future certification" slot, so the
 * displayed count is the API's `pagination.total` plus one. The crawler-visible fragment shows the same line,
 * which is why this lives here rather than being spelled out in three places: the page and the fragment must
 * not be able to disagree about a number a reader can see.
 */

/**
 * Format an archive's count line.
 *
 * @param total The API's `pagination.total`.
 * @param noun Singular source label used in the line, e.g. `projects`.
 * @returns The line as the page renders it, including one future-card slot.
 */
export function formatArchiveCount(total: number, noun: string): string {
  return `[ ${total + 1} ${noun} ]`;
}
