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

test("keeps the signal status independently clickable in the compact rail", async () => {
  const [markup, source] = await Promise.all([
    Promise.resolve(renderToStaticMarkup(createElement(PointerCoordinates))),
    readFile(componentPath, "utf8"),
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
});
