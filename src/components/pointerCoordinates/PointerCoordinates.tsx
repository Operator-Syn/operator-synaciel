import type { PointerEvent as ReactPointerEvent } from "react";
import { useEffect, useRef, useState } from "react";

type PointerKind = "mouse" | "pen" | "touch";

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

    const schedulePositionUpdate = (event: PointerEvent, kind: PointerKind) => {
      pendingPositionRef.current = {
        kind,
        x: Math.round(event.clientX),
        y: Math.round(event.clientY),
      };

      schedulePointerFrame();
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

    const handlePointerDown = (event: PointerEvent) => {
      const kind = getPointerKind(event.pointerType);
      if (!kind) return;

      if (kind !== "mouse") {
        activeContactIdRef.current = event.pointerId;
        if (contactResetTimerRef.current !== null) {
          window.clearTimeout(contactResetTimerRef.current);
          contactResetTimerRef.current = null;
        }
      }

      schedulePositionUpdate(event, kind);
    };

    const handlePointerMove = (event: PointerEvent) => {
      const kind = getPointerKind(event.pointerType);
      if (!kind) return;
      if (kind === "touch" && activeContactIdRef.current !== event.pointerId) return;

      schedulePositionUpdate(event, kind);
    };

    const handleContactEnd = (event: PointerEvent) => {
      if (activeContactIdRef.current !== event.pointerId) return;

      activeContactIdRef.current = null;
      contactResetTimerRef.current = window.setTimeout(() => {
        setPointerPosition((current) => (current?.kind === "mouse" ? current : null));
        contactResetTimerRef.current = null;
      }, CONTACT_DISPLAY_TIMEOUT_MS);
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerup", handleContactEnd);
    window.addEventListener("pointercancel", handleContactEnd);
    window.addEventListener("resize", handleViewportResize);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handleContactEnd);
      window.removeEventListener("pointercancel", handleContactEnd);
      window.removeEventListener("resize", handleViewportResize);
      coordinatesResizeObserver.disconnect();
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

  const x = formatCoordinate(pointerPosition?.x ?? null);
  const y = formatCoordinate(pointerPosition?.y ?? null);
  const inputLabel =
    pointerPosition?.kind === "touch"
      ? "TOUCH"
      : pointerPosition?.kind === "pen"
        ? "PEN"
        : "SYS-OP-24";
  const pointerSignalPosition =
    pointerPosition && (pointerPosition.kind === "mouse" || pointerPosition.kind === "pen")
      ? pointerPosition
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
      aria-label="Run signal handshake"
      className={coordinateClassName}
      data-cursor="crosshair"
      data-handshake-state={handshakeState}
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
      <span className="coordinate-rail-status" data-cursor="help" aria-hidden="true">
        {handshakeState === "complete" ? "SIGNAL-OK" : inputLabel}
      </span>
      <span aria-live="polite" className="sr-only">
        {handshakeAnnouncement}
      </span>
    </button>
  );
}
