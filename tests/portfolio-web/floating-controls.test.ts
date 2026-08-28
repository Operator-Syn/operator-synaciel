import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";

const repositoryRoot = resolve(import.meta.dirname, "../../apps/portfolio-web");

test("anchors fixed visitor controls to one safe-area-aware edge", async () => {
  const [tokens, homeStyles, quickStyles, quickComponent] = await Promise.all([
    readFile(resolve(repositoryRoot, "src/styles/tokens.css"), "utf8"),
    readFile(resolve(repositoryRoot, "src/styles/home-settings.css"), "utf8"),
    readFile(resolve(repositoryRoot, "src/styles/quick-navigation.css"), "utf8"),
    readFile(resolve(repositoryRoot, "src/components/quickNavigation/QuickNavigation.tsx"), "utf8"),
  ]);

  assert.match(tokens, /--floating-control-edge-space:\s*clamp\(1rem,\s*2vw,\s*2rem\);/);
  assert.match(
    tokens,
    /--floating-control-inline-end:\s*max\([\s\S]*?var\(--floating-control-edge-space\)/,
  );
  assert.match(
    tokens,
    /--floating-control-block-end:\s*max\([\s\S]*?var\(--floating-control-edge-space\)/,
  );

  for (const styles of [homeStyles, quickStyles]) {
    assert.match(styles, /inset-inline-end:\s*var\(--floating-control-inline-end\);/);
    assert.match(styles, /inset-block-end:\s*var\(--floating-control-block-end\);/);
  }

  assert.match(homeStyles, /.home-settings\s*\{[\s\S]*?position:\s*fixed/);
  assert.doesNotMatch(homeStyles, /(?:^|\n)\s*(?:right|bottom):\s*max\(/);
  assert.doesNotMatch(quickStyles, /--quick-navigation-(?:edge|inline|block)-space/);
  assert.doesNotMatch(quickComponent, /(?:bottom-5|right-5|sm:bottom-8|sm:right-8)/);
});
