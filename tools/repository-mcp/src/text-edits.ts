export type ExactReplacement = {
  readonly oldText: string;
  readonly newText: string;
};

export type TextEditFailureCode = "ANCHOR_NOT_FOUND" | "AMBIGUOUS_EDIT" | "OVERLAPPING_EDIT";

export type TextEditFailure = {
  readonly code: TextEditFailureCode;
  readonly message: string;
};

export type TextEditResult =
  | {
      readonly ok: true;
      readonly content: string;
    }
  | {
      readonly ok: false;
      readonly error: TextEditFailure;
    };

type ResolvedReplacement = ExactReplacement & {
  readonly start: number;
  readonly end: number;
};

function occurrences(source: string, needle: string): number[] {
  const matches: number[] = [];
  let offset = source.indexOf(needle);
  while (offset >= 0) {
    matches.push(offset);
    offset = source.indexOf(needle, offset + 1);
  }
  return matches;
}

export function applyExactReplacements(
  source: string,
  replacements: readonly ExactReplacement[],
): TextEditResult {
  const resolved: ResolvedReplacement[] = [];
  for (const replacement of replacements) {
    if (replacement.oldText.length === 0) {
      return {
        ok: false,
        error: {
          code: "ANCHOR_NOT_FOUND",
          message: "Exact edit anchors must contain existing text.",
        },
      };
    }
    const matches = occurrences(source, replacement.oldText);
    if (matches.length === 0) {
      return {
        ok: false,
        error: {
          code: "ANCHOR_NOT_FOUND",
          message: "The exact edit anchor was not found in the reviewed file.",
        },
      };
    }
    if (matches.length !== 1) {
      return {
        ok: false,
        error: {
          code: "AMBIGUOUS_EDIT",
          message: "The exact edit anchor matched more than once in the reviewed file.",
        },
      };
    }
    const start = matches[0];
    resolved.push({
      ...replacement,
      start,
      end: start + replacement.oldText.length,
    });
  }

  resolved.sort((left, right) => left.start - right.start);
  for (let index = 1; index < resolved.length; index += 1) {
    const previous = resolved[index - 1];
    const current = resolved[index];
    if (current.start < previous.end) {
      return {
        ok: false,
        error: {
          code: "OVERLAPPING_EDIT",
          message: "Exact edit anchors overlap in the reviewed file.",
        },
      };
    }
  }

  let cursor = 0;
  let content = "";
  for (const replacement of resolved) {
    content += source.slice(cursor, replacement.start);
    content += replacement.newText;
    cursor = replacement.end;
  }
  content += source.slice(cursor);
  return { ok: true, content };
}
