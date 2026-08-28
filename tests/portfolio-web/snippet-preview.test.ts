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
