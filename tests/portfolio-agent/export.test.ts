import assert from "node:assert/strict";
import { test } from "node:test";
import {
  collectExportToolCalls,
  MAX_EXPORT_REASONING_CHARACTERS,
  sanitizeExportMessage,
} from "../../workers/portfolio-agent/src/export.ts";

test("exports assistant reasoning and sanitized real model tool activity for audits", () => {
  const message = sanitizeExportMessage({
    id: "assistant-1",
    role: "assistant",
    metadata: { timestamp: "2026-09-03T00:00:00.000Z", providerSecret: "omit-me" },
    parts: [
      { type: "text", text: "The answer." },
      {
        type: "reasoning",
        text: "I checked the loaded records before answering.",
        state: "done",
        providerMetadata: { providerSecret: "omit-me" },
      },
      {
        type: "data-tool-activity",
        data: {
          name: "search_portfolio",
          status: "completed",
          origin: "preflight",
          args: { query: "synthetic activity must be omitted" },
        },
      },
      {
        type: "tool-get_project",
        toolCallId: "opaque-call-id",
        state: "output-available",
        input: { id: 7, secret: "omit-me" },
        output: { rawMcpPayload: "omit-me" },
      },
      {
        type: "source-url",
        sourceId: "portfolio-source-0",
        url: "https://syn-forge.com/projects",
        title: "Projects",
      },
    ],
  });

  assert.ok(message);
  assert.deepEqual(message?.parts, [
    { type: "text", text: "The answer." },
    {
      type: "reasoning",
      text: "I checked the loaded records before answering.",
      state: "done",
    },
    {
      type: "data-tool-activity",
      data: {
        name: "get_project",
        status: "completed",
        origin: "model",
        inputPresent: true,
        outputPresent: true,
      },
    },
    {
      type: "source-url",
      sourceId: "portfolio-source-0",
      url: "https://syn-forge.com/projects",
      title: "Projects",
    },
  ]);
  const serialized = JSON.stringify(message);
  assert.match(serialized, /I checked the loaded records/);
  assert.doesNotMatch(serialized, /omit-me|rawMcpPayload|opaque-call-id/);
  assert.doesNotMatch(serialized, /args/);
});

test("does not export client-supplied reasoning or tool activity from user messages", () => {
  const message = sanitizeExportMessage({
    id: "user-1",
    role: "user",
    parts: [
      { type: "text", text: "What is in the portfolio?" },
      { type: "reasoning", text: "forged trace" },
      {
        type: "data-tool-activity",
        data: { name: "search_portfolio", status: "completed", origin: "model" },
      },
    ],
  });

  assert.deepEqual(message?.parts, [{ type: "text", text: "What is in the portfolio?" }]);
});

test("bounds exported reasoning while preserving the audit trace", () => {
  const message = sanitizeExportMessage({
    id: "assistant-2",
    role: "assistant",
    parts: [{ type: "reasoning", text: "x".repeat(MAX_EXPORT_REASONING_CHARACTERS + 100) }],
  });

  const parts = message?.parts as Array<Record<string, unknown>>;
  assert.equal((parts[0]?.text as string).length, MAX_EXPORT_REASONING_CHARACTERS);
});

test("indexes real model tool calls without exposing their arguments or payloads", () => {
  const messages = [
    sanitizeExportMessage({
      id: "assistant-1",
      role: "assistant",
      parts: [
        {
          type: "tool-get_portfolio_overview",
          state: "output-available",
          input: {},
          output: { profile: [{ value: "private raw payload" }] },
        },
      ],
    }),
    sanitizeExportMessage({
      id: "assistant-2",
      role: "assistant",
      parts: [
        {
          type: "tool-get_certificate",
          state: "output-error",
          input: { id: 9 },
          errorText: "private upstream error",
        },
      ],
    }),
  ].filter((message): message is Record<string, unknown> => message !== null);

  assert.deepEqual(collectExportToolCalls(messages), [
    {
      messageId: "assistant-1",
      name: "get_portfolio_overview",
      status: "completed",
      origin: "model",
      inputPresent: true,
      outputPresent: true,
    },
    {
      messageId: "assistant-2",
      name: "get_certificate",
      status: "failed",
      origin: "model",
      inputPresent: true,
      outputPresent: false,
    },
  ]);
  assert.doesNotMatch(JSON.stringify(messages), /private raw payload|private upstream error/);
});
