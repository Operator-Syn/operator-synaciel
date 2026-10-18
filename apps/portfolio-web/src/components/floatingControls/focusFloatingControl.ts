export function focusFloatingControlTrigger(trigger: HTMLButtonElement | null) {
  if (trigger?.getClientRects().length) {
    trigger.focus();
    return;
  }

  const compactTrigger = document.querySelector<HTMLButtonElement>(
    ".floating-controls-compact-trigger",
  );
  if (compactTrigger?.getClientRects().length) {
    compactTrigger.focus();
    return;
  }

  document.querySelector<HTMLButtonElement>(".portfolio-assistant-fab")?.focus();
}
