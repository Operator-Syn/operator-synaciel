import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";

const repositoryRoot = resolve(import.meta.dirname, "..");
const tokenStylesPath = resolve(repositoryRoot, "src/styles/tokens.css");
const quickNavigationStylesPath = resolve(repositoryRoot, "src/styles/quick-navigation.css");
const paginationStylesPaths = [
  resolve(repositoryRoot, "src/styles/certificate-archive.css"),
  resolve(repositoryRoot, "src/styles/project-archive.css"),
];

test("reserves fixed-navigation clearance around archive pagination", async () => {
  const [tokenStyles, quickNavigationStyles, ...paginationStyles] = await Promise.all([
    readFile(tokenStylesPath, "utf8"),
    readFile(quickNavigationStylesPath, "utf8"),
    ...paginationStylesPaths.map((path) => readFile(path, "utf8")),
  ]);

  assert.match(tokenStyles, /--floating-navigation-clearance:\s*clamp\(5rem,\s*6vw,\s*7rem\);/);
  assert.match(quickNavigationStyles, /\.quick-navigation\s*\{[\s\S]*?pointer-events:\s*none;/);
  assert.match(
    quickNavigationStyles,
    /\.quick-navigation-panel\[data-state="open"\]\s*\{[\s\S]*?pointer-events:\s*auto;/,
  );
  assert.match(
    quickNavigationStyles,
    /\.quick-navigation-toggle\s*\{[\s\S]*?pointer-events:\s*auto;/,
  );

  for (const styles of paginationStyles) {
    assert.match(
      styles,
      /\.(?:certificate-pagination|project-archive-pagination)\s*\{[\s\S]*?padding-inline-end:\s*var\(--floating-navigation-clearance\);/,
    );
  }
});
