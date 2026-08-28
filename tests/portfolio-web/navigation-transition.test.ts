import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";

const repositoryRoot = resolve(import.meta.dirname, "../../apps/portfolio-web");
const transitionBoundaryPath = resolve(
  repositoryRoot,
  "src/components/pageTransition/PageTransition.tsx",
);
const internalRouteSurfaces = [
  "src/components/navBar/NavBar.tsx",
  "src/components/quickNavigation/QuickNavigation.tsx",
  "src/components/pages/homePage/Home.tsx",
  "src/components/homePage/HomeSelectedWork.tsx",
  "src/components/headerComponent/HeaderComponent.tsx",
  "src/components/pages/snippetsPage/Snippets.tsx",
  "src/components/pages/snippetsPage/SnippetDocument.tsx",
  "src/components/pages/staticAppPage/StaticAppPage.tsx",
];

test("uses explicit transition links for internal route surfaces", async () => {
  const sources = await Promise.all(
    internalRouteSurfaces.map(async (relativePath) => ({
      relativePath,
      source: await readFile(resolve(repositoryRoot, relativePath), "utf8"),
    })),
  );

  for (const { relativePath, source } of sources) {
    assert.doesNotMatch(
      source,
      /import\s+\{[^}]*\b(?:Link|NavLink)\b[^}]*\}\s+from\s+"react-router-dom"/s,
      relativePath,
    );
    assert.doesNotMatch(source, /<(?:Link|NavLink)(?:\s|>)/, relativePath);
    assert.match(source, /<Transition(?:Nav)?Link(?:\s|>)/, relativePath);
  }
});

test("hard-navigates the static llms.txt asset outside SPA transitions", async () => {
  const [aiPage, transitionBoundary] = await Promise.all([
    readFile(resolve(repositoryRoot, "src/components/pages/aiPage/Ai.tsx"), "utf8"),
    readFile(transitionBoundaryPath, "utf8"),
  ]);

  assert.match(
    aiPage,
    /<a\s+className="ai-page-button ai-page-button-secondary"\s+href="\/llms\.txt"\s+data-transition-preserve-state="true"\s*>/,
  );
  assert.match(transitionBoundary, /anchor\.dataset\.transitionPreserveState !== "true"/);
});
