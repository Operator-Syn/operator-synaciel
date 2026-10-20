import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";

const aiPagePath = resolve(
  import.meta.dirname,
  "../../apps/portfolio-web/src/components/pages/aiPage/Ai.tsx",
);
const aiStylesPath = resolve(
  import.meta.dirname,
  "../../apps/portfolio-web/src/components/pages/aiPage/Ai.css",
);
const pointerCoordinatesPath = resolve(
  import.meta.dirname,
  "../../apps/portfolio-web/src/components/pointerCoordinates/PointerCoordinates.tsx",
);
const floatingControlsDockPath = resolve(
  import.meta.dirname,
  "../../apps/portfolio-web/src/components/floatingControls/FloatingControlsDock.tsx",
);

test("places AI utility controls in the shared coordinate rail", async () => {
  const [aiPage, aiStyles, pointerCoordinates, floatingControlsDock] = await Promise.all([
    readFile(aiPagePath, "utf8"),
    readFile(aiStylesPath, "utf8"),
    readFile(pointerCoordinatesPath, "utf8"),
    readFile(floatingControlsDockPath, "utf8"),
  ]);

  assert.match(
    aiPage,
    /import PointerCoordinates from "..\/..\/pointerCoordinates\/PointerCoordinates";/,
  );
  assert.match(
    aiPage,
    /<main aria-labelledby="ai-page-title" className="ai-page">\s*<PointerCoordinates className="ai-page-coordinates" markerCount=\{0\} \/>\s*<header className="ai-page-hero">/,
  );
  assert.match(
    aiStyles,
    /\.ai-page-coordinates\s*\{[\s\S]*?border-bottom:\s*1px solid var\(--color-line\);/,
  );
  assert.match(pointerCoordinates, /data-coordinate-rail-controls/);
  assert.match(floatingControlsDock, /railControls \?\? document\.body/);
});

test("keeps the AI hero balanced with natural title wrapping", async () => {
  const aiStyles = await readFile(aiStylesPath, "utf8");
  const heroStyles = aiStyles.match(/\.ai-page-hero\s*\{([\s\S]*?)\n\}/)?.[1];
  const markStyles = aiStyles.match(/\.ai-page-hero-mark\s*\{([\s\S]*?)\n\}/)?.[1];

  assert.ok(heroStyles);
  assert.ok(markStyles);
  assert.match(
    heroStyles,
    /grid-template-columns:\s*minmax\(0,\s*1\.2fr\)\s+minmax\(18rem,\s*0\.8fr\);/,
  );
  assert.match(heroStyles, /align-items:\s*center;/);
  assert.match(heroStyles, /padding:\s*clamp\(2\.5rem,\s*5vw,\s*4\.5rem\)/);
  assert.match(aiStyles, /\.ai-page-hero h1\s*\{[\s\S]*?max-width:\s*none;/);
  assert.match(aiStyles, /\.ai-page-hero h1\s*\{[\s\S]*?text-wrap:\s*pretty;/);
  assert.match(aiStyles, /\.ai-page-panel h2\s*\{/);
  assert.doesNotMatch(aiStyles, /(?:^|\n)\.ai-page\s+(?:h[1-6]|p)(?:\s*,|\s*\{)/);
  assert.match(markStyles, /display:\s*grid;/);
  assert.match(markStyles, /width:\s*min\(100%, 26rem\);/);
  assert.match(markStyles, /min-height:\s*14rem;/);
  assert.match(markStyles, /align-content:\s*center;/);
  assert.match(markStyles, /justify-self:\s*center;/);
  assert.match(
    aiStyles,
    /@media \(max-width: 860px\)[\s\S]*?\.ai-page-hero-mark\s*\{[\s\S]*?width:\s*min\(100%, 26rem\);/,
  );
  assert.match(
    aiStyles,
    /@media \(max-width: 700px\)[\s\S]*?\.ai-page-hero-mark\s*\{[\s\S]*?width:\s*min\(100%, 22rem\);/,
  );
});
