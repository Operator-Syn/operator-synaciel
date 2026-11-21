/**
 * Decide whether an archive's cursor controls should be rendered.
 *
 * Algorithm:
 * 1. The controls carry the only "Previous" affordance, so hiding them whenever
 *    `hasMore` is false would strand a visitor on the last page of a long archive.
 * 2. They are therefore hidden only in the single state where they have nothing
 *    to do: one page of results, on the first page.
 *
 * @param hasMore Whether the API reported another page beyond this one.
 * @param currentPage The one-based page the archive is showing.
 * @returns True when the controls should be rendered.
 */
export function shouldShowArchivePagination(hasMore: boolean, currentPage: number): boolean {
  return hasMore || currentPage > 1;
}
