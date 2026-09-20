import assert from "node:assert/strict";
import { test } from "node:test";
import {
  countMarkdownWords,
  estimateMarkdownReadingTime,
  MARKDOWN_WORDS_PER_MINUTE,
} from "../../apps/portfolio-web/src/components/pages/snippetsPage/readingTime.ts";
import {
  getSnippetDocumentRoute,
  slugifySnippetName,
} from "../../apps/portfolio-web/src/components/pages/snippetsPage/snippetRoutes.ts";
import {
  createSnippetStructuredData,
  normalizeSchemaDate,
} from "../../apps/portfolio-web/src/components/pages/snippetsPage/snippetStructuredData.ts";
import {
  createSnippetExcerpt,
  SNIPPET_PREVIEW_MAX_CHARACTERS,
} from "../../workers/portfolio-api/src/model/SnippetsPage/SnippetsPageModel.ts";

test("uses a teaser-sized default preview budget", () => {
  assert.equal(SNIPPET_PREVIEW_MAX_CHARACTERS, 960);

  const result = createSnippetExcerpt("x".repeat(2_000));

  assert.equal(result.truncated, true);
  assert.ok(result.content.length < 1_000);
});

test("keeps short snippet content intact", () => {
  const content = "# Short note\n\nThis fits in the preview.";
  assert.deepEqual(createSnippetExcerpt(content, 200), {
    content,
    truncated: false,
  });
});

test("truncates at a readable paragraph boundary", () => {
  const content = [
    "# Database migrations",
    "",
    "A migration records a repeatable database change.",
    "",
    "That history makes the project reproducible.",
    "",
    "This paragraph belongs to the full document.",
  ].join("\n");
  const result = createSnippetExcerpt(content, 100);

  assert.equal(result.truncated, true);
  assert.match(result.content, /…$/);
  assert.ok(result.content.includes("A migration records a repeatable database change."));
  assert.ok(!result.content.includes("That history makes the project reproducible."));
});

test("closes a fenced block when the preview boundary lands inside code", () => {
  const fence = String.fromCharCode(96).repeat(3);
  const content = [
    "# Example",
    "",
    `${fence}ts`,
    "const answer = 42;",
    "console.log(answer);",
    fence,
    "",
    "The explanation continues below the code.",
  ].join("\n");
  const result = createSnippetExcerpt(content, 48);

  assert.equal(result.truncated, true);
  assert.equal((result.content.match(new RegExp(`^${fence}`, "gm")) || []).length % 2, 0);
});

test("creates readable stable document routes without a schema slug", () => {
  assert.equal(slugifySnippetName("Database Migrations.md"), "database-migrations.md");
  assert.equal(
    getSnippetDocumentRoute(22, "Database Migrations.md"),
    "/snippets/document/22/database-migrations.md/",
  );
});

test("normalizes snippet schema dates to ISO-8601", () => {
  assert.equal(normalizeSchemaDate("2026-06-11 14:46:14"), "2026-06-11T14:46:14Z");
  assert.equal(normalizeSchemaDate("2026-06-11T14:46:14+08:00"), "2026-06-11T06:46:14.000Z");
  assert.equal(normalizeSchemaDate("not-a-date"), undefined);
});

test("serializes complete snippet structured data", () => {
  const structuredData = createSnippetStructuredData({
    canonicalUrl: "https://syn-forge.com/snippets/document/22/database-migrations.md/",
    format: "md",
    modified: "2026-06-11 14:46:14",
    name: "Database Migrations.md",
    readingTimeMinutes: 2,
  });

  assert.equal(JSON.parse(JSON.stringify(structuredData)).dateModified, "2026-06-11T14:46:14Z");
  assert.equal(structuredData["@context"], "https://schema.org");
  assert.equal(structuredData["@type"], "TechArticle");
  assert.equal(structuredData.timeRequired, "PT2M");
});

test("omits invalid snippet schema dates", () => {
  const structuredData = createSnippetStructuredData({
    canonicalUrl: "https://syn-forge.com/snippets/document/22/invalid/",
    format: "pdf",
    modified: "not-a-date",
    name: "Invalid date fixture",
    readingTimeMinutes: null,
  });

  assert.equal("dateModified" in structuredData, false);
});

test("estimates Markdown reading time from reader-facing words", () => {
  const content = [
    "# A readable heading",
    "",
    "Read [this short note](https://example.com) before continuing.",
    "",
    "```ts",
    "const implementationDetail = 'not reader-facing prose';",
    "```",
  ].join("\n");

  assert.equal(countMarkdownWords(content), 9);
  assert.equal(estimateMarkdownReadingTime(content), 1);
  assert.equal(MARKDOWN_WORDS_PER_MINUTE, 200);
});

test("rounds longer Markdown documents up to the next minute", () => {
  assert.equal(estimateMarkdownReadingTime("word ".repeat(200)), 1);
  assert.equal(estimateMarkdownReadingTime("word ".repeat(201)), 2);
  assert.equal(estimateMarkdownReadingTime("```\ncode\n```"), null);
});
