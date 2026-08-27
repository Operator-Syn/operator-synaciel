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
  const identityFrame = box(
    {
      display: "flex",
      width: 236,
      height: 236,
      position: "relative",
      alignItems: "center",
      justifyContent: "center",
      border: `1px solid ${SOCIAL_PREVIEW_COLORS.lineStrong}`,
      backgroundColor: SOCIAL_PREVIEW_COLORS.surface,
    },
    box(
      {
        position: "absolute",
        top: 18,
        left: 18,
        color: SOCIAL_PREVIEW_COLORS.textFaint,
        fontFamily: MONO_FONT,
        fontSize: 12,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
      },
      "SYN / IDENTITY",
    ),
    box({
      position: "absolute",
      top: 43,
      left: 18,
      width: 44,
      height: 1,
      backgroundColor: SOCIAL_PREVIEW_COLORS.lineStrong,
    }),
    label(
      {
        color: SOCIAL_PREVIEW_COLORS.text,
        fontFamily: DISPLAY_FONT,
        fontSize: 80,
        fontWeight: 400,
        letterSpacing: "-0.08em",
      },
      "JSB",
    ),
    box({
      position: "absolute",
      left: 18,
      right: 18,
      bottom: 42,
      height: 1,
      backgroundColor: SOCIAL_PREVIEW_COLORS.line,
    }),
    label(
      {
        position: "absolute",
        left: 18,
        bottom: 17,
        color: SOCIAL_PREVIEW_COLORS.textFaint,
        fontFamily: MONO_FONT,
        fontSize: 12,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
      },
      "John-Ronan S. Beira",
    ),
    box({
      position: "absolute",
      right: 16,
      bottom: 16,
      width: 10,
      height: 10,
      backgroundColor: SOCIAL_PREVIEW_COLORS.signal,
    }),
  );

  const header = box(
    {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      flexShrink: 0,
      padding: "18px 28px",
      borderBottom: `1px solid ${SOCIAL_PREVIEW_COLORS.line}`,
      backgroundColor: SOCIAL_PREVIEW_COLORS.surface,
    },
    box(
      {
        display: "flex",
        alignItems: "center",
        gap: 12,
      },
      box({
        width: 8,
        height: 8,
        backgroundColor: SOCIAL_PREVIEW_COLORS.signal,
      }),
      label(
        {
          color: SOCIAL_PREVIEW_COLORS.text,
          fontFamily: DISPLAY_FONT,
          fontSize: 24,
          fontWeight: 400,
        },
        "Operator-Syn",
      ),
      label(
        {
          color: SOCIAL_PREVIEW_COLORS.textFaint,
          fontFamily: MONO_FONT,
          fontSize: 12,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
        },
        "Working archive",
      ),
    ),
    box(
      {
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: 5,
      },
      label(
        {
          color: SOCIAL_PREVIEW_COLORS.signal,
          fontFamily: MONO_FONT,
          fontSize: 15,
          fontWeight: 600,
          letterSpacing: "0.1em",
        },
        metadata.routeIndex,
      ),
      label(
        {
          color: SOCIAL_PREVIEW_COLORS.textFaint,
          fontFamily: MONO_FONT,
          fontSize: 12,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
        },
        metadata.pathname,
      ),
    ),
  );

  const identityAside = box(
    {
      display: "flex",
      position: "absolute",
      top: 158,
      right: 76,
      width: 260,
      flexDirection: "column",
      justifyContent: "center",
      borderLeft: `1px solid ${SOCIAL_PREVIEW_COLORS.line}`,
      paddingLeft: 28,
    },
    identityFrame,
    label(
      {
        marginTop: 14,
        color: SOCIAL_PREVIEW_COLORS.text,
        fontFamily: MONO_FONT,
        fontSize: 13,
        fontWeight: 600,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
      },
      "Software developer",
    ),
    label(
      {
        marginTop: 6,
        color: SOCIAL_PREVIEW_COLORS.textFaint,
        fontFamily: MONO_FONT,
        fontSize: 12,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
      },
      "Syn-Forge / portfolio",
    ),
  );

  const main = box(
    {
      display: "flex",
      flex: 1,
      flexBasis: 0,
      gap: 38,
      minHeight: 0,
      position: "relative",
      padding: "28px 38px 26px",
    },
    box(
      {
        display: "flex",
        width: 700,
        flexShrink: 0,
        flexDirection: "column",
        justifyContent: "center",
        minWidth: 0,
        paddingRight: 4,
      },
      label(
        {
          color: SOCIAL_PREVIEW_COLORS.signal,
          fontFamily: MONO_FONT,
          fontSize: 15,
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
          fontSize: 76,
          fontWeight: 400,
          letterSpacing: "-0.03em",
          lineHeight: 0.92,
        },
        metadata.title,
      ),
      box(
        {
          display: "flex",
          maxWidth: 620,
          marginTop: 18,
          color: SOCIAL_PREVIEW_COLORS.textMuted,
          fontFamily: BODY_FONT,
          fontSize: 22,
          lineHeight: 1.3,
        },
        metadata.description,
      ),
      box(
        {
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginTop: 24,
        },
        box({
          width: 42,
          height: 1,
          backgroundColor: SOCIAL_PREVIEW_COLORS.signal,
        }),
        label(
          {
            color: SOCIAL_PREVIEW_COLORS.textFaint,
            fontFamily: MONO_FONT,
            fontSize: 12,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          },
          `Syn-Forge / ${metadata.label}`,
        ),
      ),
    ),
  );

  const footer = box(
    {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      flexShrink: 0,
      padding: "16px 28px",
      borderTop: `1px solid ${SOCIAL_PREVIEW_COLORS.line}`,
      backgroundColor: SOCIAL_PREVIEW_COLORS.surface,
    },
    label(
      {
        color: SOCIAL_PREVIEW_COLORS.textMuted,
        fontFamily: MONO_FONT,
        fontSize: 13,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
      },
      "Syn-Forge.com",
    ),
    label(
      {
        color: SOCIAL_PREVIEW_COLORS.signal,
        fontFamily: MONO_FONT,
        fontSize: 13,
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
      padding: 28,
      backgroundColor: SOCIAL_PREVIEW_COLORS.canvas,
      color: SOCIAL_PREVIEW_COLORS.text,
      fontFamily: BODY_FONT,
    },
    box(
      {
        display: "flex",
        flex: 1,
        flexDirection: "column",
        position: "relative",
        border: `1px solid ${SOCIAL_PREVIEW_COLORS.line}`,
        backgroundColor: SOCIAL_PREVIEW_COLORS.canvas,
      },
      box({
        position: "absolute",
        top: -1,
        left: 30,
        width: 72,
        height: 3,
        backgroundColor: SOCIAL_PREVIEW_COLORS.signal,
      }),
      header,
      main,
      footer,
      identityAside,
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
