import { mkdir } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { chromium } from "playwright";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SocialPreviewCard } from "../src/components/socialPreview/SocialPreviewCard.tsx";
import {
  getSocialPreviewImagePath,
  getSocialPreviewMetadata,
  SOCIAL_PREVIEW_COLORS,
  SOCIAL_PREVIEW_HEIGHT,
  SOCIAL_PREVIEW_ROUTES,
  SOCIAL_PREVIEW_WIDTH,
} from "../src/data/socialPreview.ts";

const repositoryRoot = resolve(import.meta.dirname, "..");

function getOutputPath(pathname: string) {
  return resolve(repositoryRoot, "public", pathname.replace(/^\/+/, ""));
}

function buildCaptureDocument(markup: string) {
  const captureStyle = `html, body {
    margin: 0;
    padding: 0;
    width: ${SOCIAL_PREVIEW_WIDTH}px;
    height: ${SOCIAL_PREVIEW_HEIGHT}px;
    overflow: hidden;
    background: ${SOCIAL_PREVIEW_COLORS.canvas};
  }`;

  return [
    "<!doctype html>",
    '<html lang="en"><head><meta charset="UTF-8" />',
    '<meta name="viewport" content="width=1200, initial-scale=1.0" />',
    '<link rel="preconnect" href="https://fonts.googleapis.com" />',
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />',
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&family=Newsreader:opsz,wght@6..72,400&display=swap" />',
    `<style>${captureStyle}</style>`,
    "</head><body>",
    markup,
    "</body></html>",
  ].join("");
}

function formatGenerationError(error: unknown) {
  if (error instanceof Error && error.message.includes("Executable doesn't exist")) {
    return [
      "Chromium is not installed for Playwright.",
      'Run "npx playwright install chromium" once, then retry the generator.',
      error.message,
    ].join("\n");
  }

  return error instanceof Error ? (error.stack ?? error.message) : String(error);
}

/**
 * Fail the generation when the card content no longer fits its 1200x630 frame.
 *
 * Titles and descriptions come from the metadata map, so a copy change can
 * silently overflow the layout. The card clips with `overflow: hidden`, which
 * means an over-long title does not raise an error, it just gets cut off — the
 * failure this check exists to catch. A pure `scrollHeight` comparison is not
 * enough: the flex column shrinks instead of overflowing, so the boxes are
 * measured against the footer's top edge instead.
 */
async function assertCardFits(page: import("playwright").Page, pathname: string) {
  // The callback is a string: esbuild's `tsx` transform injects a `__name`
  // helper into function expressions, which `page.evaluate` then cannot resolve
  // in the browser context.
  const layout = (await page.evaluate(`(() => {
    const rect = (part) => {
      const element = document.querySelector('[data-card-part="' + part + '"]');
      if (!element) return null;
      const box = element.getBoundingClientRect();
      return {
        top: box.top,
        bottom: box.bottom,
        scrollHeight: element.scrollHeight,
        clientHeight: element.clientHeight,
      };
    };
    return {
      column: rect("column"),
      title: rect("title"),
      description: rect("description"),
      footer: rect("footer"),
    };
  })()`)) as {
    title: { top: number; bottom: number; scrollHeight: number; clientHeight: number } | null;
    column: { top: number; bottom: number; scrollHeight: number; clientHeight: number } | null;
    description: { top: number; bottom: number; scrollHeight: number; clientHeight: number } | null;
    footer: { top: number; bottom: number; scrollHeight: number; clientHeight: number } | null;
  };

  if (!layout.column || !layout.title || !layout.description || !layout.footer) {
    throw new Error(`Social preview card parts missing for ${pathname}.`);
  }

  // Sub-pixel line-height rounding reports a couple of pixels of "scroll"
  // height on a box that is fully painted; anything beyond that is real.
  const ROUNDING_TOLERANCE_PX = 4;
  const problems: string[] = [];
  if (layout.title.scrollHeight > layout.title.clientHeight + ROUNDING_TOLERANCE_PX) {
    problems.push(
      `title clipped (${layout.title.scrollHeight}px > ${layout.title.clientHeight}px)`,
    );
  }
  if (layout.description.scrollHeight > layout.description.clientHeight + ROUNDING_TOLERANCE_PX) {
    problems.push(
      `description clipped (${layout.description.scrollHeight}px > ${layout.description.clientHeight}px)`,
    );
  }
  if (layout.column.bottom > layout.footer.top + ROUNDING_TOLERANCE_PX) {
    problems.push(
      `column overlaps the footer (${Math.round(layout.column.bottom)}px > ${Math.round(layout.footer.top)}px)`,
    );
  }
  if (layout.title.bottom > layout.footer.top + ROUNDING_TOLERANCE_PX) {
    problems.push(
      `title overlaps the footer (${Math.round(layout.title.bottom)}px > ${Math.round(layout.footer.top)}px)`,
    );
  }
  if (layout.description.bottom > layout.footer.top + ROUNDING_TOLERANCE_PX) {
    problems.push(
      `description overlaps the footer (${Math.round(layout.description.bottom)}px > ${Math.round(layout.footer.top)}px)`,
    );
  }
  if (problems.length) {
    throw new Error(
      `Social preview card does not fit for ${pathname}: ${problems.join("; ")}. Shorten the title or description.`,
    );
  }
}

async function generateSocialPreviews() {
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
  const browser = await chromium.launch(executablePath ? { executablePath } : undefined);

  try {
    const page = await browser.newPage({
      viewport: {
        width: SOCIAL_PREVIEW_WIDTH,
        height: SOCIAL_PREVIEW_HEIGHT,
      },
      deviceScaleFactor: 1,
    });

    try {
      for (const route of SOCIAL_PREVIEW_ROUTES) {
        const metadata = getSocialPreviewMetadata(route.pathname);
        const markup = renderToStaticMarkup(createElement(SocialPreviewCard, { metadata }));
        await page.setContent(buildCaptureDocument(markup), { waitUntil: "load" });
        await page.evaluate("document.fonts.ready");
        await page.waitForFunction(() =>
          Array.from(document.images).every((image) => image.complete),
        );
        const imagesLoaded = await page.evaluate(() =>
          Array.from(document.images).every((image) => image.naturalWidth > 0),
        );
        if (!imagesLoaded) {
          throw new Error(`Social preview avatar failed to load for ${route.pathname}.`);
        }

        await assertCardFits(page, route.pathname);

        const outputPath = getOutputPath(getSocialPreviewImagePath(route.pathname));
        await mkdir(dirname(outputPath), { recursive: true });
        await page.screenshot({
          path: outputPath,
          type: "png",
          fullPage: false,
        });

        console.log(`Generated ${relative(repositoryRoot, outputPath)}`);
      }
    } finally {
      await page.close();
    }
  } finally {
    await browser.close();
  }
}

generateSocialPreviews().catch((error: unknown) => {
  console.error(formatGenerationError(error));
  process.exitCode = 1;
});
