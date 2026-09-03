import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";

const repositoryRoot = resolve(import.meta.dirname, "../../");
const fabPath = resolve(
  repositoryRoot,
  "apps/portfolio-web/src/components/portfolioAssistant/PortfolioAssistantFab.tsx",
);
const cssPath = resolve(
  repositoryRoot,
  "apps/portfolio-web/src/components/portfolioAssistant/PortfolioAssistant.css",
);

test("keeps the composer steady and outside the transcript paint region", async () => {
  const [fabSource, cssSource] = await Promise.all([
    readFile(fabPath, "utf8"),
    readFile(cssPath, "utf8"),
  ]);

  assert.match(fabSource, /portfolio-assistant-transcript/);
  assert.match(cssSource, /\.portfolio-assistant-transcript\s*\{[\s\S]*?overflow-y:\s*auto;/);
  assert.match(
    cssSource,
    /\.portfolio-assistant\s*\{[\s\S]*?--assistant-composer-min-block-size:\s*4\.75rem;/,
  );
  assert.match(
    cssSource,
    /\.portfolio-assistant-composer\s*\{[\s\S]*?min-block-size:\s*var\(--assistant-composer-min-block-size\);/,
  );
  assert.match(
    cssSource,
    /\.portfolio-assistant-composer textarea\s*\{[\s\S]*?max-block-size:\s*8rem;/,
  );
  assert.match(fabSource, /useLayoutEffect/);
  assert.match(fabSource, /composerTextareaRef/);
  assert.match(fabSource, /textarea\.style\.blockSize = "auto";/);
  assert.match(fabSource, /textarea\.style\.overflowY/);
  assert.match(cssSource, /\.portfolio-assistant-composer textarea\s*\{[\s\S]*?resize:\s*none;/);
  assert.doesNotMatch(cssSource, /\.portfolio-assistant-composer\s*\{[\s\S]*?position:\s*sticky;/);
});

test("submits on Enter while preserving Shift+Enter for new lines", async () => {
  const fabSource = await readFile(fabPath, "utf8");

  assert.match(fabSource, /handleComposerKeyDown/);
  assert.match(fabSource, /event\.key !== "Enter"/);
  assert.match(fabSource, /event\.shiftKey/);
  assert.match(fabSource, /event\.nativeEvent\.isComposing/);
  assert.match(fabSource, /event\.currentTarget\.form\?\.requestSubmit\(\)/);
  assert.match(fabSource, /onKeyDown=\{handleComposerKeyDown\}/);
  assert.match(fabSource, /aria-keyshortcuts="Enter Shift\+Enter"/);
  assert.match(fabSource, /aria-describedby="portfolio-assistant-message-hint"/);
  assert.match(fabSource, /Enter to send/);
  assert.match(fabSource, /Shift\+Enter for a new line/);
});
