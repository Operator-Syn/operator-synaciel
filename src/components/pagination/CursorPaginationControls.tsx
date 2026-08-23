import { ArrowLeft, ArrowRight } from "lucide-react";

interface CursorPaginationControlsProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  itemLabel: string;
  hasNextPage: boolean;
  isFetching?: boolean;
  onPreviousPage: () => void;
  onNextPage: () => void;
}

export default function CursorPaginationControls({
  currentPage,
  totalItems,
  pageSize,
  itemLabel,
  hasNextPage,
  isFetching = false,
  onPreviousPage,
  onNextPage,
}: CursorPaginationControlsProps) {
  if (totalItems === 0) return null;

  const firstVisibleItem = (currentPage - 1) * pageSize + 1;
  const lastVisibleItem = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="project-archive-pagination">
      <p className="project-archive-pagination-label">
        {firstVisibleItem}–{lastVisibleItem} of {totalItems} {itemLabel}
      </p>

      <nav aria-label={`${itemLabel} pages`} className="project-archive-pagination-nav">
        <button
          aria-label="Previous page"
          className="project-archive-page-button"
          disabled={currentPage === 1 || isFetching}
          onClick={onPreviousPage}
          title="Previous page"
          type="button"
        >
          <ArrowLeft aria-hidden="true" size={17} />
        </button>

        <span aria-current="page" className="project-archive-page-number">
          {currentPage}
        </span>

        <button
          aria-label="Next page"
          className="project-archive-page-button"
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
