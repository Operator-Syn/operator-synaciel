import { ChevronLeft, ChevronRight } from "lucide-react";
import "./PaginationControls.css";

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
        <div className="pagination-controls" aria-label={`${itemLabel} pagination`}>
            <p className="pagination-summary">
                Showing {firstVisibleItem}-{lastVisibleItem} of {totalItems} {itemLabel}
            </p>

            <nav className="pagination-actions" aria-label={`${itemLabel} pages`}>
                <button
                    aria-label="Previous page"
                    className="pagination-step"
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
                        className={`pagination-page ${page === currentPage ? "active" : ""}`}
                        key={page}
                        onClick={() => onPageChange(page)}
                        type="button"
                    >
                        {page}
                    </button>
                ))}

                <button
                    aria-label="Next page"
                    className="pagination-step"
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
