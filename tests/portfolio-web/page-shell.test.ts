import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";

const stylesRoot = resolve(import.meta.dirname, "../../apps/portfolio-web/src/styles");

test("keeps the page shell within the dynamic viewport with a shared bottom gap", async () => {
  const [base, primitives] = await Promise.all([
    readFile(resolve(stylesRoot, "base.css"), "utf8"),
    readFile(resolve(stylesRoot, "primitives.css"), "utf8"),
  ]);

  assert.match(base, /body\s*\{[\s\S]*?min-height:\s*100vh;[\s\S]*?min-height:\s*100dvh;/);
  assert.match(base, /#root\s*\{[\s\S]*?min-height:\s*100vh;[\s\S]*?min-height:\s*100dvh;/);
  assert.match(
    primitives,
    /\.app-shell\s*\{[\s\S]*?min-height:\s*100dvh;[\s\S]*?padding-bottom:\s*max\(\s*clamp\(1\.5rem,\s*3vh,\s*2\.5rem\),\s*env\(safe-area-inset-bottom,\s*0px\)\s*\);/,
  );
});
