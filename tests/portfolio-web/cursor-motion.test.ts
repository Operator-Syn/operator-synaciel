import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";

const repositoryRoot = resolve(import.meta.dirname, "../../apps/portfolio-web");

test("keeps static custom cursors available when motion is reduced", async () => {
  const styles = await readFile(resolve(repositoryRoot, "src/styles/cursors.css"), "utf8");

  assert.match(styles, /@media \(hover: hover\) and \(pointer: fine\)\s*\{/);
  assert.doesNotMatch(styles, /pointer: fine\) and \(prefers-reduced-motion: no-preference\)/);
  assert.doesNotMatch(styles, /html\[data-reduced-motion="on"\][\s\S]*cursor:\s*auto;/);
  assert.match(styles, /url\("\/cursors\/operator-default\.svg"\)/);
  assert.match(styles, /url\("\/cursors\/operator-activate\.svg"\)/);
});
