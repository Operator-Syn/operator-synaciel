import type { AnchorHTMLAttributes } from "react";
import { normalizeAssistantMarkdownHref } from "./portfolioAssistantLinkPolicy.ts";

type AssistantMarkdownLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  node?: unknown;
};

export function AssistantMarkdownLink({
  children,
  href,
  node,
  ...props
}: AssistantMarkdownLinkProps) {
  void node;
  const normalized = href ? normalizeAssistantMarkdownHref(href) : null;
  if (!normalized) {
    return (
      <span className="portfolio-assistant-invalid-link" data-assistant-link-status="unavailable">
        {children}
      </span>
    );
  }

  return (
    <a {...props} href={normalized}>
      {children}
    </a>
  );
}
