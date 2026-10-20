import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import PointerCoordinates from "../../apps/portfolio-web/src/components/pointerCoordinates/PointerCoordinates";

const componentPath = resolve(
  import.meta.dirname,
  "../../apps/portfolio-web/src/components/pointerCoordinates/PointerCoordinates.tsx",
);
const stylesRoot = resolve(import.meta.dirname, "../../apps/portfolio-web/src/styles");

test("keeps the signal status independently clickable in the compact rail", async () => {
  const [markup, source, railStyles, motionStyles, responsiveStyles] = await Promise.all([
    Promise.resolve(renderToStaticMarkup(createElement(PointerCoordinates))),
    readFile(componentPath, "utf8"),
    readFile(resolve(stylesRoot, "coordinate-rail.css"), "utf8"),
    readFile(resolve(stylesRoot, "motion.css"), "utf8"),
    readFile(resolve(stylesRoot, "responsive.css"), "utf8"),
  ]);
  const statusControl = markup.match(
    /<button[^>]*class="coordinate-rail-status"[^>]*>SYS-OP-24<\/button>/,
  )?.[0];

  assert.ok(statusControl, "status text must render as its own button");
  assert.match(statusControl, /aria-label="Run signal handshake"/);
  assert.match(statusControl, /data-cursor="help"/);
  assert.match(statusControl, /data-handshake-state="idle"/);
  assert.match(statusControl, /title="Run signal handshake"/);

  const statusSourceStart = source.indexOf('className="coordinate-rail-status"');
  const statusSourceEnd = source.indexOf("</button>", statusSourceStart);
  assert.ok(statusSourceStart >= 0 && statusSourceEnd > statusSourceStart);
  assert.match(source.slice(statusSourceStart, statusSourceEnd), /onClick=\{completeHandshake\}/);
  assert.match(
    markup,
    /<div class="coordinate-rail-frame" data-handshake-state="idle" data-pointer-surface="page">/,
  );
  assert.match(source, /const railFrameRef = useRef<HTMLDivElement>\(null\);/);
  assert.match(source, /const railFrame = railFrameRef\.current;/);
  assert.match(source, /railFrame\.style\.setProperty\("--coordinate-pointer-x"/);
  assert.match(
    source,
    /"coordinate-rail-frame",[\s\S]*?pointerSignalPosition \? "has-pointer" : ""/,
  );
  assert.match(railStyles, /\.coordinate-rail-frame\.has-pointer::after\s*\{/);
  assert.doesNotMatch(railStyles, /\.coordinate-rail\.has-pointer::after\s*\{/);
  assert.match(
    motionStyles,
    /\.coordinate-rail-frame\[data-handshake-state="complete"\]::after\s*\{/,
  );
  assert.match(responsiveStyles, /\.coordinate-rail-frame\.has-pointer::after\s*\{/);
});
