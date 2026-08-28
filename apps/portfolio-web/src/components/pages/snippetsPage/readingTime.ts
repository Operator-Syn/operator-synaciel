export const MARKDOWN_WORDS_PER_MINUTE = 200;

function removeFencedCode(markdown: string) {
  const readableLines: string[] = [];
  let fenceMarker: "```" | "~~~" | null = null;

  for (const line of markdown.split(/\r?\n/)) {
    const fence = /^\s{0,3}(`{3,}|~{3,})/.exec(line)?.[1];

    if (fence) {
      if (fenceMarker === null) {
        fenceMarker = fence.startsWith("`") ? "```" : "~~~";
      } else if (fence.startsWith(fenceMarker[0])) {
        fenceMarker = null;
      }
      continue;
    }

    if (fenceMarker === null) {
      readableLines.push(line);
    }
  }

  return readableLines.join("\n");
}

export function countMarkdownWords(markdown: string) {
  const readableMarkdown = removeFencedCode(markdown)
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<https?:\/\/[^>]+>/g, " ")
    .replace(/<\/?[^>]+>/g, " ")
    .replace(/[`*_~]/g, "")
    .replace(/^\s{0,3}(?:#{1,6}|>|[-+*]|\d+[.)])\s+/gm, " ")
    .replace(/\s+/g, " ")
    .trim();

  return readableMarkdown.match(/[\p{L}\p{N}]+(?:[-'’][\p{L}\p{N}]+)*/gu)?.length ?? 0;
}

export function estimateMarkdownReadingTime(markdown: string) {
  const wordCount = countMarkdownWords(markdown);

  if (wordCount === 0) {
    return null;
  }

  return Math.max(1, Math.ceil(wordCount / MARKDOWN_WORDS_PER_MINUTE));
}
