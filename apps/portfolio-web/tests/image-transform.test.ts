import assert from "node:assert/strict";
import { test } from "node:test";

import { isTransformable, resizeImage } from "../src/data/imageTransform";

/**
 * The transform helper is the only place that decides whether a URL may be sent to
 * the image service. Its contract is deliberately split in two: a transformable URL
 * yields a transformed URL, and anything else yields `null` — never the input — so
 * callers can gate their image attributes on whether a transform happened.
 */

const MEDIA = "https://personal-portfolio-bucket.syn-forge.com/Projects/shot.png";

test("builds a resized, format-negotiated URL for a media object", () => {
  assert.equal(
    resizeImage(MEDIA, 1360),
    "https://personal-portfolio-bucket.syn-forge.com/cdn-cgi/image/width=1360,format=auto,quality=78/Projects/shot.png",
  );
});

test("normalises shape when a height and fit are supplied", () => {
  assert.equal(
    resizeImage(MEDIA, 768, undefined, { height: 569, fit: "pad", background: "transparent" }),
    "https://personal-portfolio-bucket.syn-forge.com/cdn-cgi/image/width=768,height=569,fit=pad,background=transparent,format=auto,quality=78/Projects/shot.png",
  );
  assert.equal(
    resizeImage(MEDIA, 768, undefined, { height: 569, fit: "crop" }),
    "https://personal-portfolio-bucket.syn-forge.com/cdn-cgi/image/width=768,height=569,fit=crop,format=auto,quality=78/Projects/shot.png",
    "no background option means no background parameter",
  );
  // The service's default fit is `scale`, which would use both dimensions and distort
  // the image; a height with no explicit fit is therefore dropped rather than applied.
  assert.equal(
    resizeImage(MEDIA, 768, undefined, { height: 569 }),
    "https://personal-portfolio-bucket.syn-forge.com/cdn-cgi/image/width=768,format=auto,quality=78/Projects/shot.png",
  );
});

test("defaults the quality to 78 and honours an override", () => {
  assert.match(resizeImage(MEDIA, 360) ?? "", /quality=78/);
  assert.match(resizeImage(MEDIA, 360, 55) ?? "", /quality=55/);
});

test("refuses a foreign host, including a look-alike prefix", () => {
  assert.equal(resizeImage("https://placehold.co/600x400/EEE/999", 540), null);
  assert.equal(
    resizeImage("https://personal-portfolio-bucket.syn-forge.com.evil.test/x.png", 540),
    null,
    "a prefix comparison would accept this host",
  );
});

test("the predicate agrees with the builder for query and fragment URLs", () => {
  assert.equal(isTransformable(`${MEDIA}?v=3`), false);
  assert.equal(isTransformable(`${MEDIA}#frag`), false);
});

test("refuses a relative path, a data URI and a non-https URL", () => {
  assert.equal(resizeImage("/preview.png", 540), null);
  assert.equal(resizeImage("data:image/png;base64,AAAA", 540), null);
  assert.equal(isTransformable("http://personal-portfolio-bucket.syn-forge.com/x.png"), false);
});

test("refuses a URL carrying a query or fragment", () => {
  assert.equal(
    resizeImage(`${MEDIA}?v=3`, 540),
    null,
    "rebuilding the URL would drop the query and fetch different bytes",
  );
  assert.equal(resizeImage(`${MEDIA}#frag`, 540), null);
});

test("refuses an already-transformed URL instead of nesting it", () => {
  const once = resizeImage(MEDIA, 540);
  assert.ok(once);
  assert.equal(resizeImage(once, 810), null, "a second transform would nest /cdn-cgi/image/");
});

test("reports transformability without building anything", () => {
  assert.equal(isTransformable(MEDIA), true);
  assert.equal(isTransformable("https://example.test/p.webp"), false);
  assert.equal(isTransformable(""), false);
});
