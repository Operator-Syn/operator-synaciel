import { ImageResponse } from "@cloudflare/pages-plugin-vercel-og/api";
import type { PagesFunction, Response as PagesResponse } from "@cloudflare/workers-types";
import { type CSSProperties, createElement, type ReactNode } from "react";
import {
  getSocialPreviewImageUrl,
  getSocialPreviewMetadata,
  SOCIAL_PREVIEW_CACHE_CONTROL,
  SOCIAL_PREVIEW_COLORS,
  SOCIAL_PREVIEW_HEIGHT,
  SOCIAL_PREVIEW_IMAGE_SUFFIX,
  SOCIAL_PREVIEW_WIDTH,
} from "../src/data/socialPreview.ts";

const DISPLAY_FONT = "Newsreader, Georgia, serif";
const BODY_FONT = "IBM Plex Sans, Arial, sans-serif";
const MONO_FONT = "IBM Plex Mono, ui-monospace, monospace";

function box(style: CSSProperties, ...children: ReactNode[]) {
  return createElement("div", { style }, ...children);
}

function label(style: CSSProperties, value: string) {
  return createElement("span", { style }, value);
}

function renderSocialPreviewCard(metadata: ReturnType<typeof getSocialPreviewMetadata>) {
  const identityMark = box(
    {
      display: "flex",
      width: 178,
      height: 178,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: "50%",
      border: `1px solid ${SOCIAL_PREVIEW_COLORS.lineStrong}`,
      backgroundColor: SOCIAL_PREVIEW_COLORS.surface,
    },
    label(
      {
        color: SOCIAL_PREVIEW_COLORS.signal,
        fontFamily: DISPLAY_FONT,
        fontSize: 64,
        fontWeight: 400,
        letterSpacing: "-0.04em",
      },
      "JSB",
    ),
  );

  const portrait = box(
    {
      display: "flex",
      width: 208,
      height: 208,
      alignItems: "center",
      justifyContent: "center",
      border: `1px solid ${SOCIAL_PREVIEW_COLORS.lineStrong}`,
      position: "relative",
    },
    identityMark,
    box({
      position: "absolute",
      right: -8,
      bottom: -8,
      width: 16,
      height: 16,
      backgroundColor: SOCIAL_PREVIEW_COLORS.signal,
    }),
  );

  const header = box(
    {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      flexShrink: 0,
      padding: "22px 28px",
      borderBottom: `1px solid ${SOCIAL_PREVIEW_COLORS.line}`,
    },
    label(
      {
        color: SOCIAL_PREVIEW_COLORS.text,
        fontFamily: DISPLAY_FONT,
        fontSize: 28,
        fontWeight: 400,
      },
      "Operator-Syn",
    ),
    label(
      {
        color: SOCIAL_PREVIEW_COLORS.textFaint,
        fontFamily: MONO_FONT,
        fontSize: 16,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
      },
      metadata.pathname,
    ),
  );

  const main = box(
    {
      display: "flex",
      flex: 1,
      flexBasis: 0,
      gap: 46,
      height: 0,
      minHeight: 0,
      padding: "38px 44px 34px",
    },
    box(
      {
        display: "flex",
        flex: 1,
        flexDirection: "column",
        justifyContent: "center",
        minWidth: 0,
      },
      label(
        {
          color: SOCIAL_PREVIEW_COLORS.signal,
          fontFamily: MONO_FONT,
          fontSize: 17,
          fontWeight: 600,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
        },
        `Public archive / ${metadata.label}`,
      ),
      box(
        {
          display: "flex",
          maxWidth: 700,
          marginTop: 18,
          color: SOCIAL_PREVIEW_COLORS.text,
          fontFamily: DISPLAY_FONT,
          fontSize: 68,
          fontWeight: 400,
          letterSpacing: "-0.02em",
          lineHeight: 0.94,
        },
        metadata.title,
      ),
      box(
        {
          display: "flex",
          maxWidth: 660,
          marginTop: 24,
          color: SOCIAL_PREVIEW_COLORS.textMuted,
          fontFamily: BODY_FONT,
          fontSize: 23,
          lineHeight: 1.3,
        },
        metadata.description,
      ),
    ),
    box(
      {
        display: "flex",
        width: 270,
        flexDirection: "column",
        justifyContent: "center",
        borderLeft: `1px solid ${SOCIAL_PREVIEW_COLORS.line}`,
        paddingLeft: 34,
      },
      portrait,
      label(
        {
          marginTop: 24,
          color: SOCIAL_PREVIEW_COLORS.text,
          fontFamily: MONO_FONT,
          fontSize: 16,
          fontWeight: 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        },
        "John-Ronan S. Beira",
      ),
      label(
        {
          marginTop: 10,
          color: SOCIAL_PREVIEW_COLORS.textFaint,
          fontFamily: MONO_FONT,
          fontSize: 15,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        },
        "Software developer",
      ),
    ),
  );

  const footer = box(
    {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      flexShrink: 0,
      padding: "18px 28px",
      borderTop: `1px solid ${SOCIAL_PREVIEW_COLORS.line}`,
    },
    label(
      {
        color: SOCIAL_PREVIEW_COLORS.textMuted,
        fontFamily: MONO_FONT,
        fontSize: 16,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
      },
      "syn-forge.com",
    ),
    label(
      {
        color: SOCIAL_PREVIEW_COLORS.signal,
        fontFamily: MONO_FONT,
        fontSize: 16,
        fontWeight: 600,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
      },
      "Open the archive",
    ),
  );

  return box(
    {
      display: "flex",
      width: "100%",
      height: "100%",
      padding: 36,
      backgroundColor: SOCIAL_PREVIEW_COLORS.canvas,
      color: SOCIAL_PREVIEW_COLORS.text,
      fontFamily: BODY_FONT,
    },
    box(
      {
        display: "flex",
        flex: 1,
        flexDirection: "column",
        border: `1px solid ${SOCIAL_PREVIEW_COLORS.line}`,
        backgroundColor: SOCIAL_PREVIEW_COLORS.canvas,
      },
      header,
      main,
      footer,
    ),
  );
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character] ?? character,
  );
}

function buildManagedHead(
  metadata: ReturnType<typeof getSocialPreviewMetadata>,
  pageUrl: string,
  imageUrl: string,
) {
  const title = `${metadata.title} | Syn-Forge`;
  const tags = [
    `<meta name="description" content="${escapeHtml(metadata.description)}" />`,
    `<link rel="canonical" href="${escapeHtml(pageUrl)}" />`,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(metadata.description)}" />`,
    `<meta property="og:image" content="${escapeHtml(imageUrl)}" />`,
    `<meta property="og:image:secure_url" content="${escapeHtml(imageUrl)}" />`,
    '<meta property="og:image:type" content="image/png" />',
    `<meta property="og:image:width" content="${SOCIAL_PREVIEW_WIDTH}" />`,
    `<meta property="og:image:height" content="${SOCIAL_PREVIEW_HEIGHT}" />`,
    `<meta property="og:image:alt" content="${escapeHtml(metadata.imageAlt)}" />`,
    `<meta property="og:url" content="${escapeHtml(pageUrl)}" />`,
    '<meta property="og:type" content="website" />',
    '<meta property="og:site_name" content="Syn-Forge" />',
    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="twitter:title" content="${escapeHtml(title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(metadata.description)}" />`,
    `<meta name="twitter:image" content="${escapeHtml(imageUrl)}" />`,
  ];

  return tags.join("");
}

function isHtmlResponse(response: PagesResponse) {
  return (
    response.ok &&
    response.headers.get("content-type")?.toLowerCase().includes("text/html") === true
  );
}

function rewriteDocumentHead(response: PagesResponse, requestUrl: string) {
  const url = new URL(requestUrl);
  const metadata = getSocialPreviewMetadata(url.pathname);
  const imageUrl = getSocialPreviewImageUrl(url.pathname, url.origin);
  url.search = "";
  url.hash = "";

  let rewriter = new HTMLRewriter()
    .on("title", {
      element(element) {
        element.setInnerContent(`${metadata.title} | Syn-Forge`);
      },
    })
    .on("head", {
      element(element) {
        element.append(buildManagedHead(metadata, url.href, imageUrl), { html: true });
      },
    });

  const selectorsToRemove = [
    'meta[name="description"]',
    'link[rel="canonical"]',
    'meta[property="og:title"]',
    'meta[property="og:description"]',
    'meta[property="og:image"]',
    'meta[property="og:image:url"]',
    'meta[property="og:image:secure_url"]',
    'meta[property="og:image:type"]',
    'meta[property="og:image:width"]',
    'meta[property="og:image:height"]',
    'meta[property="og:image:alt"]',
    'meta[property="og:url"]',
    'meta[property="og:type"]',
    'meta[property="og:site_name"]',
    'meta[name="twitter:card"]',
    'meta[name="twitter:title"]',
    'meta[name="twitter:description"]',
    'meta[name="twitter:image"]',
  ];

  for (const selector of selectorsToRemove) {
    rewriter = rewriter.on(selector, {
      element(element) {
        element.remove();
      },
    });
  }

  return rewriter.transform(response as unknown as Response) as unknown as PagesResponse;
}

export const onRequest: PagesFunction = async (context) => {
  const url = new URL(context.request.url);

  if (context.request.method === "GET" && url.pathname.endsWith(SOCIAL_PREVIEW_IMAGE_SUFFIX)) {
    const pagePath = url.pathname.slice(0, -SOCIAL_PREVIEW_IMAGE_SUFFIX.length) || "/";
    return new ImageResponse(renderSocialPreviewCard(getSocialPreviewMetadata(pagePath)), {
      width: SOCIAL_PREVIEW_WIDTH,
      height: SOCIAL_PREVIEW_HEIGHT,
      headers: {
        "cache-control": SOCIAL_PREVIEW_CACHE_CONTROL,
      },
    });
  }

  const response = await context.next();
  return isHtmlResponse(response) ? rewriteDocumentHead(response, context.request.url) : response;
};
