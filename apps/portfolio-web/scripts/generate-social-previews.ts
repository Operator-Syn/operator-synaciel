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
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&family=Newsreader:opsz,wght@6..72,400..700&display=swap" />',
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
