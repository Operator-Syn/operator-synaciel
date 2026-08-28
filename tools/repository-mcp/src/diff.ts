import {
  MAX_DIFF_CHUNK_CHARACTERS,
  MAX_DIFF_PREVIEW_CHARACTERS,
  MAX_DIFF_STORAGE_CHARACTERS,
} from "./policy.ts";

export type DiffSection = {
  readonly path: string;
  readonly content: string;
};

export type DiffDocument = {
  readonly content: string;
  readonly sections: readonly DiffSection[];
  readonly totalCharacters: number;
  readonly totalBytes: number;
};

export type DiffChunk = {
  readonly content: string;
  readonly offset: number;
  readonly nextOffset: number | null;
  readonly totalCharacters: number;
  readonly totalBytes: number;
  readonly complete: boolean;
  readonly diffTruncated: boolean;
  readonly omittedPaths: readonly string[];
};

type DiffRange = DiffSection & {
  readonly end: number;
};

export function buildDiffDocument(sections: readonly DiffSection[]): DiffDocument {
  const content = sections.map((section) => section.content).join("\n\n");
  if (content.length > MAX_DIFF_STORAGE_CHARACTERS) {
    throw new Error(
      `The review diff exceeds the ${MAX_DIFF_STORAGE_CHARACTERS.toLocaleString()}-character storage limit; split the change into smaller operations.`,
    );
  }

  return {
    content,
    sections,
    totalCharacters: content.length,
    totalBytes: Buffer.byteLength(content, "utf8"),
  };
}

function ranges(document: DiffDocument): readonly DiffRange[] {
  let cursor = 0;
  return document.sections.map((section, index) => {
    const end = cursor + section.content.length;
    cursor = end + (index < document.sections.length - 1 ? 2 : 0);
    return { ...section, end };
  });
}

export function readDiffChunk(
  document: DiffDocument,
  offset = 0,
  maxChars = MAX_DIFF_PREVIEW_CHARACTERS,
): DiffChunk {
  if (!Number.isInteger(offset) || offset < 0 || offset > document.totalCharacters) {
    throw new Error("Diff offset must be a non-negative position within the prepared diff.");
  }
  if (!Number.isInteger(maxChars) || maxChars < 1 || maxChars > MAX_DIFF_CHUNK_CHARACTERS) {
    throw new Error(
      `Diff maxChars must be an integer between 1 and ${MAX_DIFF_CHUNK_CHARACTERS.toLocaleString()}.`,
    );
  }

  const end = Math.min(offset + maxChars, document.totalCharacters);
  const nextOffset = end < document.totalCharacters ? end : null;
  const omittedPaths = ranges(document)
    .filter((section) => section.end > end)
    .map((section) => section.path);

  return {
    content: document.content.slice(offset, end),
    offset,
    nextOffset,
    totalCharacters: document.totalCharacters,
    totalBytes: document.totalBytes,
    complete: nextOffset === null,
    diffTruncated: nextOffset !== null,
    omittedPaths,
  };
}

export function previewDiff(document: DiffDocument): DiffChunk {
  return readDiffChunk(document, 0, MAX_DIFF_PREVIEW_CHARACTERS);
}
