import { ArrowLeft, ArrowRight } from "lucide-react";

type CursorPaginationVariant = "project" | "certificate";

interface CursorPaginationControlsProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  visibleItemCount?: number;
  itemLabel: string;
  hasNextPage: boolean;
  isFetching?: boolean;
  variant?: CursorPaginationVariant;
  onPreviousPage: () => void;
  onNextPage: () => void;
}

export default function CursorPaginationControls({
  currentPage,
  totalItems,
  pageSize,
  visibleItemCount,
  itemLabel,
  hasNextPage,
  isFetching = false,
  variant = "project",
  onPreviousPage,
  onNextPage,
}: CursorPaginationControlsProps) {
  if (totalItems === 0) return null;

  const firstVisibleItem = (currentPage - 1) * pageSize + 1;
  const visibleCount = visibleItemCount ?? pageSize;
  const lastVisibleItem = Math.min(firstVisibleItem + visibleCount - 1, totalItems);
  const classes =
    variant === "certificate"
      ? {
          label: "certificate-pagination-label",
          nav: "certificate-pagination-nav",
          number: "certificate-pagination-number is-active",
          root: "certificate-pagination",
          button: "certificate-pagination-button",
        }
      : {
          label: "project-archive-pagination-label",
          nav: "project-archive-pagination-nav",
          number: "project-archive-page-number",
          root: "project-archive-pagination",
          button: "project-archive-page-button",
        };

  return (
    <div
      aria-busy={isFetching}
      className={isFetching ? `${classes.root} is-fetching` : classes.root}
    >
      <output className="sr-only">{isFetching ? `Updating ${itemLabel}` : ""}</output>
      <p className={classes.label}>
        {firstVisibleItem}–{lastVisibleItem} of {totalItems} {itemLabel}
      </p>

      <nav aria-label={`${itemLabel} pages`} className={classes.nav}>
        {isFetching && (
          <span aria-hidden="true" className="loading-inline-progress">
            <span className="loading-inline-signal" />
          </span>
        )}
        <button
          aria-label="Previous page"
          className={classes.button}
          disabled={currentPage === 1 || isFetching}
          onClick={onPreviousPage}
          title="Previous page"
          type="button"
        >
          <ArrowLeft aria-hidden="true" size={17} />
        </button>

        <span aria-current="page" className={classes.number}>
          {currentPage}
        </span>

        <button
          aria-label="Next page"
          className={classes.button}
          disabled={!hasNextPage || isFetching}
          onClick={onNextPage}
          title="Next page"
          type="button"
        >
          <ArrowRight aria-hidden="true" size={17} />
        </button>
      </nav>
    </div>
  );
}
