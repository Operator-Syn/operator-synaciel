import { ArrowLeft, ArrowRight } from "lucide-react";

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
    <div className="certificate-pagination">
      <p className="certificate-pagination-label">
        {firstVisibleItem}–{lastVisibleItem} of {totalItems} {itemLabel}
      </p>

      <nav aria-label={`${itemLabel} pages`} className="certificate-pagination-nav">
        <button
          aria-label="Previous page"
          className="certificate-pagination-button"
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
          title="Previous page"
          type="button"
        >
          <ArrowLeft aria-hidden="true" size={17} />
        </button>

        {pages.map((page) => (
          <button
            aria-current={page === currentPage ? "page" : undefined}
            className={`certificate-pagination-number ${page === currentPage ? "is-active" : ""}`}
            key={page}
            onClick={() => onPageChange(page)}
            type="button"
          >
            {page}
          </button>
        ))}

        <button
          aria-label="Next page"
          className="certificate-pagination-button"
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          title="Next page"
          type="button"
        >
          <ArrowRight aria-hidden="true" size={17} />
        </button>
      </nav>
    </div>
  );
}
