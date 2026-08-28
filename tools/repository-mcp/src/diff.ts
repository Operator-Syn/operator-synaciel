import {
  MAX_DIFF_CHUNK_CHARACTERS,
  MAX_DIFF_PREVIEW_CHARACTERS,
  MAX_DIFF_STORAGE_CHARACTERS,
} from "./policy.ts";

export type DiffSection =
  | {
      readonly path: string;
      readonly content: string;
    }
  | {
      readonly path: string;
      readonly before: string;
      readonly after: string;
    };

type DiffRange = {
  readonly path: string;
  readonly section: DiffSection;
  readonly start: number;
  readonly end: number;
};

export type DiffDocument = {
  readonly sections: readonly DiffSection[];
  readonly ranges: readonly DiffRange[];
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

function* sectionSegments(section: DiffSection): Generator<string> {
  if ("content" in section) {
    yield section.content;
    return;
  }

  const oldLines = section.before.split(/\r?\n/);
  const newLines = section.after.split(/\r?\n/);
  yield `--- a/${section.path}`;
  yield `+++ b/${section.path}`;
  yield `@@ -1,${oldLines.length} +1,${newLines.length} @@`;
  if (section.before) {
    for (const line of oldLines) yield `-${line}`;
  }
  for (const line of newLines) yield `+${line}`;
}

function measureSection(section: DiffSection): { characters: number; bytes: number } {
  let characters = 0;
  let bytes = 0;
  let first = true;
  for (const segment of sectionSegments(section)) {
    if (!first) {
      characters += 1;
      bytes += 1;
    }
    characters += segment.length;
    bytes += Buffer.byteLength(segment, "utf8");
    first = false;
  }
  return { characters, bytes };
}

function renderSectionRange(section: DiffSection, start: number, end: number): string {
  if (start >= end) return "";
  if ("content" in section) return section.content.slice(start, end);

  const pieces: string[] = [];
  let cursor = 0;
  let index = 0;
  for (const segment of sectionSegments(section)) {
    const rendered = index === 0 ? segment : `\n${segment}`;
    const renderedEnd = cursor + rendered.length;
    if (renderedEnd > start && cursor < end) {
      pieces.push(
        rendered.slice(Math.max(0, start - cursor), Math.min(rendered.length, end - cursor)),
      );
    }
    cursor = renderedEnd;
    index += 1;
    if (cursor >= end) break;
  }
  return pieces.join("");
}

export function buildDiffDocument(sections: readonly DiffSection[]): DiffDocument {
  const ranges: DiffRange[] = [];
  let cursor = 0;
  let totalBytes = 0;

  sections.forEach((section, index) => {
    const measured = measureSection(section);
    const start = cursor;
    const end = start + measured.characters;
    ranges.push({ path: section.path, section, start, end });
    cursor = end;
    totalBytes += measured.bytes;
    if (index < sections.length - 1) {
      cursor += 2;
      totalBytes += 2;
    }
  });

  if (cursor > MAX_DIFF_STORAGE_CHARACTERS) {
    throw new Error(
      "The review diff exceeds " +
        MAX_DIFF_STORAGE_CHARACTERS.toLocaleString() +
        "-character storage limit; split the change into smaller operations.",
    );
  }

  return {
    sections,
    ranges,
    totalCharacters: cursor,
    totalBytes,
  };
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
      "Diff maxChars must be an integer between 1 and " +
        MAX_DIFF_CHUNK_CHARACTERS.toLocaleString() +
        ".",
    );
  }

  const end = Math.min(offset + maxChars, document.totalCharacters);
  const nextOffset = end < document.totalCharacters ? end : null;
  const pieces: string[] = [];

  for (let index = 0; index < document.ranges.length; index += 1) {
    const range = document.ranges[index];
    if (range.end > offset && range.start < end) {
      pieces.push(
        renderSectionRange(
          range.section,
          Math.max(0, offset - range.start),
          Math.min(range.end - range.start, end - range.start),
        ),
      );
    }
    if (index < document.ranges.length - 1) {
      const separatorStart = range.end;
      const separatorEnd = separatorStart + 2;
      if (separatorEnd > offset && separatorStart < end) {
        pieces.push(
          "\n\n".slice(Math.max(0, offset - separatorStart), Math.min(2, end - separatorStart)),
        );
      }
    }
  }

  return {
    content: pieces.join(""),
    offset,
    nextOffset,
    totalCharacters: document.totalCharacters,
    totalBytes: document.totalBytes,
    complete: nextOffset === null,
    diffTruncated: nextOffset !== null,
    omittedPaths: document.ranges.filter((range) => range.end > end).map((range) => range.path),
  };
}

export function previewDiff(document: DiffDocument): DiffChunk {
  return readDiffChunk(document, 0, MAX_DIFF_PREVIEW_CHARACTERS);
}
