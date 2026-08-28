import { isValidElement, type ReactNode } from "react";

export type MarkdownHeading = {
  id: string;
  label: string;
  level: number;
};

function stripInlineMarkdown(value: string) {
  return value
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[`*_~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeMarkdownHeadingText(value: string) {
  return stripInlineMarkdown(value);
}

export function markdownNodeToText(value: ReactNode): string {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map(markdownNodeToText).join("");
  }

  if (isValidElement(value)) {
    const props = value.props as { children?: ReactNode };
    return markdownNodeToText(props.children);
  }

  return "";
}

export function slugifyMarkdownHeading(value: string) {
  const slug = stripInlineMarkdown(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");

  return slug || "section";
}

export function extractMarkdownHeadings(markdown: string): MarkdownHeading[] {
  const headings: MarkdownHeading[] = [];
  const slugCounts = new Map<string, number>();
  let inFence = false;

  for (const line of markdown.split(/\r?\n/)) {
    const trimmedLine = line.trimStart();

    if (/^(```|~~~)/.test(trimmedLine)) {
      inFence = !inFence;
      continue;
    }

    if (inFence) continue;

    const match = /^ {0,3}(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (!match) continue;

    const label = normalizeMarkdownHeadingText(match[2]);
    if (!label) continue;

    const baseId = slugifyMarkdownHeading(label);
    const count = slugCounts.get(baseId) ?? 0;
    slugCounts.set(baseId, count + 1);

    headings.push({
      id: count === 0 ? baseId : baseId.concat("-", String(count + 1)),
      label,
      level: match[1].length,
    });
  }

  return headings;
}
