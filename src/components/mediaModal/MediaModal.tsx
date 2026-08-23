import { ArrowLeft, ArrowRight, ExternalLink, X, ZoomIn, ZoomOut } from "lucide-react";
import {
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import type { MediaItem } from "../../types/MediaCardTypes";
import MediaRenderer from "../mediaRenderer/MediaRenderer";

interface MediaModalProps {
  item: MediaItem | null;
  show: boolean;
  onClose: () => void;
  detailsLabel?: string;
  ctaLabel?: string;
}

export default function MediaModal({
  item,
  show,
  onClose,
  detailsLabel = "About this Project",
  ctaLabel = "View Project Source",
}: MediaModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const panStartRef = useRef<{
    x: number;
    y: number;
    scrollLeft: number;
    scrollTop: number;
  } | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);

  const gallery = useMemo(() => {
    if (!item) return [];
    return item.gallery && item.gallery.length > 0 ? item.gallery : [item];
  }, [item]);

  useEffect(() => {
    if (!show || !item) return;

    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();

    return () => {
      document.body.style.overflow = "";
      previouslyFocusedRef.current?.focus();
    };
  }, [item, show]);

  useEffect(() => {
    if (!item) return;
    setActiveIndex(0);
    setIsPanning(false);
    setIsZoomed(false);
    panStartRef.current = null;
  }, [item]);

  useEffect(() => {
    if (!show) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") {
        setIsPanning(false);
        setIsZoomed(false);
        panStartRef.current = null;
        setActiveIndex((current) => (current - 1 + gallery.length) % gallery.length);
      }
      if (event.key === "ArrowRight") {
        setIsPanning(false);
        setIsZoomed(false);
        panStartRef.current = null;
        setActiveIndex((current) => (current + 1) % gallery.length);
      }

      if (event.key === "Tab") {
        const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
          "button:not(:disabled), a[href], [tabindex]:not([tabindex='-1'])",
        );

        if (!focusable || focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [gallery.length, onClose, show]);

  if (!show || !item || gallery.length === 0) return null;

  const activeMedia = gallery[activeIndex];
  const hasMultipleSlides = gallery.length > 1;
  const canZoom = activeMedia.type === "image";
  const modalTitleId = `media-modal-title-${item.id}`;
  const modalDetailsId = `media-modal-details-${item.id}`;

  const handleMediaPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!isZoomed || !canZoom || event.pointerType === "touch") return;

    panStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      scrollLeft: event.currentTarget.scrollLeft,
      scrollTop: event.currentTarget.scrollTop,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsPanning(true);
  };

  const handleMediaPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = panStartRef.current;
    if (!start) return;

    event.currentTarget.scrollLeft = start.scrollLeft - (event.clientX - start.x);
    event.currentTarget.scrollTop = start.scrollTop - (event.clientY - start.y);
  };

  const endMediaPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    panStartRef.current = null;
    setIsPanning(false);
  };

  return createPortal(
    <div
      aria-describedby={modalDetailsId}
      aria-labelledby={modalTitleId}
      aria-modal="true"
      className="media-modal-backdrop fixed inset-0 z-50 grid place-items-center bg-canvas/90 p-4 backdrop-blur-sm"
      data-cursor="zoom-out"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="dialog"
    >
      <div ref={dialogRef} className="media-modal" data-cursor="default" tabIndex={-1}>
        <header className="media-modal-header">
          <div className="min-w-0">
            <p className="eyebrow media-modal-kicker">
              {activeMedia.type} / {activeIndex + 1} of {gallery.length}
            </p>
            <h2 id={modalTitleId} className="media-modal-title">
              {item.title}
            </h2>
          </div>
          <button
            aria-label="Close dialog"
            className="media-modal-close"
            onClick={onClose}
            type="button"
          >
            <X aria-hidden="true" size={20} />
          </button>
        </header>

        <div
          className={`media-modal-media ${isZoomed && canZoom ? "is-zoomed" : ""}`}
          data-cursor={isZoomed && canZoom ? "all-scroll" : undefined}
          onPointerCancel={endMediaPan}
          onPointerDown={handleMediaPointerDown}
          onPointerMove={handleMediaPointerMove}
          onPointerUp={endMediaPan}
        >
          <div
            className={`media-modal-media-stage ${isZoomed && canZoom ? "is-zoomed" : ""}`}
            data-cursor={isZoomed && canZoom ? "all-scroll" : undefined}
          >
            <MediaRenderer
              alt={`${item.title} media ${activeIndex + 1}`}
              type={activeMedia.type}
              url={activeMedia.url}
              className={`media-modal-renderer h-full w-full object-contain ${isZoomed && canZoom ? "scale-150" : ""}`}
              cursorState={isZoomed && canZoom ? (isPanning ? "grabbing" : "grab") : undefined}
            />
          </div>

          {hasMultipleSlides && (
            <>
              <button
                aria-label="Previous media"
                className="media-modal-nav-button media-modal-nav-button-previous"
                data-cursor="move"
                onClick={() => {
                  setIsPanning(false);
                  setIsZoomed(false);
                  panStartRef.current = null;
                  setActiveIndex((current) => (current - 1 + gallery.length) % gallery.length);
                }}
                type="button"
              >
                <ArrowLeft aria-hidden="true" size={19} />
              </button>
              <button
                aria-label="Next media"
                className="media-modal-nav-button media-modal-nav-button-next"
                data-cursor="move"
                onClick={() => {
                  setIsPanning(false);
                  setIsZoomed(false);
                  panStartRef.current = null;
                  setActiveIndex((current) => (current + 1) % gallery.length);
                }}
                type="button"
              >
                <ArrowRight aria-hidden="true" size={19} />
              </button>
            </>
          )}
        </div>

        {hasMultipleSlides && (
          <nav className="media-modal-slide-nav" aria-label="Media slides">
            {gallery.map((media, index) => (
              <button
                aria-label={`Show media ${index + 1}`}
                aria-current={index === activeIndex ? "true" : undefined}
                className={`media-modal-slide ${index === activeIndex ? "is-active" : ""}`}
                key={`${media.url}-${index}`}
                onClick={() => {
                  setIsPanning(false);
                  setIsZoomed(false);
                  panStartRef.current = null;
                  setActiveIndex(index);
                }}
                type="button"
              />
            ))}
          </nav>
        )}

        <div className="media-modal-details">
          <p className="eyebrow media-modal-details-label">{detailsLabel}</p>
          <p id={modalDetailsId} className="media-modal-copy">
            {item.longDescription}
          </p>
        </div>

        <footer className="media-modal-footer">
          <div className="media-modal-actions">
            {canZoom && (
              <button
                aria-label={isZoomed ? "Zoom out media" : "Zoom in media"}
                className="action-quiet media-modal-action"
                data-cursor={isZoomed ? "zoom-out" : "zoom-in"}
                onClick={() => setIsZoomed((current) => !current)}
                type="button"
              >
                {isZoomed ? (
                  <ZoomOut aria-hidden="true" size={16} />
                ) : (
                  <ZoomIn aria-hidden="true" size={16} />
                )}
                <span>{isZoomed ? "Zoom out" : "Zoom in"}</span>
              </button>
            )}
            <button className="action-quiet media-modal-action" onClick={onClose} type="button">
              Close
            </button>
            {item.projectLink && (
              <a
                className="action-signal media-modal-action"
                href={item.projectLink}
                rel="noopener noreferrer"
                target="_blank"
              >
                {ctaLabel}
                <ExternalLink aria-hidden="true" size={16} />
              </a>
            )}
          </div>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
