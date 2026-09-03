import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";

const repositoryRoot = resolve(import.meta.dirname, "../../");
const fabPath = resolve(
  repositoryRoot,
  "apps/portfolio-web/src/components/portfolioAssistant/PortfolioAssistantFab.tsx",
);
const modalPath = resolve(repositoryRoot, "apps/portfolio-web/src/components/modal/Modal.tsx");
const modalStylesPath = resolve(repositoryRoot, "apps/portfolio-web/src/styles/modal.css");

test("uses a reusable accessible modal instead of native browser confirmation", async () => {
  const [fabSource, modalSource, modalStyles] = await Promise.all([
    readFile(fabPath, "utf8"),
    readFile(modalPath, "utf8"),
    readFile(modalStylesPath, "utf8"),
  ]);

  assert.doesNotMatch(fabSource, /window\.confirm\(/);
  assert.match(fabSource, /<Modal[\s\S]*role="alertdialog"/);
  assert.match(modalSource, /createPortal/);
  assert.match(modalSource, /aria-modal="true"/);
  assert.match(modalSource, /event\.key === "Escape"/);
  assert.match(modalSource, /event\.key (?:!==|===) "Tab"/);
  assert.match(modalSource, /dialogRef\.current\?\.contains\(document\.activeElement\)/);
  assert.match(modalSource, /returnFocusRef/);
  assert.match(modalStyles, /position:\s*fixed/);
  assert.match(modalStyles, /z-index:\s*60/);
  assert.match(modalStyles, /background:\s*var\(--color-canvas-overlay/);
});

test("gives the assistant conversation a clear bubble hierarchy and opaque sticky layers", async () => {
  const [cssSource, fabSource] = await Promise.all([
    readFile(
      resolve(
        repositoryRoot,
        "apps/portfolio-web/src/components/portfolioAssistant/PortfolioAssistant.css",
      ),
      "utf8",
    ),
    readFile(
      resolve(
        repositoryRoot,
        "apps/portfolio-web/src/components/portfolioAssistant/PortfolioAssistantFab.tsx",
      ),
      "utf8",
    ),
  ]);

  assert.match(cssSource, /\.portfolio-assistant-toolbar\s*\{[\s\S]*?isolation:\s*isolate;/);
  assert.match(cssSource, /\.portfolio-assistant-message\.user\s*\{[\s\S]*?justify-self:\s*end;/);
  assert.match(
    cssSource,
    /\.portfolio-assistant-message\.assistant\s*\{[\s\S]*?justify-self:\s*start;/,
  );
  assert.match(
    cssSource,
    /\.portfolio-assistant-composer\s*\{[\s\S]*?background:\s*var\(--color-surface/,
  );
  assert.match(cssSource, /\.portfolio-assistant-session\s*\{[\s\S]*?flex:\s*1 1 auto;/);
  assert.match(cssSource, /\.portfolio-assistant-transcript\s*\{[\s\S]*?overflow-y:\s*auto;/);
  assert.match(
    cssSource,
    /\.portfolio-assistant-composer\s*\{[\s\S]*?min-block-size:\s*var\(--assistant-composer-min-block-size\);/,
  );
  assert.match(fabSource, /data-assistant-mode=\{isExpanded \? "expanded" : "compact"\}/);
  assert.match(fabSource, /ASSISTANT_FOCUSABLE_SELECTOR/);
  assert.match(fabSource, /document\.body\.style\.overflow = "hidden"/);
  assert.match(fabSource, /documentElement\.style\.overflow = "hidden"/);
  assert.match(fabSource, /documentElement\.style\.scrollbarGutter = "auto"/);
  assert.match(cssSource, /\.portfolio-assistant-expanded-backdrop/);
  assert.match(cssSource, /inset-block:/);
  assert.match(
    cssSource,
    /\.portfolio-assistant\[data-assistant-mode="expanded"\][\s\S]*?inset-inline:\s*max\(/,
  );
  assert.match(
    cssSource,
    /\.portfolio-assistant\[data-assistant-mode="expanded"\][\s\S]*?width:\s*auto;/,
  );
  assert.match(
    cssSource,
    /\.portfolio-assistant\[data-assistant-mode="expanded"\][\s\S]*?padding-bottom:\s*max\(2rem/,
  );
  assert.match(cssSource, /\.portfolio-assistant-toolbar\s*\{[\s\S]*?position:\s*relative;/);
});

test("keeps history readable during reconnects and follows new activity only when appropriate", async () => {
  const fabSource = await readFile(fabPath, "utf8");

  assert.match(fabSource, /data-chat-state=/);
  assert.match(fabSource, /shouldFollowTranscriptRef/);
  assert.match(fabSource, /ASSISTANT_SCROLL_BOTTOM_THRESHOLD_PX = 64/);
  assert.match(fabSource, /const movedUp = previousScrollTop !== null/);
  assert.match(
    fabSource,
    /const nextTop = Math\.max\(0, transcript\.scrollHeight - transcript\.clientHeight\)/,
  );
  assert.match(fabSource, /Jump to latest assistant response/);
  assert.doesNotMatch(fabSource, /latest\.scrollIntoView\(/);
  assert.match(
    fabSource,
    /useLayoutEffect\(\(\) => \{[\s\S]*?pendingHistoryAnchorRef\.current[\s\S]*?const nextTop = Math\.max\(/,
  );
  assert.match(fabSource, /pendingHistoryAnchorRef = useRef/);
  assert.doesNotMatch(
    fabSource,
    /window\.requestAnimationFrame\(\(\) => \{[\s\S]*?transcript\.scrollTop/,
  );
  assert.match(fabSource, /Reconnecting to the archive/);
});
