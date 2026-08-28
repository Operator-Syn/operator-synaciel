import { ArrowLeft, ArrowRight, ExternalLink, RotateCcw, X, ZoomIn, ZoomOut } from "lucide-react";
import {
  type CSSProperties,
  type AnimationEvent as ReactAnimationEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { isReducedMotionEnabled } from "../../preferences/sitePreferences";
import type { MediaItem } from "../../types/MediaCardTypes";
import MediaRenderer from "../mediaRenderer/MediaRenderer";

interface MediaModalProps {
  item: MediaItem | null;
  show: boolean;
  onClose: () => void;
  onExitComplete?: () => void;
  detailsLabel?: string;
  ctaLabel?: string;
}

type MediaView = {
  zoom: number;
  panX: number;
  panY: number;
};

type PointerPoint = {
  x: number;
  y: number;
};

type GestureState =
  | {
      type: "tap" | "pan";
      pointerId: number;
      startX: number;
      startY: number;
      startPanX: number;
      startPanY: number;
      moved: boolean;
    }
  | {
      type: "pinch";
      startDistance: number;
      startZoom: number;
      startPanX: number;
      startPanY: number;
      startCenterX: number;
      startCenterY: number;
    };

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.5;
const PAN_THRESHOLD = 6;
const DOUBLE_TAP_DELAY = 320;
const DOUBLE_TAP_DISTANCE = 32;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function getDistance(first: PointerPoint, second: PointerPoint) {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function getMidpoint(first: PointerPoint, second: PointerPoint) {
  return {
    x: (first.x + second.x) / 2,
    y: (first.y + second.y) / 2,
  };
}

export default function MediaModal({
  item,
  show,
  onClose,
  onExitComplete,
  detailsLabel = "About this Project",
  ctaLabel = "View Project Source",
}: MediaModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const mediaFrameRef = useRef<HTMLDivElement>(null);
  const mediaStageRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const previousBodyOverflowRef = useRef("");
  const hasCompletedExitRef = useRef(false);
  const viewRef = useRef<MediaView>({ zoom: MIN_ZOOM, panX: 0, panY: 0 });
  const pointersRef = useRef(new Map<number, PointerPoint>());
  const gestureRef = useRef<GestureState | null>(null);
  const lastTapRef = useRef<{ time: number; x: number; y: number } | null>(null);
  const viewerActivityTimeoutRef = useRef<number | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const [isViewerActive, setIsViewerActive] = useState(false);
  const [zoomScale, setZoomScale] = useState(MIN_ZOOM);
  const [hasPan, setHasPan] = useState(false);

  const handleModalAnimationEnd = (event: ReactAnimationEvent<HTMLDivElement>) => {
    if (
      show ||
      event.target !== event.currentTarget ||
      event.animationName !== "media-modal-backdrop-exit" ||
      hasCompletedExitRef.current
    ) {
      return;
    }

    hasCompletedExitRef.current = true;
    onExitComplete?.();
  };

  const gallery = useMemo(() => {
    if (!item) return [];
    return item.gallery && item.gallery.length > 0 ? item.gallery : [item];
  }, [item]);

  const activeMedia = gallery[activeIndex] ?? gallery[0];
  const canZoom = activeMedia?.type === "image";

  const markViewerActive = useCallback(() => {
    setIsViewerActive(true);
    if (viewerActivityTimeoutRef.current !== null) {
      window.clearTimeout(viewerActivityTimeoutRef.current);
    }
    viewerActivityTimeoutRef.current = window.setTimeout(() => {
      viewerActivityTimeoutRef.current = null;
      setIsViewerActive(false);
    }, 900);
  }, []);

  const updateView = useCallback((nextView: MediaView) => {
    const zoom = clamp(nextView.zoom, MIN_ZOOM, MAX_ZOOM);
    const frame = mediaFrameRef.current;
    const width = frame?.clientWidth ?? 0;
    const height = frame?.clientHeight ?? 0;
    const maxPanX = Math.max(0, (width * (zoom - 1)) / 2);
    const maxPanY = Math.max(0, (height * (zoom - 1)) / 2);
    const view = {
      zoom,
      panX: clamp(nextView.panX, -maxPanX, maxPanX),
      panY: clamp(nextView.panY, -maxPanY, maxPanY),
    };

    viewRef.current = view;
    const stage = mediaStageRef.current;
    stage?.style.setProperty("--media-zoom", String(view.zoom));
    stage?.style.setProperty("--media-pan-x", `${view.panX}px`);
    stage?.style.setProperty("--media-pan-y", `${view.panY}px`);
    setZoomScale((current) => (current === view.zoom ? current : view.zoom));
    setHasPan((current) => {
      const next = Math.abs(view.panX) > 0.5 || Math.abs(view.panY) > 0.5;
      return current === next ? current : next;
    });
  }, []);

  const resetMediaView = useCallback(() => {
    pointersRef.current.clear();
    gestureRef.current = null;
    lastTapRef.current = null;
    setIsPanning(false);
    updateView({ zoom: MIN_ZOOM, panX: 0, panY: 0 });
  }, [updateView]);

  const zoomAtPoint = useCallback(
    (targetZoom: number, clientX?: number, clientY?: number) => {
      const current = viewRef.current;
      const nextZoom = clamp(targetZoom, MIN_ZOOM, MAX_ZOOM);

      if (clientX === undefined || clientY === undefined) {
        updateView({ zoom: nextZoom, panX: current.panX, panY: current.panY });
        return;
      }

      const frame = mediaFrameRef.current;
      if (!frame) {
        updateView({ zoom: nextZoom, panX: current.panX, panY: current.panY });
        return;
      }

      const bounds = frame.getBoundingClientRect();
      const focalX = clientX - (bounds.left + bounds.width / 2);
      const focalY = clientY - (bounds.top + bounds.height / 2);
      const contentX = (focalX - current.panX) / current.zoom;
      const contentY = (focalY - current.panY) / current.zoom;

      updateView({
        zoom: nextZoom,
        panX: focalX - contentX * nextZoom,
        panY: focalY - contentY * nextZoom,
      });
    },
    [updateView],
  );

  const changeSlide = useCallback(
    (direction: number) => {
      if (gallery.length <= 1) return;
      resetMediaView();
      setActiveIndex((current) => (current + direction + gallery.length) % gallery.length);
    },
    [gallery.length, resetMediaView],
  );

  const showSlide = useCallback(
    (index: number) => {
      resetMediaView();
      setActiveIndex(index);
    },
    [resetMediaView],
  );

  useEffect(() => {
    return () => {
      if (viewerActivityTimeoutRef.current !== null) {
        window.clearTimeout(viewerActivityTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (show || !item) {
      hasCompletedExitRef.current = false;
      return;
    }

    if (isReducedMotionEnabled()) {
      hasCompletedExitRef.current = true;
      onExitComplete?.();
      return;
    }

    hasCompletedExitRef.current = false;
  }, [item, onExitComplete, show]);

  useEffect(() => {
    if (!item) return;

    previousBodyOverflowRef.current = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflowRef.current;
    };
  }, [item]);

  useEffect(() => {
    if (!show || !item) return;

    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    const focusFrame = window.requestAnimationFrame(() => dialogRef.current?.focus());

    return () => {
      window.cancelAnimationFrame(focusFrame);
    };
  }, [item, show]);

  useEffect(() => {
    if (!item) return;

    return () => {
      previouslyFocusedRef.current?.focus();
      previouslyFocusedRef.current = null;
    };
  }, [item]);

  useEffect(() => {
    if (!item) return;
    setActiveIndex(0);
    setIsViewerActive(false);
    resetMediaView();
  }, [item, resetMediaView]);

  const handleMediaPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!canZoom || (event.pointerType === "mouse" && event.button !== 0)) return;

    const target = event.target as Element;
    if (target.closest("button, a")) return;

    markViewerActive();
    event.preventDefault();
    const point = { x: event.clientX, y: event.clientY };
    pointersRef.current.set(event.pointerId, point);
    event.currentTarget.setPointerCapture(event.pointerId);

    if (pointersRef.current.size >= 2) {
      const points = Array.from(pointersRef.current.values());
      const center = getMidpoint(points[0], points[1]);
      gestureRef.current = {
        type: "pinch",
        startDistance: Math.max(getDistance(points[0], points[1]), 1),
        startZoom: viewRef.current.zoom,
        startPanX: viewRef.current.panX,
        startPanY: viewRef.current.panY,
        startCenterX: center.x,
        startCenterY: center.y,
      };
      setIsPanning(true);
      return;
    }

    const view = viewRef.current;
    gestureRef.current = {
      type: view.zoom > MIN_ZOOM ? "pan" : "tap",
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startPanX: view.panX,
      startPanY: view.panY,
      moved: false,
    };
    setIsPanning(false);
  };

  const handleMediaPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!canZoom || !pointersRef.current.has(event.pointerId)) return;

    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const points = Array.from(pointersRef.current.values());

    if (points.length >= 2) {
      let gesture = gestureRef.current;
      if (!gesture || gesture.type !== "pinch") {
        const center = getMidpoint(points[0], points[1]);
        gesture = {
          type: "pinch",
          startDistance: Math.max(getDistance(points[0], points[1]), 1),
          startZoom: viewRef.current.zoom,
          startPanX: viewRef.current.panX,
          startPanY: viewRef.current.panY,
          startCenterX: center.x,
          startCenterY: center.y,
        };
        gestureRef.current = gesture;
      }

      const center = getMidpoint(points[0], points[1]);
      const nextZoom =
        gesture.startZoom * (getDistance(points[0], points[1]) / gesture.startDistance);
      const frame = mediaFrameRef.current;
      if (!frame) return;

      const bounds = frame.getBoundingClientRect();
      const startFocalX = gesture.startCenterX - (bounds.left + bounds.width / 2);
      const startFocalY = gesture.startCenterY - (bounds.top + bounds.height / 2);
      const contentX = (startFocalX - gesture.startPanX) / gesture.startZoom;
      const contentY = (startFocalY - gesture.startPanY) / gesture.startZoom;
      const currentFocalX = center.x - (bounds.left + bounds.width / 2);
      const currentFocalY = center.y - (bounds.top + bounds.height / 2);

      updateView({
        zoom: nextZoom,
        panX: currentFocalX - contentX * nextZoom,
        panY: currentFocalY - contentY * nextZoom,
      });
      setIsPanning(true);
      return;
    }

    const gesture = gestureRef.current;
    if (!gesture || gesture.type === "pinch") return;

    const view = viewRef.current;
    if (view.zoom <= MIN_ZOOM) return;

    if (gesture.type === "tap") {
      gesture.type = "pan";
      gesture.startPanX = view.panX;
      gesture.startPanY = view.panY;
    }

    const deltaX = event.clientX - gesture.startX;
    const deltaY = event.clientY - gesture.startY;
    if (Math.abs(deltaX) < PAN_THRESHOLD && Math.abs(deltaY) < PAN_THRESHOLD) return;

    gesture.moved = true;
    updateView({
      zoom: view.zoom,
      panX: gesture.startPanX + deltaX,
      panY: gesture.startPanY + deltaY,
    });
    setIsPanning(true);
  };

  const handleMediaPointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    const isFinalPointer = pointersRef.current.size === 1;
    const isTap =
      isFinalPointer &&
      event.pointerType === "touch" &&
      (gesture?.type === "tap" || gesture?.type === "pan") &&
      !gesture.moved;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    pointersRef.current.delete(event.pointerId);

    if (isTap) {
      const now = performance.now();
      const previousTap = lastTapRef.current;
      const isDoubleTap =
        previousTap &&
        now - previousTap.time < DOUBLE_TAP_DELAY &&
        Math.hypot(event.clientX - previousTap.x, event.clientY - previousTap.y) <
          DOUBLE_TAP_DISTANCE;

      if (isDoubleTap) {
        event.preventDefault();
        zoomAtPoint(
          viewRef.current.zoom > MIN_ZOOM ? MIN_ZOOM : Math.min(MAX_ZOOM, MIN_ZOOM + ZOOM_STEP * 2),
          event.clientX,
          event.clientY,
        );
        lastTapRef.current = null;
      } else {
        lastTapRef.current = { time: now, x: event.clientX, y: event.clientY };
      }
    }

    if (pointersRef.current.size === 0) {
      gestureRef.current = null;
      setIsPanning(false);
      return;
    }

    if (pointersRef.current.size === 1 && viewRef.current.zoom > MIN_ZOOM) {
      const [pointerId, point] = Array.from(pointersRef.current.entries())[0];
      gestureRef.current = {
        type: "pan",
        pointerId,
        startX: point.x,
        startY: point.y,
        startPanX: viewRef.current.panX,
        startPanY: viewRef.current.panY,
        moved: false,
      };
      setIsPanning(false);
    }
  };

  const handleMediaPointerCancel = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    pointersRef.current.clear();
    gestureRef.current = null;
    lastTapRef.current = null;
    setIsPanning(false);
  };

  const handleMediaWheel = useCallback(
    (event: WheelEvent) => {
      if (!canZoom) return;

      event.preventDefault();
      markViewerActive();
      const delta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
      zoomAtPoint(viewRef.current.zoom * Math.exp(-delta * 0.0015), event.clientX, event.clientY);
    },
    [canZoom, markViewerActive, zoomAtPoint],
  );

  const handleMediaDoubleClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!canZoom || (event.target as Element).closest("button, a")) return;

    markViewerActive();
    event.preventDefault();
    zoomAtPoint(
      viewRef.current.zoom > MIN_ZOOM ? MIN_ZOOM : Math.min(MAX_ZOOM, MIN_ZOOM + ZOOM_STEP * 2),
      event.clientX,
      event.clientY,
    );
  };

  useEffect(() => {
    const frame = mediaFrameRef.current;
    if (!show || !canZoom || !frame) return;

    frame.addEventListener("wheel", handleMediaWheel, { passive: false });
    return () => frame.removeEventListener("wheel", handleMediaWheel);
  }, [canZoom, handleMediaWheel, show]);

  useEffect(() => {
    if (!item) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (event.key === "ArrowLeft" && gallery.length > 1) {
        event.preventDefault();
        changeSlide(-1);
        return;
      }

      if (event.key === "ArrowRight" && gallery.length > 1) {
        event.preventDefault();
        changeSlide(1);
        return;
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
        return;
      }

      if (!show) return;

      if (!canZoom) return;

      if (event.key === "+" || event.key === "=") {
        markViewerActive();
        event.preventDefault();
        zoomAtPoint(viewRef.current.zoom + ZOOM_STEP);
      } else if (event.key === "-" || event.key === "_") {
        markViewerActive();
        event.preventDefault();
        zoomAtPoint(viewRef.current.zoom - ZOOM_STEP);
      } else if (event.key === "0") {
        markViewerActive();
        event.preventDefault();
        resetMediaView();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [
    canZoom,
    changeSlide,
    gallery.length,
    item,
    markViewerActive,
    onClose,
    resetMediaView,
    show,
    zoomAtPoint,
  ]);

  if (!item || !activeMedia) return null;

  const hasMultipleSlides = gallery.length > 1;
  const modalTitleId = `media-modal-title-${item.id}`;
  const modalDetailsId = `media-modal-details-${item.id}`;
  const zoomPercentage = Math.round(zoomScale * 100);
  const mediaCursor = zoomScale > MIN_ZOOM ? (isPanning ? "grabbing" : "grab") : "zoom-in";
  const stageStyle = {
    "--media-zoom": viewRef.current.zoom,
    "--media-pan-x": `${viewRef.current.panX}px`,
    "--media-pan-y": `${viewRef.current.panY}px`,
  } as CSSProperties;

  return createPortal(
    <div
      aria-describedby={modalDetailsId}
      aria-labelledby={modalTitleId}
      aria-modal="true"
      className="media-modal-backdrop fixed inset-0 z-50 grid place-items-center bg-canvas/90 p-4 backdrop-blur-sm"
      data-state={show ? "open" : "closing"}
      data-cursor="zoom-out"
      onAnimationEnd={handleModalAnimationEnd}
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
          ref={mediaFrameRef}
          className={`media-modal-media ${canZoom ? "is-image" : "is-video"}${isPanning ? " is-interacting" : ""}`}
          data-cursor={mediaCursor}
          aria-label="Interactive image viewer"
          role="application"
          onDoubleClick={handleMediaDoubleClick}
          onPointerCancel={handleMediaPointerCancel}
          onPointerDown={handleMediaPointerDown}
          onPointerMove={handleMediaPointerMove}
          onPointerUp={handleMediaPointerEnd}
        >
          <div
            ref={mediaStageRef}
            className={`media-modal-media-stage${zoomScale > MIN_ZOOM ? " is-zoomed" : ""}${isPanning ? " is-interacting" : ""}`}
            data-cursor={mediaCursor}
            style={stageStyle}
          >
            <MediaRenderer
              alt={`${item.title} media ${activeIndex + 1}`}
              type={activeMedia.type}
              url={activeMedia.url}
              className="media-modal-renderer h-full w-full object-contain"
              cursorState={mediaCursor}
            />
          </div>

          {canZoom && (
            <div
              className={`media-modal-viewer-overlay${isPanning || isViewerActive ? " is-active" : ""}`}
            >
              <fieldset className="media-modal-viewer-tools">
                <legend className="sr-only">Image controls</legend>
                <button
                  aria-label="Zoom out image"
                  className="media-modal-viewer-tool"
                  data-cursor="zoom-out"
                  disabled={zoomScale <= MIN_ZOOM}
                  onClick={() => {
                    markViewerActive();
                    zoomAtPoint(viewRef.current.zoom - ZOOM_STEP);
                  }}
                  title="Zoom out"
                  type="button"
                >
                  <ZoomOut aria-hidden="true" size={16} />
                </button>
                <output
                  aria-live="polite"
                  aria-label={`Image zoom ${zoomPercentage} percent`}
                  className="media-modal-zoom-level"
                >
                  {zoomPercentage}%
                </output>
                <button
                  aria-label="Zoom in image"
                  className="media-modal-viewer-tool"
                  data-cursor="zoom-in"
                  disabled={zoomScale >= MAX_ZOOM}
                  onClick={() => {
                    markViewerActive();
                    zoomAtPoint(viewRef.current.zoom + ZOOM_STEP);
                  }}
                  title="Zoom in"
                  type="button"
                >
                  <ZoomIn aria-hidden="true" size={16} />
                </button>
                <button
                  aria-label="Reset image view"
                  className="media-modal-viewer-tool"
                  data-cursor="zoom-out"
                  disabled={!hasPan && zoomScale <= MIN_ZOOM}
                  onClick={() => {
                    markViewerActive();
                    resetMediaView();
                  }}
                  title="Reset view"
                  type="button"
                >
                  <RotateCcw aria-hidden="true" size={16} />
                </button>
              </fieldset>
              <p className="media-modal-viewer-hint">Scroll or pinch to zoom · drag to inspect</p>
            </div>
          )}

          {hasMultipleSlides && (
            <>
              <button
                aria-label="Previous media"
                className="media-modal-nav-button media-modal-nav-button-previous"
                data-cursor="move"
                onClick={() => changeSlide(-1)}
                type="button"
              >
                <ArrowLeft aria-hidden="true" size={19} />
              </button>
              <button
                aria-label="Next media"
                className="media-modal-nav-button media-modal-nav-button-next"
                data-cursor="move"
                onClick={() => changeSlide(1)}
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
                className={`media-modal-slide${index === activeIndex ? " is-active" : ""}`}
                key={`${media.type}-${media.url}`}
                onClick={() => showSlide(index)}
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
