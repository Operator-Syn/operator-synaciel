import type { FileUIPart, SourceDocumentUIPart, SourceUrlUIPart, UIMessage } from "ai";

export type PortfolioAssistantCompactionNotice = {
  retainedMessages: number;
};

export const PORTFOLIO_ASSISTANT_STARTER_PROMPTS = [
  "Give me a tour of the portfolio.",
  "What kinds of projects are featured?",
  "Show me certificates.",
  "How can I contact Operator-Syn?",
] as const;

function messagePartText(message: UIMessage, type: "text" | "reasoning"): string {
  return message.parts.reduce((text, part) => {
    if (type === "text" && part.type === "text") return text + part.text;
    if (type === "reasoning" && part.type === "reasoning") return text + part.text;
    return text;
  }, "");
}

export function messageText(message: UIMessage): string {
  return messagePartText(message, "text");
}

export type AssistantToolCallSegment =
  | { type: "text"; text: string }
  | { type: "tool-call"; name: string };

const ASSISTANT_TOOL_CALL_PATTERN =
  /<tool_call>\s*([A-Za-z][A-Za-z0-9_.-]{0,127})\s*<\/tool_call>/gi;

/**
 * Split model-emitted tool markers into presentation segments.
 *
 * Conversational turns do not expose callable tools, but a provider can still
 * emit an XML-like marker in ordinary text. This parser is intentionally
 * presentation-only: it validates a bounded tool name and never executes it.
 * Incomplete or malformed markers remain ordinary text so streaming output is
 * not lost while a closing tag is still arriving.
 */
export function splitAssistantToolCalls(value: string): AssistantToolCallSegment[] {
  const matches = [...value.matchAll(ASSISTANT_TOOL_CALL_PATTERN)];
  if (matches.length === 0) return [{ type: "text", text: value }];

  const segments: AssistantToolCallSegment[] = [];
  let cursor = 0;

  for (const match of matches) {
    const index = match.index ?? cursor;
    if (index > cursor) segments.push({ type: "text", text: value.slice(cursor, index) });
    segments.push({ type: "tool-call", name: match[1] ?? "tool" });
    cursor = index + match[0].length;
  }

  if (cursor < value.length) segments.push({ type: "text", text: value.slice(cursor) });
  return segments;
}

export type StreamingMarkdownParts = {
  stable: string;
  pending: string;
};

/**
 * Keep the unfinished Markdown block out of the parser while an answer is
 * streaming. Re-parsing an open list/table/fence on every token causes the
 * browser to replace large portions of the message tree and makes the reader
 * visibly jump. A blank-line boundary outside a fenced block is a safe point
 * at which the prefix can be committed to the normal Markdown renderer.
 */
export function splitStreamingMarkdown(value: string): StreamingMarkdownParts {
  if (!value) return { stable: "", pending: "" };

  const lines = value.match(/[^\n]*(?:\n|$)/g)?.filter((line) => line.length > 0) ?? [];
  let lineStart = 0;
  let stableEnd = 0;
  let inFence = false;

  for (const line of lines) {
    const content = line.replace(/\r?\n$/, "");
    const isFence = /^\s*(`{3,}|~{3,})/.test(content);
    if (isFence) inFence = !inFence;

    if (!inFence && content.trim() === "" && lineStart > 0) {
      stableEnd = lineStart + line.length;
    }
    lineStart += line.length;
  }

  return {
    stable: value.slice(0, stableEnd),
    pending: value.slice(stableEnd),
  };
}

export function messageReasoning(message: UIMessage): string {
  return messagePartText(message, "reasoning");
}

function visibleMessagePartKey(part: UIMessage["parts"][number]): readonly unknown[] | null {
  switch (part.type) {
    case "text":
      return ["text", part.text];
    case "reasoning":
      return ["reasoning", part.text];
    case "file":
      return ["file", part.mediaType, part.filename ?? null, part.url];
    case "source-url":
      return ["source-url", part.sourceId, part.url, part.title ?? null];
    case "source-document":
      return ["source-document", part.sourceId, part.mediaType, part.title, part.filename ?? null];
    default:
      return null;
  }
}

/**
 * Build a key from fields that the transcript actually renders.
 *
 * The AI SDK may update provider metadata and streaming state while retaining
 * the same visible content. Including those transient fields makes the
 * throttled transcript snapshot publish forever and can trip React's maximum
 * update-depth guard, so they intentionally do not participate in this key.
 */
export function messageSnapshotKey(messages: readonly UIMessage[]): string {
  return JSON.stringify(
    messages.map((message) => [
      message.id,
      message.role,
      message.parts
        .map(visibleMessagePartKey)
        .filter((part): part is readonly unknown[] => part !== null),
    ]),
  );
}

export type AssistantThreadLabelSource = {
  id: string;
  title: string | null;
};

type AssistantThreadOption = {
  id: string;
  label: string;
};

function uniqueThreadIdPrefixLength(ids: readonly string[]): number {
  const maximumLength = Math.max(6, ...ids.map((id) => id.length));
  for (let length = 6; length < maximumLength; length += 1) {
    const prefixes = ids.map((id) => id.slice(0, length));
    if (new Set(prefixes).size === prefixes.length) return length;
  }
  return maximumLength;
}

export function formatAssistantThreadOptions(
  threads: readonly AssistantThreadLabelSource[],
): AssistantThreadOption[] {
  const idsByTitle = new Map<string, string[]>();
  for (const thread of threads) {
    const title = thread.title?.trim();
    if (!title) continue;
    const ids = idsByTitle.get(title);
    if (ids) ids.push(thread.id);
    else idsByTitle.set(title, [thread.id]);
  }

  const suffixLengths = new Map<string, number>();
  for (const ids of idsByTitle.values()) {
    if (ids.length <= 1) continue;
    const length = uniqueThreadIdPrefixLength(ids);
    for (const id of ids) suffixLengths.set(id, length);
  }

  return threads.map((thread) => {
    const title = thread.title?.trim();
    if (!title) {
      return { id: thread.id, label: `Thread ${thread.id.slice(0, 6)}` };
    }
    const suffixLength = suffixLengths.get(thread.id);
    return {
      id: thread.id,
      label: suffixLength ? `${title} · ${thread.id.slice(0, suffixLength)}` : title,
    };
  });
}

export function assistantUserLabel(displayName: string | null | undefined): string {
  return displayName?.trim() || "You";
}

export function messageFileParts(message: UIMessage): FileUIPart[] {
  return message.parts.filter((part): part is FileUIPart => part.type === "file");
}

export function messageSourceUrlParts(message: UIMessage): SourceUrlUIPart[] {
  return message.parts.filter((part): part is SourceUrlUIPart => part.type === "source-url");
}

export function messageSourceDocumentParts(message: UIMessage): SourceDocumentUIPart[] {
  return message.parts.filter(
    (part): part is SourceDocumentUIPart => part.type === "source-document",
  );
}

type AssistantSourcePart = SourceUrlUIPart | SourceDocumentUIPart;

function assistantSourcePartKey(part: AssistantSourcePart): string {
  if (part.type === "source-url") {
    return `url:${part.sourceId}:${part.url}`;
  }
  return `document:${part.sourceId}`;
}

/**
 * The AI SDK can briefly expose source parts in a standalone assistant
 * message before the following assistant snapshot receives the text and
 * reasoning for that same turn. Keep the evidence attached to the completed
 * snapshot instead of rendering two visually identical source disclosures.
 */
export function collapseDuplicateAssistantSourceMessages(
  messages: readonly UIMessage[],
): UIMessage[] {
  return messages.filter((message, index) => {
    if (message.role !== "assistant") return true;
    if (messageText(message).trim() || messageReasoning(message).trim()) return true;
    if (messageFileParts(message).length > 0) return true;

    const currentSources = [
      ...messageSourceUrlParts(message),
      ...messageSourceDocumentParts(message),
    ];
    if (currentSources.length === 0) return true;

    const nextMessage = messages[index + 1];
    if (!nextMessage || nextMessage.role !== "assistant") return true;

    const nextSourceKeys = new Set(
      [...messageSourceUrlParts(nextMessage), ...messageSourceDocumentParts(nextMessage)].map(
        assistantSourcePartKey,
      ),
    );
    return !currentSources.every((part) => nextSourceKeys.has(assistantSourcePartKey(part)));
  });
}

export function parseCompactionNotice(value: unknown): PortfolioAssistantCompactionNotice | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (record.type !== "data-compaction") return null;
  const data = record.data;
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const retainedMessages = (data as Record<string, unknown>).retainedMessages;
  return {
    retainedMessages:
      typeof retainedMessages === "number" &&
      Number.isInteger(retainedMessages) &&
      retainedMessages > 0 &&
      retainedMessages <= 20
        ? retainedMessages
        : 6,
  };
}

function messageCompactionNotice(message: UIMessage): PortfolioAssistantCompactionNotice | null {
  for (const part of message.parts) {
    const notice = parseCompactionNotice(part);
    if (notice) return notice;
  }
  return null;
}

export function latestCompactionNotice(
  messages: readonly UIMessage[],
): PortfolioAssistantCompactionNotice | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    const notice = message ? messageCompactionNotice(message) : null;
    if (notice) return notice;
  }
  return null;
}

export function hasVisibleMessageContent(message: UIMessage): boolean {
  return (
    messageText(message).trim().length > 0 ||
    messageReasoning(message).trim().length > 0 ||
    message.parts.some(
      (part) =>
        part.type === "file" || part.type === "source-url" || part.type === "source-document",
    )
  );
}

export function hasThreadActivity(messages: readonly UIMessage[]): boolean {
  return messages.some((message) => hasVisibleMessageContent(message));
}

export function canStartAnotherThread(
  activeThreadId: string | null,
  hasActivity: boolean | null,
): boolean {
  return !activeThreadId || hasActivity === true;
}

export function shouldShowAssistantTyping(
  isStreaming: boolean,
  messages: readonly UIMessage[],
): boolean {
  if (!isStreaming) return false;
  const latestMessage = messages.at(-1);
  return (
    !latestMessage || latestMessage.role !== "assistant" || !hasVisibleMessageContent(latestMessage)
  );
}
