import { sanitizeLegacyCompactionSummary } from "./limits.ts";

export type ExportToolActivity = {
  name: string;
  status: "called" | "completed" | "failed";
  origin: "model";
  inputPresent?: boolean;
  outputPresent?: boolean;
};

export const MAX_EXPORT_REASONING_CHARACTERS = 24_000;
export const MAX_EXPORT_TOOL_ACTIVITIES_PER_MESSAGE = 128;
export const MAX_EXPORT_TOOL_CALLS = 256;

const TOOL_STREAM_CHUNK_TYPES = new Set([
  "tool-input-start",
  "tool-input-delta",
  "tool-input-available",
  "tool-input-error",
  "tool-approval-request",
  "tool-approval-response",
  "tool-output-available",
  "tool-output-error",
  "tool-output-denied",
]);

const SAFE_TOOL_NAME = /^[A-Za-z][A-Za-z0-9_.-]{0,127}$/;

function safeToolName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.trim().slice(0, 128);
  return SAFE_TOOL_NAME.test(name) ? name : null;
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.hasOwn(value, key);
}

function normalizeToolStatus(value: unknown): ExportToolActivity["status"] {
  if (value === "completed" || value === "output-available") return "completed";
  if (
    value === "failed" ||
    value === "output-error" ||
    value === "output-denied" ||
    value === "tool-error"
  ) {
    return "failed";
  }
  return "called";
}

function sanitizeToolActivity(value: unknown): ExportToolActivity | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const name = safeToolName(record.name ?? record.toolName);
  if (!name || record.origin !== "model") return null;
  const activity: ExportToolActivity = {
    name,
    status: normalizeToolStatus(record.status ?? record.state),
    origin: "model",
  };
  if (typeof record.inputPresent === "boolean") activity.inputPresent = record.inputPresent;
  if (typeof record.outputPresent === "boolean") activity.outputPresent = record.outputPresent;
  return activity;
}

function sanitizeNativeToolPart(
  candidate: Record<string, unknown>,
): Record<string, unknown> | null {
  const type = typeof candidate.type === "string" ? candidate.type : "";
  let name: string | null = null;

  if (type === "dynamic-tool" || type === "tool-invocation") {
    name = safeToolName(candidate.toolName);
  } else if (type === "tool-call") {
    name = safeToolName(candidate.toolName ?? candidate.name);
  } else if (type.startsWith("tool-") && !TOOL_STREAM_CHUNK_TYPES.has(type)) {
    name = safeToolName(candidate.toolName ?? type.slice("tool-".length));
  }

  if (!name) return null;
  const activity: ExportToolActivity = {
    name,
    status: normalizeToolStatus(candidate.status ?? candidate.state ?? type),
    origin: "model",
    inputPresent: hasOwn(candidate, "input"),
    outputPresent: hasOwn(candidate, "output"),
  };
  return { type: "data-tool-activity", data: activity };
}

/**
 * Keep exported transcripts useful for audits without copying provider
 * metadata, MCP arguments, or raw tool results into a downloadable file.
 */
export function sanitizeExportMessage(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  const message = value as Record<string, unknown>;
  const role = message.role === "user" || message.role === "assistant" ? message.role : "assistant";
  let toolActivityParts = 0;
  const parts = Array.isArray(message.parts)
    ? message.parts
        .map((part) => {
          if (!part || typeof part !== "object") return null;
          const candidate = part as Record<string, unknown>;
          if (candidate.type === "text" && typeof candidate.text === "string") {
            return { type: "text", text: candidate.text.slice(0, 8_000) };
          }
          if (candidate.type === "reasoning") {
            if (role !== "assistant" || typeof candidate.text !== "string") return null;
            const result: Record<string, unknown> = {
              type: "reasoning",
              text: candidate.text.slice(0, MAX_EXPORT_REASONING_CHARACTERS),
            };
            if (candidate.state === "streaming" || candidate.state === "done") {
              result.state = candidate.state;
            }
            return result;
          }
          if (candidate.type === "data-tool-activity") {
            if (role !== "assistant") return null;
            if (toolActivityParts >= MAX_EXPORT_TOOL_ACTIVITIES_PER_MESSAGE) return null;
            const activity = sanitizeToolActivity(candidate.data);
            if (activity) toolActivityParts += 1;
            return activity ? { type: "data-tool-activity", data: activity } : null;
          }
          if (role === "assistant") {
            const nativeTool = sanitizeNativeToolPart(candidate);
            if (nativeTool) {
              if (toolActivityParts >= MAX_EXPORT_TOOL_ACTIVITIES_PER_MESSAGE) return null;
              toolActivityParts += 1;
              return nativeTool;
            }
          }
          if (candidate.type === "data-compaction") {
            const data = candidate.data;
            if (!data || typeof data !== "object") return null;
            const record = data as Record<string, unknown>;
            if (typeof record.summary !== "string") return null;
            return {
              type: "data-compaction",
              data: {
                summary: sanitizeLegacyCompactionSummary(record.summary),
                retainedMessages:
                  typeof record.retainedMessages === "number" ? record.retainedMessages : null,
              },
            };
          }
          if (candidate.type === "source-url") {
            const sourceId = typeof candidate.sourceId === "string" ? candidate.sourceId : "";
            const url = typeof candidate.url === "string" ? candidate.url.slice(0, 2_048) : "";
            if (!sourceId || !url) return null;
            return {
              type: "source-url",
              sourceId,
              url,
              title:
                typeof candidate.title === "string" ? candidate.title.slice(0, 256) : undefined,
            };
          }
          if (candidate.type === "data-citation") {
            return { type: candidate.type, data: candidate.data ?? null };
          }
          return null;
        })
        .filter((part): part is Record<string, unknown> => part !== null)
    : [];

  return {
    id: typeof message.id === "string" ? message.id : null,
    role,
    parts,
    timestamp:
      typeof (message.metadata as Record<string, unknown> | undefined)?.timestamp === "string"
        ? (message.metadata as Record<string, unknown>).timestamp
        : null,
  };
}

/**
 * Add a compact top-level index so an auditor can see every tool call without
 * walking each message part. The per-message parts remain the chronological
 * source of truth.
 */
export function collectExportToolCalls(
  messages: readonly Record<string, unknown>[],
): Record<string, unknown>[] {
  const calls: Record<string, unknown>[] = [];
  for (const message of messages) {
    const parts = Array.isArray(message.parts) ? message.parts : [];
    for (const part of parts) {
      if (!part || typeof part !== "object") continue;
      const candidate = part as Record<string, unknown>;
      if (candidate.type !== "data-tool-activity") continue;
      const activity = sanitizeToolActivity(candidate.data);
      if (!activity) continue;
      calls.push({
        messageId: typeof message.id === "string" ? message.id : null,
        ...activity,
      });
      if (calls.length >= MAX_EXPORT_TOOL_CALLS) return calls;
    }
  }
  return calls;
}
