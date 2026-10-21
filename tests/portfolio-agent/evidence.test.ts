import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createPortfolioEvidenceEntry,
  createPortfolioEvidenceState,
  extractPortfolioSources,
  extractStructuredContent,
  hasCompletePortfolioToolCatalog,
  hasUsablePortfolioToolResult,
  portfolioToolChoice,
  recordPortfolioToolResult,
  seedPortfolioEvidenceState,
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
  "get_project_repository",
  "get_project_readme",
  "list_project_commits",
  "get_project_commit",
  "list_project_files",
  "get_project_file",
];

test("selects the fourteen portfolio capabilities without inspecting question text", () => {
  const catalog = Object.fromEntries(
    [...portfolioNames, "arbitrary_remote_tool"].map((name) => [`portfolio_${name}`, { name }]),
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
    { url: "https://syn-forge.com/projects", title: "Syn-Forge projects" },
    {
      url: "https://github.com/Operator-Syn/peer-tutoring-platform",
      title: "The Hootline",
    },
  ]);
});

test("accepts same-origin page reads as evidence with their citation", () => {
  const pageResult = {
    structuredContent: {
      path: "/ai",
      page_url: "https://syn-forge.com/ai",
      title: "AI and MCP Access",
      content: "Portfolio, readable by agents.",
      offset: 0,
      next_offset: 30,
      total_characters: 30,
      complete: true,
    },
  };
  assert.equal(hasUsablePortfolioToolResult("read_portfolio_page", pageResult), true);
  assert.deepEqual(extractPortfolioSources("read_portfolio_page", pageResult), [
    { url: "https://syn-forge.com/ai", title: "AI and MCP Access" },
  ]);
  assert.equal(
    hasUsablePortfolioToolResult("read_portfolio_page", {
      structuredContent: { page_url: "https://syn-forge.com/ai", content: "  " },
    }),
    false,
  );
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

test("projects, certificates, and snippets receive distinct compact slots", () => {
  const project = {
    id: 5,
    title: "The Hootline",
    type: "video",
    url: "https://media.example/hootline.mp4",
    short_description: "React-Flask mentorship platform",
    long_description: "long description".repeat(1_000),
    project_link: "https://github.com/Operator-Syn/peer-tutoring-platform",
    categories: ["education-platform", "mentorship"],
    stack: ["react", "flask"],
    highlights: ["Domain-restricted auth", "Automated scheduling"],
    display_order: 4,
    created_at: "2026-01-01",
  };
  const projectList = createPortfolioEvidenceEntry(
    "portfolio_list_projects",
    {
      structuredContent: {
        data: [project],
        pagination: { limit: 6, total: 1, has_more: false, next_cursor: null },
      },
    },
    1,
  );
  assert.ok(projectList);
  assert.equal(projectList.slot, "projects");
  const listEvidence = JSON.parse(projectList.snapshot).evidence as {
    data: Array<Record<string, unknown>>;
  };
  assert.deepEqual(listEvidence.data[0]?.categories, ["education-platform", "mentorship"]);
  assert.deepEqual(listEvidence.data[0]?.stack, ["react", "flask"]);
  assert.equal("long_description" in (listEvidence.data[0] ?? {}), false);

  const projectDetail = createPortfolioEvidenceEntry(
    "portfolio_get_project",
    {
      structuredContent: {
        project,
        gallery: [],
        canonical_url: "https://syn-forge.com/projects",
      },
    },
    2,
  );
  assert.ok(projectDetail);
  assert.equal(projectDetail.slot, "project:5");
  const detailEvidence = JSON.parse(projectDetail.snapshot).evidence as {
    project: { long_description: string };
  };
  assert.equal(detailEvidence.project.long_description.length, 2_000);

  const certificate = createPortfolioEvidenceEntry(
    "portfolio_get_certificate",
    {
      structuredContent: {
        certificate: {
          id: 9,
          title: "Virtual Services Internship",
          type: "image",
          url: "https://media.example/certificate.png",
          short_description: "Training record",
          long_description: "Completed the program",
          certificate_link: null,
          display_order: 2,
          created_at: "2026-01-01",
        },
        items: [],
        canonical_url: "https://syn-forge.com/certificates",
      },
    },
    3,
  );
  assert.ok(certificate);
  assert.equal(certificate.slot, "certificate:9");

  const snippet = createPortfolioEvidenceEntry(
    "portfolio_read_snippet",
    {
      structuredContent: {
        id: 7,
        name: "Agent Notes.md",
        type: "file",
        modified: "2026-01-01",
        size: 20,
        format: "md",
        path_segments: ["Notes", "Agent Notes.md"],
        page_url: "https://syn-forge.com/snippets/document/7/agent-notes.md",
        offset: 0,
        content: "Public notes",
        next_offset: 12,
        total_characters: 12,
        complete: true,
      },
    },
    4,
  );
  assert.ok(snippet);
  assert.equal(snippet.slot, "snippet:7");
  assert.match(snippet.snapshot, /Public notes/);
});

test("keeps linked repository metadata, files, and content in distinct evidence slots", () => {
  const repositoryResult = {
    structuredContent: {
      project_id: 5,
      repository: {
        owner: "operator-syn",
        name: "peer-tutoring-platform",
        full_name: "operator-syn/peer-tutoring-platform",
        description: "Mentorship platform",
        canonical_url: "https://github.com/operator-syn/peer-tutoring-platform",
        branch: "main",
        main_available: true,
        main_sha: "a".repeat(40),
        readme_available: true,
        commit_history_available: true,
      },
    },
  };
  assert.equal(hasUsablePortfolioToolResult("get_project_repository", repositoryResult), true);
  const repository = createPortfolioEvidenceEntry(
    "portfolio_get_project_repository",
    repositoryResult,
    10,
  );
  assert.ok(repository);
  assert.equal(repository.slot, "repository:5");
  assert.deepEqual(extractPortfolioSources("get_project_repository", repositoryResult), [
    {
      url: "https://github.com/operator-syn/peer-tutoring-platform",
      title: "peer-tutoring-platform",
    },
  ]);

  const files = createPortfolioEvidenceEntry(
    "portfolio_list_project_files",
    {
      structuredContent: {
        project_id: 5,
        repository_url: "https://github.com/operator-syn/peer-tutoring-platform",
        commit_sha: "a".repeat(40),
        files: [{ path: "src/index.ts", size: 26, blob_sha: "b".repeat(40) }],
        total_files: 1,
        tree_truncated: false,
        pagination: { limit: 50, has_more: false, next_cursor: null },
      },
    },
    11,
  );
  assert.ok(files);
  assert.equal(files.slot, "repository-files:5");
  assert.match(files.snapshot, /src\/index\.ts/);

  const fileResult = {
    structuredContent: {
      project_id: 5,
      repository_url: "https://github.com/operator-syn/peer-tutoring-platform",
      commit_sha: "a".repeat(40),
      path: "src/index.ts",
      blob_sha: "b".repeat(40),
      size: 26,
      canonical_url: `https://github.com/operator-syn/peer-tutoring-platform/blob/${"a".repeat(40)}/src/index.ts`,
      content_available: true,
      offset: 0,
      content: "export const answer = 42;",
      next_offset: 26,
      total_characters: 26,
      complete: true,
    },
  };
  const file = createPortfolioEvidenceEntry("portfolio_get_project_file", fileResult, 12);
  assert.ok(file);
  assert.equal(file.slot, "repository-file:5:src/index.ts");
  assert.match(file.snapshot, /export const answer/);
  assert.ok(
    extractPortfolioSources("get_project_file", fileResult).some((source) =>
      source.url.endsWith(`/blob/${"a".repeat(40)}/src/index.ts`),
    ),
  );
});

test("prioritizes sources from the current tool result", () => {
  let state = recordPortfolioToolResult(createPortfolioEvidenceState(), "get_portfolio_overview", {
    structuredContent: {
      site: { status: "Available" },
      profile: [],
      sections: [{ id: 1, title: "Links", section_type: "links", items: [] }],
    },
  });
  state = recordPortfolioToolResult(state, "list_projects", {
    structuredContent: {
      data: [
        {
          id: 5,
          title: "The Hootline",
          project_link: "https://github.com/Operator-Syn/peer-tutoring-platform",
        },
      ],
      pagination: { limit: 6, total: 1, has_more: false, next_cursor: null },
    },
  });

  assert.equal(state.sources[0]?.url, "https://syn-forge.com/projects");
  assert.equal(
    state.sources.find((source) => source.url === "https://syn-forge.com/")?.title,
    "Syn-Forge home",
  );
});

test("seeds evidence state from prior ledger sources", () => {
  const state = seedPortfolioEvidenceState([
    { url: "https://syn-forge.com/", title: "Home" },
    { url: "https://syn-forge.com/ai", title: "AI" },
  ]);
  assert.equal(state.successfulResults, 1);
  assert.equal(state.unusableResults, 0);
  assert.deepEqual(state.sources, [
    { url: "https://syn-forge.com/", title: "Home" },
    { url: "https://syn-forge.com/ai", title: "AI" },
  ]);
});
