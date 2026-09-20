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
  assert.match(source, /A portfolio of projects, experiments, and the thinking behind them/);
  assert.doesNotMatch(source, /sections\/\$\{section\.id\}\/items/);
  assert.doesNotMatch(source, /useQueries/);
});

test("homepage shell exposes a main landmark and lazy route boundary", async () => {
  const source = await readFile(resolve(appRoot, "src/App.tsx"), "utf8");

  assert.match(source, /<main className="app-shell">/);
  assert.match(source, /<Suspense fallback=/);
  assert.match(source, /<PortfolioAssistantFab \/>/);
});
