import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createPortfolioEvidenceState,
  extractPortfolioSources,
  extractStructuredContent,
  hasCompletePortfolioToolCatalog,
  hasUsablePortfolioToolResult,
  portfolioToolChoice,
  recordPortfolioToolResult,
  selectPortfolioTools,
  shouldStopPortfolioToolLoop,
} from "../../workers/portfolio-agent/src/evidence.ts";

const portfolioNames = [
  "get_portfolio_overview",
  "search_portfolio",
  "list_projects",
  "get_project",
  "list_certificates",
  "get_certificate",
  "list_snippets",
  "read_snippet",
];

test("selects the eight portfolio capabilities without inspecting question text", () => {
  const catalog = Object.fromEntries(
    [
      ...portfolioNames,
      "get_project_repository",
      "get_project_readme",
      "list_project_commits",
      "get_project_commit",
      "arbitrary_remote_tool",
    ].map((name) => [`portfolio_${name}`, { name }]),
  );

  const selected = selectPortfolioTools(catalog);
  assert.deepEqual(
    Object.keys(selected).map((name) => name.replace(/^portfolio_/, "")),
    portfolioNames,
  );
  assert.equal(hasCompletePortfolioToolCatalog(selected), true);
  assert.equal(
    hasCompletePortfolioToolCatalog({
      ...selected,
      portfolio_read_snippet: undefined,
    }),
    false,
  );
  const incomplete = { ...selected };
  delete incomplete.portfolio_read_snippet;
  assert.equal(hasCompletePortfolioToolCatalog(incomplete), false);
});

test("accepts only usable successful portfolio results as evidence", () => {
  const projectResult = {
    structuredContent: {
      project: {
        id: 5,
        title: "The Hootline",
        project_link: "https://github.com/Operator-Syn/peer-tutoring-platform",
      },
      gallery: [],
      canonical_url: "https://syn-forge.com/projects",
    },
  };

  assert.equal(hasUsablePortfolioToolResult("portfolio_get_project", projectResult), true);
  assert.equal(
    hasUsablePortfolioToolResult("portfolio_search_portfolio", {
      structuredContent: { query: "missing", results: [] },
    }),
    false,
  );
  assert.equal(
    hasUsablePortfolioToolResult("portfolio_get_project", {
      type: "tool-error",
      error: new Error("upstream detail"),
    }),
    false,
  );
  assert.equal(
    hasUsablePortfolioToolResult("portfolio_get_project_repository", projectResult),
    false,
  );
  assert.deepEqual(extractStructuredContent(projectResult), projectResult.structuredContent);
  assert.deepEqual(extractPortfolioSources("portfolio_get_project", projectResult), [
    { url: "https://syn-forge.com/projects", title: "get project" },
    {
      url: "https://github.com/Operator-Syn/peer-tutoring-platform",
      title: "The Hootline",
    },
  ]);
});

test("requires evidence before prose and bounds repeated unusable results", () => {
  let state = createPortfolioEvidenceState();
  assert.equal(portfolioToolChoice(state), "required");

  for (let attempt = 0; attempt < 3; attempt += 1) {
    state = recordPortfolioToolResult(state, "search_portfolio", {
      type: "tool-result",
      output: { structuredContent: { query: "missing", results: [] } },
    });
  }
  assert.equal(state.successfulResults, 0);
  assert.equal(state.unusableResults, 3);
  assert.equal(shouldStopPortfolioToolLoop(state), true);

  state = recordPortfolioToolResult(state, "get_portfolio_overview", {
    type: "tool-result",
    output: {
      structuredContent: {
        site: { headerPhrase: "Build with intent" },
        profile: [],
        sections: [],
      },
    },
  });
  assert.equal(portfolioToolChoice(state), "auto");
  assert.equal(shouldStopPortfolioToolLoop(state), false);
});
