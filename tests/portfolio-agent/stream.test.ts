import assert from "node:assert/strict";
import { test } from "node:test";
import type { UIMessageChunk } from "ai";
import {
  boundPortfolioAnswerStream,
  coalesceToolInputDeltas,
} from "../../workers/portfolio-agent/src/stream.ts";

async function readChunks(stream: ReadableStream<UIMessageChunk>): Promise<UIMessageChunk[]> {
  const reader = stream.getReader();
  const chunks: UIMessageChunk[] = [];
  while (true) {
    const result = await reader.read();
    if (result.done) return chunks;
    chunks.push(result.value);
  }
}

test("coalesces consecutive tool input deltas without reordering stream boundaries", async () => {
  const chunks = [
    { type: "start", messageId: "assistant-1" },
    { type: "tool-input-start", toolCallId: "tool-1", toolName: "search_portfolio" },
    { type: "tool-input-delta", toolCallId: "tool-1", inputTextDelta: '{"query":' },
    { type: "tool-input-delta", toolCallId: "tool-1", inputTextDelta: '"tools"}' },
    {
      type: "tool-input-available",
      toolCallId: "tool-1",
      toolName: "search_portfolio",
      input: { query: "tools" },
    },
    { type: "tool-input-start", toolCallId: "tool-2", toolName: "get_project" },
    { type: "tool-input-delta", toolCallId: "tool-2", inputTextDelta: '{"id":' },
    { type: "tool-input-delta", toolCallId: "tool-2", inputTextDelta: "1}" },
    { type: "text-start", id: "text-1" },
  ] as UIMessageChunk[];

  const source = new ReadableStream<UIMessageChunk>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });

  assert.deepEqual(await readChunks(coalesceToolInputDeltas(source)), [
    chunks[0],
    chunks[1],
    { type: "tool-input-delta", toolCallId: "tool-1", inputTextDelta: '{"query":"tools"}' },
    chunks[4],
    chunks[5],
    { type: "tool-input-delta", toolCallId: "tool-2", inputTextDelta: '{"id":1}' },
    chunks[8],
  ]);
});

test("suppresses unsupported prose until portfolio evidence succeeds", async () => {
  let hasEvidence = false;
  let index = 0;
  const chunks = [
    { type: "text-start", id: "premature" },
    { type: "text-delta", id: "premature", delta: "Unsupported answer" },
    { type: "text-end", id: "premature" },
    {
      type: "tool-output-available",
      toolCallId: "tool-1",
      output: { structuredContent: { data: [{ title: "Project" }] } },
    },
    { type: "text-start", id: "grounded" },
    { type: "text-delta", id: "grounded", delta: "Grounded answer" },
    { type: "text-end", id: "grounded" },
  ] as UIMessageChunk[];
  const source = new ReadableStream<UIMessageChunk>({
    pull(controller) {
      if (index >= chunks.length) {
        controller.close();
        return;
      }
      if (index === 3) hasEvidence = true;
      controller.enqueue(chunks[index] as UIMessageChunk);
      index += 1;
    },
  });

  assert.deepEqual(
    await readChunks(
      boundPortfolioAnswerStream(source, {
        hasEvidence: () => hasEvidence,
        sources: () => [{ url: "https://syn-forge.com/projects", title: "Project" }],
        fallbackMessage: "No portfolio evidence was available.",
      }),
    ),
    [
      chunks[3],
      chunks[4],
      chunks[5],
      chunks[6],
      {
        type: "source-url",
        sourceId: "portfolio-source-0",
        url: "https://syn-forge.com/projects",
        title: "Project",
      },
      { type: "finish", finishReason: "stop" },
    ],
  );
});

test("replaces a no-evidence model turn with a bounded portfolio response", async () => {
  const source = new ReadableStream<UIMessageChunk>({
    start(controller) {
      controller.enqueue({ type: "text-start", id: "unsupported" });
      controller.enqueue({ type: "text-delta", id: "unsupported", delta: "A guess" });
      controller.enqueue({ type: "text-end", id: "unsupported" });
      controller.close();
    },
  });

  const chunks = await readChunks(
    boundPortfolioAnswerStream(source, {
      hasEvidence: () => false,
      sources: () => [],
      fallbackMessage: "I couldn't verify that from the public portfolio evidence.",
    }),
  );

  assert.equal(
    chunks
      .filter((chunk) => chunk.type === "text-delta")
      .map((chunk) => chunk.delta)
      .join(""),
    "I couldn't verify that from the public portfolio evidence.",
  );
  assert.deepEqual(chunks.at(-1), { type: "finish", finishReason: "stop" });
});
