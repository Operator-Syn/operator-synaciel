import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";

const appRoot = resolve(import.meta.dirname, "..");
const fontsCssPath = resolve(appRoot, "src/styles/fonts.css");

/**
 * The font faces are the one place where a wrong hint silently costs the site its
 * typography: a browser that does not understand the declared format skips the
 * source and falls back, with no error anywhere. These assertions pin the form.
 */

test("every face declares a plain woff2 source", async () => {
  const css = await readFile(fontsCssPath, "utf8");

  const faces = css.match(/@font-face\s*\{[^}]*\}/g) ?? [];
  assert.equal(faces.length, 5, "five faces: Plex Sans variable, three Mono weights, Newsreader");

  for (const face of faces) {
    assert.match(face, /src:\s*url\("\/fonts\/[a-z0-9-]+\.woff2"\)\s*format\("woff2"\)/);
    // The legacy `woff2-variations` hint is not universally understood, and a face
    // whose only source uses it has no usable source in those engines.
    assert.doesNotMatch(face, /woff2-variations/);
  }
});

test("declares the variable weight range and the static weights", async () => {
  const css = await readFile(fontsCssPath, "utf8");

  assert.match(css, /font-family:\s*"IBM Plex Sans";[\s\S]*?font-weight:\s*100 700;/);
  assert.match(css, /font-family:\s*"Newsreader";[\s\S]*?font-weight:\s*400;/);
  for (const weight of ["400", "500", "600"]) {
    assert.match(
      css,
      new RegExp(`font-family: "IBM Plex Mono";[\\s\\S]*?font-weight: ${weight};`),
      `Mono ${weight} is declared`,
    );
  }
});

test("uses swap so text is never invisible while the face loads", async () => {
  const css = await readFile(fontsCssPath, "utf8");
  const faces = css.match(/@font-face\s*\{[^}]*\}/g) ?? [];

  for (const face of faces) {
    assert.match(face, /font-display:\s*swap;/);
  }
});
