import { Home, Menu, MessageCircle, Settings2 } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { FloatingPanel } from "./FloatingControlsContext";
import { useFloatingControls } from "./useFloatingControls";

type FloatingControlsDockProps = {
  children: ReactNode;
};

const compactMenuActions = [
  { icon: MessageCircle, label: "Assistant", panel: "assistant" },
  { icon: Settings2, label: "Settings", panel: "settings" },
  { icon: Home, label: "Quick navigation", panel: "quick-navigation" },
] as const satisfies ReadonlyArray<{
  icon: typeof Menu;
  label: string;
  panel: FloatingPanel;
}>;

export default function FloatingControlsDock({ children }: FloatingControlsDockProps) {
  const { activePanel, closePanel, openPanel } = useFloatingControls();
  const [compactMenuOpen, setCompactMenuOpen] = useState(false);
  const compactMenuRef = useRef<HTMLDivElement>(null);
  const compactMenuTriggerRef = useRef<HTMLButtonElement>(null);
  const [portalContainer] = useState(() => {
    const container = document.createElement("div");
    container.className = "coordinate-rail-control-portal";
    return container;
  });

  const selectPanel = useCallback(
    (panel: FloatingPanel) => {
      setCompactMenuOpen(false);

      if (activePanel === panel) {
        closePanel(panel);
        window.requestAnimationFrame(() => compactMenuTriggerRef.current?.focus());
        return;
      }

      openPanel(panel);
    },
    [activePanel, closePanel, openPanel],
  );

  useEffect(() => {
    if (!compactMenuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!compactMenuRef.current?.contains(event.target as Node)) {
        setCompactMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;

      event.preventDefault();
      event.stopPropagation();
      setCompactMenuOpen(false);
      compactMenuTriggerRef.current?.focus();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [compactMenuOpen]);

  useEffect(() => {
    const closeMenuOnResize = () => setCompactMenuOpen(false);
    window.addEventListener("resize", closeMenuOnResize, { passive: true });
    return () => window.removeEventListener("resize", closeMenuOnResize);
  }, []);

  useLayoutEffect(() => {
    const appShell = document.querySelector<HTMLElement>(".app-shell") ?? document.body;
    const movePortalToRail = () => {
      const railControls = appShell.querySelector<HTMLElement>("[data-coordinate-rail-controls]");
      const target = railControls ?? document.body;

      portalContainer.classList.toggle("is-floating-controls-fallback", !railControls);
      if (portalContainer.parentElement !== target) {
        target.append(portalContainer);
      }
    };

    movePortalToRail();

    const observer = new MutationObserver(movePortalToRail);
    observer.observe(appShell, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, [portalContainer]);

  return createPortal(
    <div className="floating-control-dock" data-active-panel={activePanel ?? "none"}>
      {children}
      <div
        className="floating-controls-compact-menu"
        data-state={compactMenuOpen ? "open" : "closed"}
        ref={compactMenuRef}
      >
        <button
          aria-controls="floating-controls-compact-panel"
          aria-expanded={compactMenuOpen}
          aria-label={compactMenuOpen ? "Close floating controls" : "Open floating controls"}
          className="floating-controls-compact-trigger"
          onClick={() => setCompactMenuOpen((isOpen) => !isOpen)}
          ref={compactMenuTriggerRef}
          title="Floating controls"
          type="button"
        >
          <Menu aria-hidden="true" />
        </button>
        <fieldset
          className="floating-controls-compact-panel"
          hidden={!compactMenuOpen}
          id="floating-controls-compact-panel"
        >
          <legend className="sr-only">Floating controls</legend>
          {compactMenuActions.map(({ icon: Icon, label, panel }) => (
            <button
              className="floating-controls-compact-option"
              data-active={activePanel === panel}
              key={panel}
              onClick={() => selectPanel(panel)}
              type="button"
            >
              <Icon aria-hidden="true" />
              <span>{activePanel === panel ? `Close ${label}` : label}</span>
            </button>
          ))}
        </fieldset>
      </div>
    </div>,
    portalContainer,
  );
}
