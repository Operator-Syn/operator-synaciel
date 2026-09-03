import assert from "node:assert/strict";
import { test } from "node:test";
import { streamText, tool } from "ai";
import { z } from "zod";
import {
  createPortfolioEvidenceState,
  portfolioToolChoice,
  recordPortfolioToolResult,
  selectPortfolioTools,
} from "../../workers/portfolio-agent/src/evidence.ts";

const portfolioToolNames = [
  "get_portfolio_overview",
  "search_portfolio",
  "list_projects",
  "get_project",
  "list_certificates",
  "get_certificate",
  "list_snippets",
  "read_snippet",
] as const;

const githubToolNames = [
  "get_project_repository",
  "get_project_readme",
  "list_project_commits",
  "get_project_commit",
] as const;

const results: Record<(typeof portfolioToolNames)[number], unknown> = {
  get_portfolio_overview: {
    structuredContent: { site: { headerPhrase: "Build with intent" }, profile: [], sections: [] },
  },
  search_portfolio: {
    structuredContent: {
      query: "React Flask",
      results: [
        {
          kind: "project",
          id: 5,
          title: "The Hootline",
          summary: "React-Flask mentorship platform",
          url: "https://syn-forge.com/projects",
          project_link: "https://github.com/Operator-Syn/peer-tutoring-platform",
          matched_terms: ["react", "flask"],
          matched_fields: ["short_description"],
        },
      ],
    },
  },
  list_projects: {
    structuredContent: {
      data: [{ id: 5, title: "The Hootline", project_link: "https://example.test/project" }],
      pagination: { has_more: false },
    },
  },
  get_project: {
    structuredContent: {
      project: { id: 5, title: "The Hootline", project_link: "https://example.test/project" },
      gallery: [],
      canonical_url: "https://syn-forge.com/projects",
    },
  },
  list_certificates: {
    structuredContent: {
      data: [{ id: 9, title: "Virtual Services Internship" }],
      pagination: { has_more: false },
    },
  },
  get_certificate: {
    structuredContent: {
      certificate: { id: 9, title: "Virtual Services Internship" },
      items: [],
      canonical_url: "https://syn-forge.com/certificates",
    },
  },
  list_snippets: {
    structuredContent: {
      snippets: [{ id: 7, name: "Agent Notes.md", page_url: "https://syn-forge.com/snippets" }],
    },
  },
  read_snippet: {
    structuredContent: {
      id: 7,
      name: "Agent Notes.md",
      format: "md",
      content: "Public notes",
      page_url: "https://syn-forge.com/snippets/document/7/agent-notes.md/",
    },
  },
};

function makeTools() {
  return Object.fromEntries(
    [...portfolioToolNames, ...githubToolNames].map((name) => [
      `portfolio_${name}`,
      tool({
        description: `Fixture tool ${name}`,
        inputSchema: z.object({}).passthrough(),
        execute: async () => results[name as (typeof portfolioToolNames)[number]] ?? {},
      }),
    ]),
  );
}

function usage() {
  return {
    inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
    outputTokens: { total: 1, text: 1, reasoning: 0 },
  };
}

async function runFixture(question: string, calls: readonly string[]) {
  const selectedTools = selectPortfolioTools(makeTools());
  let evidenceState = createPortfolioEvidenceState();
  const seenChoices: string[] = [];
  const seenToolCatalogs: string[][] = [];
  let modelCall = 0;

  const model = {
    specificationVersion: "v3",
    provider: "portfolio-fixture",
    modelId: "tool-loop",
    supportedUrls: {},
    async doGenerate() {
      throw new Error("The regression harness uses streaming only.");
    },
    async doStream(options: { tools?: Array<{ name: string }>; toolChoice?: { type: string } }) {
      seenChoices.push(options.toolChoice?.type ?? "auto");
      seenToolCatalogs.push((options.tools ?? []).map((candidate) => candidate.name));
      const toolName = calls[modelCall];
      const currentCall = modelCall;
      modelCall += 1;
      return {
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: "stream-start", warnings: [] });
            if (toolName) {
              controller.enqueue({
                type: "tool-call",
                toolCallId: `call-${String(currentCall)}`,
                toolName: `portfolio_${toolName}`,
                input: "{}",
              });
              controller.enqueue({
                type: "finish",
                finishReason: { unified: "tool-calls", raw: "tool-calls" },
                usage: usage(),
              });
            } else {
              controller.enqueue({ type: "text-start", id: "answer" });
              controller.enqueue({
                type: "text-delta",
                id: "answer",
                delta: `Answered: ${question}`,
              });
              controller.enqueue({ type: "text-end", id: "answer" });
              controller.enqueue({
                type: "finish",
                finishReason: { unified: "stop", raw: "stop" },
                usage: usage(),
              });
            }
            controller.close();
          },
        }),
      };
    },
  };

  const executed: string[] = [];
  const instrumentedTools = Object.fromEntries(
    Object.entries(selectedTools).map(([name, candidate]) => [
      name,
      {
        ...candidate,
        execute: async (input: unknown, options: unknown) => {
          executed.push(name.replace(/^portfolio_/, ""));
          return candidate.execute?.(input as never, options as never);
        },
      },
    ]),
  );

  const result = streamText({
    model: model as never,
    messages: [{ role: "user", content: question }],
    tools: instrumentedTools,
    prepareStep: () => ({ toolChoice: portfolioToolChoice(evidenceState) }),
    stopWhen: () => false,
    onToolExecutionEnd: ({ toolCall, toolOutput }) => {
      evidenceState = recordPortfolioToolResult(evidenceState, toolCall.toolName, toolOutput);
    },
  });

  assert.equal(await result.text, `Answered: ${question}`);
  return { executed, seenChoices, seenToolCatalogs, evidenceState };
}

test("lets one model/tool loop choose list, get, read, and search tools across portfolio domains", async () => {
  const fixtures = [
    ["Who is behind this portfolio?", ["get_portfolio_overview"]],
    ["Walk me through the featured work.", ["list_projects", "get_project"]],
    ["What training has been completed?", ["list_certificates", "get_certificate"]],
    ["What notes can I read?", ["list_snippets", "read_snippet"]],
    [
      "Compare the React and Flask evidence, then tell me more about the strongest match.",
      ["search_portfolio", "get_project"],
    ],
  ] as const;

  for (const [question, calls] of fixtures) {
    const run = await runFixture(question, calls);
    assert.deepEqual(run.executed, calls);
    assert.equal(run.seenChoices[0], "required");
    assert.ok(run.seenChoices.slice(1).every((choice) => choice === "auto"));
    assert.equal(run.evidenceState.successfulResults, calls.length);
    for (const catalog of run.seenToolCatalogs) {
      const suffixes = catalog.map((name) => name.replace(/^portfolio_/, ""));
      assert.deepEqual(suffixes.sort(), [...portfolioToolNames].sort());
      assert.ok(githubToolNames.every((name) => !suffixes.includes(name)));
    }
  }
});
