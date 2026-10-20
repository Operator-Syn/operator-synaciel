import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createPortfolioEvidenceEntry,
  formatPortfolioEvidenceLedger,
  type StoredPortfolioEvidence,
} from "../../workers/portfolio-agent/src/evidence.ts";
import { buildSystemPrompt } from "../../workers/portfolio-agent/src/limits.ts";

const now = 5_000_000;

const overviewResult = {
  structuredContent: {
    site: { headerPhrase: "Portfolio, readable by agents" },
    profile: [{ label: "Role", value: "Software developer" }],
    sections: [
      {
        id: 1,
        title: "Selected work",
        section_type: "work",
        items: [
          {
            label: "Projects",
            content: "Selected portfolio projects",
            image_url: null,
            target_url: "https://syn-forge.com/projects",
          },
        ],
      },
    ],
  },
};

function entry(toolName: string, result: unknown, capturedAt: number): StoredPortfolioEvidence {
  const value = createPortfolioEvidenceEntry(toolName, result, capturedAt);
  assert.ok(value);
  return value;
}

function promptFor(entries: StoredPortfolioEvidence[]): string {
  return buildSystemPrompt({
    evidenceLedger: formatPortfolioEvidenceLedger(entries, now + 10),
  });
}

test("fixture: /ai evidence and the guide keep the answer page-focused", () => {
  const prompt = promptFor([
    entry("get_portfolio_overview", overviewResult, now),
    entry(
      "read_portfolio_page",
      {
        structuredContent: {
          path: "/ai",
          page_url: "https://syn-forge.com/ai",
          title: "AI and MCP Access",
          content:
            "Connect to the public read-only Portfolio MCP. Endpoint: https://mcp.syn-forge.com/mcp",
          offset: 0,
          next_offset: 110,
          total_characters: 110,
          complete: true,
        },
      },
      now + 1,
    ),
  ]);

  assert.match(prompt, /ENTRY page:\/ai/);
  assert.match(prompt, /AI and MCP Access/);
  assert.match(prompt, /mcp\.syn-forge\.com\/mcp/);
  assert.match(prompt, /answer it directly before asking/i);
  assert.match(prompt, /\/ai: The public guide to Syn-Forge's read-only Portfolio MCP/);
});

test("fixture: the route map answers page inventory without internal flow questions", () => {
  const prompt = promptFor([entry("get_portfolio_overview", overviewResult, now)]);

  for (const route of [
    "/projects",
    "/certificates",
    "/snippets",
    "/ai",
    "/privacy-policy",
    "/terms-and-conditions",
  ]) {
    assert.match(prompt, new RegExp(route.replace("/", "\\/")));
  }
  assert.match(prompt, /Do not ask the visitor to choose between internal retrieval paths/i);
});

test("fixture: onboarding can use overview plus the trusted guide", () => {
  const prompt = promptFor([entry("get_portfolio_overview", overviewResult, now)]);

  assert.match(prompt, /ENTRY overview/);
  assert.match(prompt, /Portfolio, readable by agents/);
  assert.match(prompt, /For broad onboarding/i);
  assert.match(prompt, /Do not ask which internal retrieval flow/i);
});

test("fixture: Snippets are framed as technical files before any blog label", () => {
  const prompt = promptFor([
    entry(
      "list_snippets",
      {
        structuredContent: {
          snippets: [
            {
              id: 22,
              name: "Database Migrations.md",
              format: "md",
              modified: "2026-01-01",
              size: 120,
              path_segments: ["Database Practices", "Database Migrations.md"],
              page_url: "https://syn-forge.com/snippets/document/22/database-migrations.md",
              download_url: "https://example.test/content",
            },
          ],
        },
      },
      now,
    ),
  ]);

  assert.match(prompt, /ENTRY snippets/);
  assert.match(prompt, /Database Migrations\.md/);
  assert.match(prompt, /technical file archive/i);
  assert.match(prompt, /not automatically a blog feed/i);
  assert.match(prompt, /only when its content explicitly supports that description/i);
});

test("fixture: project-list evidence preserves facets and JSON-format guidance", () => {
  const project = {
    id: 5,
    title: "The Hootline",
    type: "video",
    url: "https://media.example/hootline.mp4",
    short_description: "React-Flask mentorship platform",
    long_description: "Detailed project history".repeat(100),
    project_link: "https://github.com/Operator-Syn/peer-tutoring-platform",
    categories: ["education-platform", "mentorship"],
    stack: ["react", "flask"],
    highlights: ["Domain-restricted auth", "Automated scheduling"],
    display_order: 4,
    created_at: "2026-01-01",
  };
  const prompt = promptFor([
    entry(
      "list_projects",
      {
        structuredContent: {
          data: [project],
          pagination: { limit: 6, total: 1, has_more: false, next_cursor: null },
        },
      },
      now,
    ),
  ]);

  assert.match(prompt, /ENTRY projects/);
  assert.match(prompt, /The Hootline/);
  assert.match(prompt, /education-platform/);
  assert.match(prompt, /react/);
  assert.match(prompt, /requested JSON or another concrete format/i);
  assert.match(prompt, /paginate until the collection is complete/i);
});
