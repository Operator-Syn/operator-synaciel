import { ChevronLeft, ChevronRight } from "lucide-react";

type PaginationControlsProps = {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  itemLabel: string;
  onPageChange: (page: number) => void;
};

export default function PaginationControls({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  itemLabel,
  onPageChange,
}: PaginationControlsProps) {
  if (totalPages <= 1) return null;

  const firstVisibleItem = (currentPage - 1) * pageSize + 1;
  const lastVisibleItem = Math.min(currentPage * pageSize, totalItems);
  const pages = Array.from({ length: totalPages }, (_, index) => index + 1);

  return (
    <div className="mt-8 flex flex-col gap-4 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="font-mono text-meta uppercase tracking-[0.06em] text-text-muted">
        Showing {firstVisibleItem}-{lastVisibleItem} of {totalItems} {itemLabel}
      </p>

      <nav
        className="flex flex-wrap items-center justify-end gap-2"
        aria-label={`${itemLabel} pages`}
      >
        <button
          aria-label="Previous page"
          className="inline-grid min-h-10 min-w-10 place-items-center border border-line-strong bg-transparent text-text transition-colors hover:border-signal hover:text-signal disabled:opacity-40"
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
          title="Previous page"
          type="button"
        >
          <ChevronLeft aria-hidden="true" size={18} />
        </button>

        {pages.map((page) => (
          <button
            aria-current={page === currentPage ? "page" : undefined}
            className={`inline-grid min-h-10 min-w-10 place-items-center border bg-transparent font-mono text-meta transition-colors ${page === currentPage ? "border-signal bg-signal text-canvas" : "border-line-strong text-text hover:border-signal hover:text-signal"}`}
            key={page}
            onClick={() => onPageChange(page)}
            type="button"
          >
            {page}
          </button>
        ))}

        <button
          aria-label="Next page"
          className="inline-grid min-h-10 min-w-10 place-items-center border border-line-strong bg-transparent text-text transition-colors hover:border-signal hover:text-signal disabled:opacity-40"
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          title="Next page"
          type="button"
        >
          <ChevronRight aria-hidden="true" size={18} />
        </button>
      </nav>
    </div>
  );
}
