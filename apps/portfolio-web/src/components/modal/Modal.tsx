import { X } from "lucide-react";
import { type ReactNode, type RefObject, useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";

export type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  eyebrow?: string;
  role?: "dialog" | "alertdialog";
  closeLabel?: string;
  initialFocusRef?: RefObject<HTMLElement | null>;
  returnFocusRef?: RefObject<HTMLElement | null>;
  children?: ReactNode;
  footer?: ReactNode;
};

const FOCUSABLE_SELECTOR =
  "a[href], button:not(:disabled), textarea:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex='-1'])";

export default function Modal({
  open,
  onClose,
  title,
  description,
  eyebrow,
  role = "dialog",
  closeLabel = "Close dialog",
  initialFocusRef,
  returnFocusRef,
  children,
  footer,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const previousOverflowRef = useRef("");
  const onCloseRef = useRef(onClose);
  const titleId = useId();
  const descriptionId = useId();
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;

    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const returnFocusTarget = returnFocusRef?.current;
    previousOverflowRef.current = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusFrame = window.requestAnimationFrame(() => {
      const target =
        initialFocusRef?.current ??
        dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      (target ?? dialogRef.current)?.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (!focusable || focusable.length === 0) {
        event.preventDefault();
        dialogRef.current?.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!dialogRef.current?.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
        return;
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflowRef.current;
      window.requestAnimationFrame(() => {
        const previousFocus = previousFocusRef.current;
        if (previousFocus && !previousFocus.matches(":disabled")) {
          previousFocus.focus();
          return;
        }
        returnFocusTarget?.focus();
      });
      previousFocusRef.current = null;
    };
  }, [initialFocusRef, open, returnFocusRef]);

  if (!open) return null;

  return createPortal(
    <div className="app-modal-backdrop">
      {/* biome-ignore lint/a11y/useAriaPropsSupportedByRole: the public role is constrained to dialog or alertdialog. */}
      <div
        aria-describedby={description ? descriptionId : undefined}
        aria-labelledby={titleId}
        aria-modal="true"
        className="app-modal"
        data-state="open"
        ref={dialogRef}
        role={role}
        tabIndex={-1}
      >
        <header className="app-modal-header">
          <div>
            {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
            <h2 id={titleId}>{title}</h2>
          </div>
          <button
            aria-label={closeLabel}
            className="app-modal-close"
            onClick={() => onCloseRef.current()}
            type="button"
          >
            <X aria-hidden="true" size={18} />
          </button>
        </header>
        {description ? (
          <p className="app-modal-description" id={descriptionId}>
            {description}
          </p>
        ) : null}
        {children ? <div className="app-modal-body">{children}</div> : null}
        {footer ? <footer className="app-modal-footer">{footer}</footer> : null}
      </div>
    </div>,
    document.body,
  );
}
