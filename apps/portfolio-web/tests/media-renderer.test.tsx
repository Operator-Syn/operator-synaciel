import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import MediaRenderer from "../src/components/mediaRenderer/MediaRenderer";

/**
 * MediaRenderer is where a media URL becomes an element. These cases pin the rule the
 * plan turns on: every image attribute is gated on a transform having actually
 * happened, and the video branch never consults the image descriptor at all.
 */

const MEDIA = "https://personal-portfolio-bucket.syn-forge.com/Projects/shot.png";

const image = {
  transformWidth: 1360,
  width: 540,
  height: 200,
  loading: "lazy" as const,
};

function render(props: Parameters<typeof MediaRenderer>[0]) {
  return renderToStaticMarkup(<MediaRenderer {...props} />);
}

test("renders a media-host image through the transform", () => {
  const markup = render({ type: "image", url: MEDIA, alt: "Screenshot", image });

  assert.match(
    markup,
    /src="https:\/\/personal-portfolio-bucket\.syn-forge\.com\/cdn-cgi\/image\/width=1360,format=auto,quality=78\/Projects\/shot\.png"/,
  );
  assert.match(markup, /width="540"/);
  assert.match(markup, /height="200"/);
  assert.match(markup, /loading="lazy"/);
});

test("normalises an image when the descriptor carries a shape", () => {
  const markup = render({
    type: "image",
    url: MEDIA,
    alt: "Certification",
    image: {
      transformWidth: 768,
      transformHeight: 569,
      fit: "pad",
      background: "transparent",
      width: 768,
      height: 569,
      loading: "lazy",
    },
  });

  const imgSrc = /<img[^>]* src="([^"]+)"/.exec(markup)?.[1];
  assert.equal(
    imgSrc,
    "https://personal-portfolio-bucket.syn-forge.com/cdn-cgi/image/width=768,height=569,fit=pad,background=transparent,format=auto,quality=78/Projects/shot.png",
  );
  assert.match(markup, /width="768"/);
  assert.match(markup, /height="569"/);
});

test("leaves a foreign URL exactly as it would render without a descriptor", () => {
  const withDescriptor = render({
    type: "image",
    url: "https://placehold.co/600x400/EEE/999?text=Soon",
    alt: "Still cooking",
    image,
  });
  const withoutDescriptor = render({
    type: "image",
    url: "https://placehold.co/600x400/EEE/999?text=Soon",
    alt: "Still cooking",
  });

  assert.doesNotMatch(withDescriptor, /cdn-cgi\/image/);
  assert.doesNotMatch(withDescriptor, /width="540"/);
  assert.doesNotMatch(withDescriptor, /loading="lazy"/);
  assert.equal(withDescriptor, withoutDescriptor, "a non-transformable URL is byte-identical");
});

test("leaves a relative path and an already-transformed URL alone", () => {
  for (const url of ["/preview.png", "data:image/png;base64,AAAA"]) {
    const markup = render({ type: "image", url, alt: "Preview", image });
    assert.doesNotMatch(markup, /cdn-cgi\/image/);
  }

  const transformed = MEDIA.replace(
    "/Projects/",
    "/cdn-cgi/image/width=540,format=auto,quality=78/Projects/",
  );
  const markup = render({ type: "image", url: transformed, alt: "Preview", image });
  // React also emits a `<link rel="preload" as="image">` for the same URL, so the
  // element's own attribute is what proves the URL was not wrapped twice.
  const imgSrc = /<img[^>]* src="([^"]+)"/.exec(markup)?.[1];
  assert.equal(imgSrc, transformed);
});

test("never applies the image descriptor to a video", () => {
  const markup = render({
    type: "video",
    url: "https://personal-portfolio-bucket.syn-forge.com/Projects/clip.mp4",
    alt: "Project walkthrough",
    image,
  });

  assert.match(
    markup,
    /<source src="https:\/\/personal-portfolio-bucket\.syn-forge\.com\/Projects\/clip\.mp4"\/>/,
  );
  assert.doesNotMatch(markup, /cdn-cgi\/image/);
  assert.doesNotMatch(markup, /width="540"/);
  assert.doesNotMatch(markup, /<img/);
});

test("renders an image with no descriptor at all", () => {
  const markup = render({ type: "image", url: MEDIA, alt: "Screenshot" });

  assert.match(
    markup,
    /src="https:\/\/personal-portfolio-bucket\.syn-forge\.com\/Projects\/shot\.png"/,
  );
  assert.doesNotMatch(markup, /cdn-cgi\/image/);
  assert.doesNotMatch(markup, /width="540"/);
});
