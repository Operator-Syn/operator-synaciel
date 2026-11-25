/**
 * Split a project's long description into blocks the page and the crawler fragment can both render.
 *
 * The archive stores `long_description` as plain text with blank-line-separated paragraphs and inline
 * `- ` bullets; React would collapse all of it into one run-on paragraph. This is the only place that
 * decides what a block is, so the rendered page and the injected fragment cannot disagree about it.
 */

/**
 * One renderable block of a project description.
 *
 * `id` is assigned by the parser and only ever used as a render key: it must not be derived from the
 * array position at the call site, because the position is not part of the block's identity.
 */
export type ProjectDescriptionBlock = { readonly id: string } & (
  | { readonly kind: "paragraph"; readonly text: string }
  | { readonly kind: "list"; readonly items: readonly string[] }
);

/** A line that starts a bullet, allowing either hyphen or bullet character. */
const BULLET = /^[-•]\s+/;

/**
 * Parse a description into paragraphs and bullet lists.
 *
 * Algorithm:
 * 1. Walk the lines in order, trimming each one.
 * 2. Skip blank lines, which only separate blocks.
 * 3. A bullet line opens a list when none is open, or appends to the open list.
 * 4. Any other line closes an open list and appends to the current paragraph, starting one when the
 *    previous block was not a paragraph.
 * 5. Drop empty blocks at the end so a trailing blank line leaves no artefact.
 *
 * @param text The stored description.
 * @returns The blocks in document order; an empty description yields no blocks.
 */
export function parseProjectDescription(text: string): ProjectDescriptionBlock[] {
  const blocks: ProjectDescriptionBlock[] = [];
  let paragraph: string[] = [];
  let items: string[] = [];

  const nextId = () => `block-${blocks.length}`;

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    blocks.push({ id: nextId(), kind: "paragraph", text: paragraph.join(" ") });
    paragraph = [];
  };

  const flushList = () => {
    if (items.length === 0) return;
    blocks.push({ id: nextId(), kind: "list", items });
    items = [];
  };

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    if (BULLET.test(line)) {
      flushParagraph();
      items.push(line.replace(BULLET, "").trim());
      continue;
    }

    flushList();
    paragraph.push(line);
  }

  flushParagraph();
  flushList();

  return blocks;
}
