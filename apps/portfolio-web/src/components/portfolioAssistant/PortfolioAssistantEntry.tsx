import { MessageCircle, X } from "lucide-react";
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { focusFloatingControlTrigger } from "../floatingControls/focusFloatingControl";
import { useFloatingControls } from "../floatingControls/useFloatingControls";
import { PORTFOLIO_ASSISTANT_LABEL, PORTFOLIO_ASSISTANT_NAME } from "./portfolioAssistantIdentity";

const LazyPortfolioAssistant = lazy(() => import("./PortfolioAssistantFab"));
const ASSISTANT_RESPONSIVE_DIALOG_QUERY = "(max-width: 640px), (max-height: 560px)";
const ASSISTANT_FOCUSABLE_SELECTOR =
  "a[href], button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex='-1'])";

function useAssistantResponsiveDialog(): boolean {
  const [isResponsiveModal, setIsResponsiveModal] = useState(
    () =>
      typeof window !== "undefined" && window.matchMedia(ASSISTANT_RESPONSIVE_DIALOG_QUERY).matches,
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia(ASSISTANT_RESPONSIVE_DIALOG_QUERY);
    const handleChange = () => setIsResponsiveModal(mediaQuery.matches);
    handleChange();
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }
    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);

  return isResponsiveModal;
}

function AssistantEntryLoadingFallback({
  isResponsiveModal,
  onClose,
}: {
  isResponsiveModal: boolean;
  onClose: () => void;
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!isResponsiveModal) return;

    const documentElement = document.documentElement;
    const previousBodyOverflow = document.body.style.overflow;
    const previousDocumentOverflow = documentElement.style.overflow;
    const previousScrollbarGutter = documentElement.style.scrollbarGutter;
    document.body.style.overflow = "hidden";
    documentElement.style.overflow = "hidden";
    documentElement.style.scrollbarGutter = "auto";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      documentElement.style.overflow = previousDocumentOverflow;
      documentElement.style.scrollbarGutter = previousScrollbarGutter;
    };
  }, [isResponsiveModal]);

  return (
    <>
      {/* biome-ignore lint/a11y/useAriaPropsSupportedByRole: aria-modal is paired with the conditional dialog role. */}
      <section
        aria-busy="true"
        aria-labelledby="portfolio-assistant-loading-eyebrow portfolio-assistant-loading-title"
        aria-modal={isResponsiveModal ? true : undefined}
        className="portfolio-assistant-entry-loading"
        id="portfolio-assistant-panel"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onClose();
            return;
          }
          if (!isResponsiveModal || event.key !== "Tab") return;

          const focusable = event.currentTarget.querySelectorAll<HTMLElement>(
            ASSISTANT_FOCUSABLE_SELECTOR,
          );
          if (focusable.length === 0) {
            event.preventDefault();
            event.currentTarget.focus();
            return;
          }

          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (!event.currentTarget.contains(document.activeElement)) {
            event.preventDefault();
            first.focus();
          } else if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }}
        role={isResponsiveModal ? "dialog" : undefined}
        tabIndex={isResponsiveModal ? -1 : undefined}
      >
        <header className="portfolio-assistant-entry-loading-header">
          <div>
            <p className="eyebrow" id="portfolio-assistant-loading-eyebrow">
              {PORTFOLIO_ASSISTANT_NAME}
            </p>
            <h2 id="portfolio-assistant-loading-title">Ask the archive.</h2>
            <p className="portfolio-assistant-entry-loading-summary">
              Grounded in the portfolio MCP. No general-purpose work.
            </p>
          </div>
          <button
            aria-label={`Close ${PORTFOLIO_ASSISTANT_LABEL}`}
            className="portfolio-assistant-entry-loading-close"
            onClick={onClose}
            ref={closeButtonRef}
            type="button"
          >
            <X aria-hidden="true" size={17} />
          </button>
        </header>
        <div className="portfolio-assistant-entry-loading-content">
          <div aria-hidden="true" className="portfolio-assistant-entry-loading-thread">
            <div className="portfolio-assistant-entry-loading-user">
              <span className="portfolio-assistant-entry-loading-skeleton-line is-short" />
            </div>
            <div className="portfolio-assistant-entry-loading-message">
              <span className="portfolio-assistant-entry-loading-mark">
                <i />
                <i />
                <i />
              </span>
              <div className="portfolio-assistant-entry-loading-lines">
                <span className="portfolio-assistant-entry-loading-skeleton-line is-long" />
                <span className="portfolio-assistant-entry-loading-skeleton-line is-medium" />
                <span className="portfolio-assistant-entry-loading-skeleton-line is-long" />
                <span className="portfolio-assistant-entry-loading-skeleton-line is-short" />
              </div>
            </div>
          </div>
          <div aria-hidden="true" className="portfolio-assistant-entry-loading-composer">
            <span className="portfolio-assistant-entry-loading-composer-field" />
            <span className="portfolio-assistant-entry-loading-composer-action" />
          </div>
        </div>
        <output aria-live="polite" className="portfolio-assistant-entry-loading-status">
          <span aria-hidden="true" className="portfolio-assistant-entry-loading-mark">
            <i />
            <i />
            <i />
          </span>
          <span>Opening {PORTFOLIO_ASSISTANT_NAME}…</span>
        </output>
      </section>
    </>
  );
}

export default function PortfolioAssistantFab() {
  const { activePanel, openPanel, closePanel } = useFloatingControls();
  const [loaded, setLoaded] = useState(false);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const restoreLauncherFocusRef = useRef(false);
  const isResponsiveModal = useAssistantResponsiveDialog();
  const isOpen = activePanel === "assistant";

  useEffect(() => {
    if (isOpen) setLoaded(true);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen || !restoreLauncherFocusRef.current) return;
    restoreLauncherFocusRef.current = false;
    focusFloatingControlTrigger(launcherRef.current);
  }, [isOpen]);

  const closeLoadingPanel = useCallback(() => {
    restoreLauncherFocusRef.current = true;
    setLoaded(false);
    closePanel("assistant");
  }, [closePanel]);

  const handleToggle = () => {
    if (isOpen) {
      restoreLauncherFocusRef.current = true;
      closePanel("assistant");
      return;
    }

    setLoaded(true);
    openPanel("assistant");
  };

  return (
    <div className="portfolio-assistant-entry" data-floating-panel="assistant">
      {loaded ? (
        <Suspense
          fallback={
            isOpen ? (
              <AssistantEntryLoadingFallback
                isResponsiveModal={isResponsiveModal}
                onClose={closeLoadingPanel}
              />
            ) : null
          }
        >
          <LazyPortfolioAssistant hideFab />
        </Suspense>
      ) : null}
      <button
        aria-controls="portfolio-assistant-panel"
        aria-expanded={isOpen}
        aria-label={
          isOpen ? `Close ${PORTFOLIO_ASSISTANT_LABEL}` : `Open ${PORTFOLIO_ASSISTANT_LABEL}`
        }
        className="portfolio-assistant-fab"
        onClick={handleToggle}
        ref={launcherRef}
        title={isOpen ? `Close ${PORTFOLIO_ASSISTANT_LABEL}` : `Open ${PORTFOLIO_ASSISTANT_LABEL}`}
        type="button"
      >
        <MessageCircle aria-hidden="true" size={20} />
      </button>
    </div>
  );
}
