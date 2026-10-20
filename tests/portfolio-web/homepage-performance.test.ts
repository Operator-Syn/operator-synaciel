import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";

const appRoot = resolve(import.meta.dirname, "../../apps/portfolio-web");

test("homepage uses one aggregate request and keeps critical fallback content", async () => {
  const source = await readFile(resolve(appRoot, "src/components/pages/homePage/Home.tsx"), "utf8");

  assert.match(source, /useQuery/);
  assert.match(source, /fetch\(\x60\$\{apiUrl\}\/home\x60\)/);
  assert.match(source, /HOMEPAGE_STALE_TIME_MS/);
  assert.match(source, /retry: false/);
  assert.match(source, /HERO_BODY_FALLBACK/);
  assert.match(source, /LoadingBlock/);
  assert.match(source, /homepage-hero-title-placeholder/);
  assert.match(source, /homepage-hero-body-placeholder/);
  assert.doesNotMatch(source, /sections\/\$\{section\.id\}\/items/);
  assert.doesNotMatch(source, /useQueries/);
});

test("keeps one route-level main landmark under the app shell", async () => {
  const routeLandmarkPaths = [
    "src/components/pages/homePage/Home.tsx",
    "src/components/pages/aiPage/Ai.tsx",
    "src/components/pages/projectsPage/Projects.tsx",
    "src/components/pages/certificatesPage/Certificates.tsx",
    "src/components/pages/snippetsPage/Snippets.tsx",
    "src/components/pages/snippetsPage/SnippetDocument.tsx",
    "src/components/pages/privacyPolicyPage/PrivacyPolicy.tsx",
    "src/components/pages/termsAndConditionsPage/TermsAndConditions.tsx",
    "src/components/pages/staticAppPage/StaticAppPage.tsx",
    "src/components/pages/notFoundPage/NotFound.tsx",
  ];
  const [appSource, ...routeSources] = await Promise.all([
    readFile(resolve(appRoot, "src/App.tsx"), "utf8"),
    ...routeLandmarkPaths.map((path) => readFile(resolve(appRoot, path), "utf8")),
  ]);

  assert.match(appSource, /<div className="app-shell">/);
  assert.match(appSource, /<main aria-label="Loading page">/);
  assert.doesNotMatch(appSource, /<main className="app-shell">/);
  assert.match(appSource, /<Suspense fallback=/);
  assert.match(appSource, /<PortfolioAssistantFab \/>/);

  routeSources.forEach((source, index) => {
    assert.equal(
      (source.match(/<main(?:\s|>)/g) ?? []).length,
      1,
      `${routeLandmarkPaths[index]} should own exactly one main landmark`,
    );
    assert.equal(
      (source.match(/<\/main>/g) ?? []).length,
      1,
      `${routeLandmarkPaths[index]} should close exactly one main landmark`,
    );
  });
});
