export type TurnstileWidgetSize = "normal" | "compact";

const NORMAL_WIDGET_MIN_WIDTH_PX = 300;

export function turnstileWidgetSizeForWidth(width: number): TurnstileWidgetSize {
  return width >= NORMAL_WIDGET_MIN_WIDTH_PX ? "normal" : "compact";
}

export function observeTurnstileWidgetSize(
  container: HTMLElement,
  onChange: (size: TurnstileWidgetSize) => void,
): () => void {
  let currentSize: TurnstileWidgetSize | null = null;
  const updateSize = () => {
    const nextSize = turnstileWidgetSizeForWidth(container.getBoundingClientRect().width);
    if (nextSize === currentSize) return;
    currentSize = nextSize;
    onChange(nextSize);
  };

  updateSize();
  if (typeof ResizeObserver !== "undefined") {
    const observer = new ResizeObserver(updateSize);
    observer.observe(container);
    return () => observer.disconnect();
  }

  window.addEventListener("resize", updateSize);
  return () => window.removeEventListener("resize", updateSize);
}
