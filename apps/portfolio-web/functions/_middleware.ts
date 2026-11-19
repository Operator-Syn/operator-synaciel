import type { PagesFunction, Response as PagesResponse } from "@cloudflare/workers-types";
import { SITEMAP_STATIC_ROUTES } from "../src/data/canonicalRoutes.ts";
import { createSitemapResponse } from "../src/data/sitemap.ts";
import {
  getSocialPreviewImageUrl,
  getSocialPreviewMetadata,
  SOCIAL_PREVIEW_HEIGHT,
  SOCIAL_PREVIEW_WIDTH,
} from "../src/data/socialPreview.ts";
import { createCanonicalRouteRedirect } from "./canonicalRedirect.ts";

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

type PagesEnv = {
  VITE_API_URL?: string;
  ASSETS: { fetch(resource: URL): Promise<PagesResponse> };
};

const KNOWN_STATIC_ROUTES = new Set<string>(["/", ...SITEMAP_STATIC_ROUTES]);
const SNIPPET_DOCUMENT_ROUTE = /^\/snippets\/document\/\d+\/[^/]+$/;

function normalizePathForMatch(pathname: string) {
  return pathname === "/" ? pathname : pathname.replace(/\/+$/, "");
}

function isKnownRoute(pathname: string) {
  const normalized = normalizePathForMatch(pathname);
  return KNOWN_STATIC_ROUTES.has(normalized) || SNIPPET_DOCUMENT_ROUTE.test(normalized);
}

function createCaseVariantRedirect(requestUrl: string) {
  const url = new URL(requestUrl);
  const lowerPath = url.pathname.toLowerCase();

  if (lowerPath === url.pathname || !isKnownRoute(lowerPath)) {
    return null;
  }

  url.pathname = lowerPath;
  return new Response(null, {
    status: 301,
    headers: { Location: url.href },
  });
}

async function serveNotFound(
  assets: PagesEnv["ASSETS"],
  requestUrl: string,
): Promise<PagesResponse> {
  const notFound = await assets.fetch(new URL("/404.html", requestUrl));
  const headers = new Headers();
  headers.set("Content-Type", "text/html; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  headers.set("X-Robots-Tag", "noindex");
  return new Response(notFound.body as unknown as BodyInit | null, {
    status: 404,
    headers,
  }) as unknown as PagesResponse;
}

export const onRequest: PagesFunction<PagesEnv> = async (context) => {
  const requestUrl = context.request.url;
  const pathname = new URL(requestUrl).pathname;

  if (pathname === "/sitemap.xml") {
    return (await createSitemapResponse(
      context.request as unknown as Request,
      context.env.VITE_API_URL,
    )) as unknown as PagesResponse;
  }

  const canonicalRedirect = createCanonicalRouteRedirect(requestUrl);
  if (canonicalRedirect) return canonicalRedirect as unknown as PagesResponse;

  const caseRedirect = createCaseVariantRedirect(requestUrl);
  if (caseRedirect) return caseRedirect as unknown as PagesResponse;

  if (!isKnownRoute(pathname)) {
    return serveNotFound(context.env.ASSETS, requestUrl);
  }

  const indexResponse = await context.env.ASSETS.fetch(new URL("/index.html", requestUrl));

  if (!isHtmlResponse(indexResponse)) {
    return serveNotFound(context.env.ASSETS, requestUrl);
  }

  return rewriteDocumentHead(indexResponse, requestUrl);
};
