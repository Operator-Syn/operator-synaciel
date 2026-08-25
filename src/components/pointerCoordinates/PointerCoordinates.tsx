import type { PointerEvent as ReactPointerEvent } from "react";
import { useEffect, useRef, useState } from "react";

type PointerKind = "mouse" | "pen" | "touch";
type PointerSurface = "page" | "native";

interface PointerPosition {
  kind: PointerKind;
  x: number;
  y: number;
}

interface PointerCoordinatesProps {
  activeSection?: number;
  className?: string;
  markerCount?: number;
}

const CONTACT_DISPLAY_TIMEOUT_MS = 900;
const HANDSHAKE_DWELL_TIMEOUT_MS = 760;
const HANDSHAKE_FEEDBACK_TIMEOUT_MS = 900;
const HANDSHAKE_TOUCH_MOVE_TOLERANCE_PX = 12;

type HandshakeState = "idle" | "arming" | "complete";

function formatCoordinate(value: number | null) {
  return value === null ? "----" : String(value).padStart(4, "0");
}

function getPointerKind(pointerType: string): PointerKind | null {
  if (pointerType === "mouse" || pointerType === "pen" || pointerType === "touch") {
    return pointerType;
  }

  return null;
}

export default function PointerCoordinates({
  activeSection = 0,
  className,
  markerCount = 3,
}: PointerCoordinatesProps) {
  const [pointerPosition, setPointerPosition] = useState<PointerPosition | null>(null);
  const [handshakeState, setHandshakeState] = useState<HandshakeState>("idle");
  const [handshakeAnnouncement, setHandshakeAnnouncement] = useState("");
  const [pointerSurface, setPointerSurface] = useState<PointerSurface>("page");
  const pendingPositionRef = useRef<PointerPosition | null>(null);
  const activeContactIdRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);
  const contactResetTimerRef = useRef<number | null>(null);
  const handshakeStateRef = useRef<HandshakeState>("idle");
  const handshakeTimerRef = useRef<number | null>(null);
  const handshakeResetTimerRef = useRef<number | null>(null);
  const handshakeTouchStartRef = useRef<{ id: number; x: number; y: number } | null>(null);
  const coordinatesRef = useRef<HTMLButtonElement>(null);

  const setHandshakePhase = (nextState: HandshakeState) => {
    handshakeStateRef.current = nextState;
    setHandshakeState(nextState);
  };

  const clearHandshakeTimer = () => {
    if (handshakeTimerRef.current === null) return;

    window.clearTimeout(handshakeTimerRef.current);
    handshakeTimerRef.current = null;
  };

  const resetHandshake = () => {
    if (handshakeResetTimerRef.current !== null) {
      window.clearTimeout(handshakeResetTimerRef.current);
      handshakeResetTimerRef.current = null;
    }

    setHandshakePhase("idle");
    setHandshakeAnnouncement("");
  };

  const completeHandshake = () => {
    clearHandshakeTimer();
    if (handshakeResetTimerRef.current !== null) {
      window.clearTimeout(handshakeResetTimerRef.current);
    }

    setHandshakePhase("complete");
    setHandshakeAnnouncement("Signal handshake complete.");
    handshakeResetTimerRef.current = window.setTimeout(
      resetHandshake,
      HANDSHAKE_FEEDBACK_TIMEOUT_MS,
    );
  };

  const armHandshake = () => {
    if (handshakeStateRef.current === "complete" || handshakeTimerRef.current !== null) {
      return;
    }

    setHandshakePhase("arming");
    handshakeTimerRef.current = window.setTimeout(() => {
      handshakeTimerRef.current = null;
      completeHandshake();
    }, HANDSHAKE_DWELL_TIMEOUT_MS);
  };

  const cancelHandshake = () => {
    handshakeTouchStartRef.current = null;
    clearHandshakeTimer();

    if (handshakeStateRef.current === "arming") {
      setHandshakePhase("idle");
      setHandshakeAnnouncement("");
    }
  };

  const handleCoordinatePointerEnter = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const kind = getPointerKind(event.pointerType);
    if (kind === "mouse" || kind === "pen") {
      armHandshake();
    }
  };

  const handleCoordinatePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.pointerType !== "touch") return;

    handshakeTouchStartRef.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
    armHandshake();
  };

  const handleCoordinatePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const start = handshakeTouchStartRef.current;
    if (event.pointerType !== "touch" || start?.id !== event.pointerId) return;

    const distance = Math.hypot(event.clientX - start.x, event.clientY - start.y);
    if (distance > HANDSHAKE_TOUCH_MOVE_TOLERANCE_PX) {
      cancelHandshake();
    }
  };

  const handleCoordinatePointerEnd = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (handshakeTouchStartRef.current?.id === event.pointerId) {
      handshakeTouchStartRef.current = null;
    }

    if (handshakeStateRef.current === "arming") {
      cancelHandshake();
    }
  };

  useEffect(() => {
    const updatePointerMarker = () => {
      const nextPosition = pendingPositionRef.current;
      if (!nextPosition || (nextPosition.kind !== "mouse" && nextPosition.kind !== "pen")) {
        return;
      }

      const coordinates = coordinatesRef.current;
      if (!coordinates) return;

      const coordinatesRect = coordinates.getBoundingClientRect();
      const pointerX = Math.min(
        Math.max(1, nextPosition.x - coordinatesRect.left),
        Math.max(1, coordinatesRect.width - 1),
      );
      coordinates.style.setProperty("--coordinate-pointer-x", `${pointerX}px`);
    };

    const schedulePointerFrame = () => {
      if (frameRef.current !== null) return;

      frameRef.current = window.requestAnimationFrame(() => {
        const nextPosition = pendingPositionRef.current;
        updatePointerMarker();
        setPointerPosition(nextPosition);
        frameRef.current = null;
      });
    };

    const schedulePositionUpdate = (kind: PointerKind, x: number, y: number) => {
      pendingPositionRef.current = {
        kind,
        x: Math.round(x),
        y: Math.round(y),
      };

      schedulePointerFrame();
    };

    const scheduleEventPositionUpdate = (
      event: Pick<PointerEvent, "clientX" | "clientY">,
      kind: PointerKind,
      frame?: HTMLIFrameElement,
    ) => {
      if (!frame) {
        schedulePositionUpdate(kind, event.clientX, event.clientY);
        return;
      }

      const frameRect = frame.getBoundingClientRect();
      schedulePositionUpdate(kind, frameRect.left + event.clientX, frameRect.top + event.clientY);
    };

    const handleViewportResize = () => {
      const nextPosition = pendingPositionRef.current;
      if (nextPosition?.kind === "mouse" || nextPosition?.kind === "pen") {
        schedulePointerFrame();
      }
    };

    const coordinates = coordinatesRef.current;
    const coordinatesResizeObserver = new ResizeObserver(() => {
      const nextPosition = pendingPositionRef.current;
      if (nextPosition?.kind === "mouse" || nextPosition?.kind === "pen") {
        schedulePointerFrame();
      }
    });

    if (coordinates) {
      coordinatesResizeObserver.observe(coordinates);
    }

    const handlePointerDown = (event: PointerEvent, frame?: HTMLIFrameElement) => {
      const kind = getPointerKind(event.pointerType);
      if (!kind) return;

      if (kind !== "mouse") {
        activeContactIdRef.current = event.pointerId;
        if (contactResetTimerRef.current !== null) {
          window.clearTimeout(contactResetTimerRef.current);
          contactResetTimerRef.current = null;
        }
      }

      scheduleEventPositionUpdate(event, kind, frame);
    };

    const handlePointerMove = (event: PointerEvent, frame?: HTMLIFrameElement) => {
      const kind = getPointerKind(event.pointerType);
      if (!kind) return;
      if (kind === "touch" && activeContactIdRef.current !== event.pointerId) return;

      scheduleEventPositionUpdate(event, kind, frame);
    };

    const handleMouseMove = (event: MouseEvent, frame?: HTMLIFrameElement) => {
      scheduleEventPositionUpdate(event, "mouse", frame);
    };

    const handleContactEnd = (event: PointerEvent) => {
      if (activeContactIdRef.current !== event.pointerId) return;

      activeContactIdRef.current = null;
      contactResetTimerRef.current = window.setTimeout(() => {
        setPointerPosition((current) => (current?.kind === "mouse" ? current : null));
        contactResetTimerRef.current = null;
      }, CONTACT_DISPLAY_TIMEOUT_MS);
    };

    const iframeCleanups = new Map<HTMLIFrameElement, () => void>();

    const bindIframe = (frame: HTMLIFrameElement) => {
      if (iframeCleanups.has(frame)) return;

      let childCleanup = () => {};

      const bindChildPointerEvents = () => {
        childCleanup();

        try {
          const childWindow = frame.contentWindow;
          if (!childWindow) return;

          const childPointerDown = (event: PointerEvent) => handlePointerDown(event, frame);
          const childPointerMove = (event: PointerEvent) => handlePointerMove(event, frame);
          const childPointerUp = (event: PointerEvent) => handleContactEnd(event);
          const childPointerCancel = (event: PointerEvent) => handleContactEnd(event);
          const childMouseMove = (event: MouseEvent) => handleMouseMove(event, frame);

          childWindow.addEventListener("pointerdown", childPointerDown, true);
          childWindow.addEventListener("pointermove", childPointerMove, {
            capture: true,
            passive: true,
          });
          childWindow.addEventListener("pointerup", childPointerUp, true);
          childWindow.addEventListener("pointercancel", childPointerCancel, true);
          childWindow.addEventListener("mousemove", childMouseMove, {
            capture: true,
            passive: true,
          });

          childCleanup = () => {
            childWindow.removeEventListener("pointerdown", childPointerDown, true);
            childWindow.removeEventListener("pointermove", childPointerMove, true);
            childWindow.removeEventListener("pointerup", childPointerUp, true);
            childWindow.removeEventListener("pointercancel", childPointerCancel, true);
            childWindow.removeEventListener("mousemove", childMouseMove, true);
          };
        } catch {
          childCleanup = () => {};
        }
      };

      const handleFrameLoad = () => {
        bindChildPointerEvents();
      };
      const handleFrameSurfaceEnter = () => {
        if (frame.dataset.pointerSurface === "native") {
          setPointerSurface("native");
        }
      };
      const handleFrameSurfaceLeave = () => {
        setPointerSurface("page");
        pendingPositionRef.current = null;
        setPointerPosition(null);
      };
      const handleFramePointerEnter = (event: PointerEvent) => {
        handleFrameSurfaceEnter();
        handlePointerMove(event);
      };
      const handleFramePointerMove = (event: PointerEvent) => handlePointerMove(event);
      const handleFramePointerDown = (event: PointerEvent) => handlePointerDown(event);
      const handleFramePointerUp = (event: PointerEvent) => handleContactEnd(event);
      const handleFramePointerCancel = (event: PointerEvent) => handleContactEnd(event);
      const handleFrameMouseEnter = (event: MouseEvent) => {
        handleFrameSurfaceEnter();
        handleMouseMove(event);
      };
      const handleFrameMouseMove = (event: MouseEvent) => handleMouseMove(event);
      const handleFrameMouseLeave = () => handleFrameSurfaceLeave();

      frame.addEventListener("load", handleFrameLoad);
      frame.addEventListener("pointerenter", handleFramePointerEnter);
      frame.addEventListener("pointermove", handleFramePointerMove, { passive: true });
      frame.addEventListener("pointerleave", handleFrameSurfaceLeave);
      frame.addEventListener("pointerdown", handleFramePointerDown);
      frame.addEventListener("pointerup", handleFramePointerUp);
      frame.addEventListener("pointercancel", handleFramePointerCancel);
      frame.addEventListener("mouseenter", handleFrameMouseEnter);
      frame.addEventListener("mousemove", handleFrameMouseMove, { passive: true });
      frame.addEventListener("mouseleave", handleFrameMouseLeave);
      bindChildPointerEvents();

      iframeCleanups.set(frame, () => {
        childCleanup();
        frame.removeEventListener("load", handleFrameLoad);
        frame.removeEventListener("pointerenter", handleFramePointerEnter);
        frame.removeEventListener("pointermove", handleFramePointerMove);
        frame.removeEventListener("pointerleave", handleFrameSurfaceLeave);
        frame.removeEventListener("pointerdown", handleFramePointerDown);
        frame.removeEventListener("pointerup", handleFramePointerUp);
        frame.removeEventListener("pointercancel", handleFramePointerCancel);
        frame.removeEventListener("mouseenter", handleFrameMouseEnter);
        frame.removeEventListener("mousemove", handleFrameMouseMove);
        frame.removeEventListener("mouseleave", handleFrameMouseLeave);
      });
    };

    const bindCurrentIframes = () => {
      const currentFrames = new Set(document.querySelectorAll("iframe"));

      iframeCleanups.forEach((cleanup, frame) => {
        if (!currentFrames.has(frame)) {
          cleanup();
          iframeCleanups.delete(frame);
        }
      });

      currentFrames.forEach((frame) => {
        bindIframe(frame);
      });
    };

    const iframeObserver = new MutationObserver(bindCurrentIframes);

    bindCurrentIframes();
    if (document.body) {
      iframeObserver.observe(document.body, { childList: true, subtree: true });
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    window.addEventListener("pointerup", handleContactEnd);
    window.addEventListener("pointercancel", handleContactEnd);
    window.addEventListener("resize", handleViewportResize);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("pointerup", handleContactEnd);
      window.removeEventListener("pointercancel", handleContactEnd);
      window.removeEventListener("resize", handleViewportResize);
      coordinatesResizeObserver.disconnect();
      iframeObserver.disconnect();
      iframeCleanups.forEach((cleanup) => {
        cleanup();
      });
      iframeCleanups.clear();
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
      if (contactResetTimerRef.current !== null) {
        window.clearTimeout(contactResetTimerRef.current);
      }
      if (handshakeTimerRef.current !== null) {
        window.clearTimeout(handshakeTimerRef.current);
        handshakeTimerRef.current = null;
      }
      if (handshakeResetTimerRef.current !== null) {
        window.clearTimeout(handshakeResetTimerRef.current);
      }
    };
  }, []);

  const visiblePointerPosition = pointerSurface === "native" ? null : pointerPosition;
  const x = formatCoordinate(visiblePointerPosition?.x ?? null);
  const y = formatCoordinate(visiblePointerPosition?.y ?? null);
  const inputLabel =
    pointerSurface === "native"
      ? "PDF VIEWER"
      : pointerPosition?.kind === "touch"
        ? "TOUCH"
        : pointerPosition?.kind === "pen"
          ? "PEN"
          : "SYS-OP-24";
  const statusLabel =
    pointerSurface === "native"
      ? "PDF VIEWER"
      : handshakeState === "complete"
        ? "SIGNAL-OK"
        : inputLabel;
  const pointerSignalPosition =
    visiblePointerPosition &&
    (visiblePointerPosition.kind === "mouse" || visiblePointerPosition.kind === "pen")
      ? visiblePointerPosition
      : null;
  const coordinateClassName = [
    "coordinate-rail",
    className,
    pointerSignalPosition ? "has-pointer" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const safeMarkerCount = Math.max(0, Math.floor(markerCount));
  const markers = Array.from({ length: safeMarkerCount }, (_, index) => ({
    id: `coordinate-marker-${index}`,
    index,
  }));

  return (
    <button
      aria-describedby="coordinate-rail-instruction"
      className={coordinateClassName}
      data-cursor="crosshair"
      data-handshake-state={handshakeState}
      data-pointer-surface={pointerSurface}
      onClick={completeHandshake}
      onPointerDown={handleCoordinatePointerDown}
      onPointerEnter={handleCoordinatePointerEnter}
      onPointerLeave={cancelHandshake}
      onPointerMove={handleCoordinatePointerMove}
      onPointerCancel={handleCoordinatePointerEnd}
      onPointerUp={handleCoordinatePointerEnd}
      ref={coordinatesRef}
      title="Pause or activate to run a signal handshake"
      type="button"
    >
      <span>X {x} PX</span>
      <span>Y {y} PX</span>
      <span aria-hidden="true" className="coordinate-rail-markers">
        {markers.map((marker) => (
          <i className={activeSection === marker.index ? "is-active" : undefined} key={marker.id} />
        ))}
      </span>
      <span className="coordinate-rail-status" data-cursor="help">
        {statusLabel}
      </span>
      <span className="sr-only" id="coordinate-rail-instruction">
        Activate to run a signal handshake.
      </span>
      <span aria-live="polite" className="sr-only">
        {handshakeAnnouncement}
      </span>
    </button>
  );
}
