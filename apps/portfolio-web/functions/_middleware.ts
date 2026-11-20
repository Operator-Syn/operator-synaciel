import type { PagesFunction, Response as PagesResponse } from "@cloudflare/workers-types";
import { NON_INDEXABLE_ROUTES } from "../src/data/canonicalRoutes.ts";
import { createSitemapResponse } from "../src/data/sitemap.ts";
import {
  getSocialPreviewImageUrl,
  getSocialPreviewMetadata,
  parseSnippetDocumentPath,
  SOCIAL_PREVIEW_HEIGHT,
  SOCIAL_PREVIEW_WIDTH,
} from "../src/data/socialPreview.ts";
import { buildStructuredDataScript } from "../src/data/structuredData.ts";
import { createCanonicalRouteRedirect } from "./canonicalRedirect.ts";
import {
  type ContentExistence,
  classifyContentExistence,
  fetchContentText,
} from "./contentFetch.ts";
import { isKnownRoute } from "./routePolicy.ts";
import { probeSnippetFolder, type SnippetDatabase } from "./snippetFolderProbe.ts";
import {
  collectSnippetFolderPaths,
  parseSnippetFolderSegments,
  resolveSnippetFolderRoute,
} from "./snippetFolders.ts";

type ArticleDates = {
  readonly published?: string;
  readonly modified?: string;
};

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
  structuredDataScript: string,
  articleDates?: ArticleDates,
) {
  const title = `${metadata.title} | Syn-Forge`;
  const articleTags: string[] = [];
  if (articleDates?.published) {
    articleTags.push(
      `<meta property="article:published_time" content="${escapeHtml(articleDates.published)}" />`,
    );
  }
  if (articleDates?.modified) {
    articleTags.push(
      `<meta property="article:modified_time" content="${escapeHtml(articleDates.modified)}" />`,
    );
  }

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

  return [...tags, ...articleTags, structuredDataScript].join("");
}

function isHtmlResponse(response: PagesResponse) {
  return (
    response.ok &&
    response.headers.get("content-type")?.toLowerCase().includes("text/html") === true
  );
}

// Origins below are read from index.html, src/, and the production VITE_* values
// in the repository-root .env.
const HTML_CSP_REPORT_ONLY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  // Only the hashed same-origin bundle and the Turnstile script
  // (challenges.cloudflare.com/turnstile/v0/api.js, loaded in
  // PortfolioAssistantFab.tsx:717) execute. The inline application/ld+json
  // block is a data block and is not governed by script-src.
  "script-src 'self' https://challenges.cloudflare.com",
  // index.html:28 loads Google Fonts CSS; Tailwind emits an external stylesheet.
  // React writes inline style attributes (theme CSS variables, syntax
  // highlighter), so style attributes stay allowed without allowing <style>.
  "style-src 'self' https://fonts.googleapis.com",
  "style-src-attr 'unsafe-inline'",
  // Google Fonts CSS points at fonts.gstatic.com; Cloudflare Fonts rewrites the
  // same request to the same-origin /cf-fonts path, covered by 'self'.
  "font-src 'self' https://fonts.gstatic.com",
  // Profile image and project/gallery media come from the R2 CDN
  // (VITE_CDN_URL / personal-portfolio-bucket.syn-forge.com); placehold.co is
  // the archive fallback in Projects.tsx:50 and Certificates.tsx:50. Google
  // avatar URLs (*.googleusercontent.com) are allowed by
  // safeGoogleProfilePictureUrl in PortfolioAssistantFab.tsx:153. data:/blob:
  // cover assistant image attachments and downloaded/object-URL previews.
  "img-src 'self' data: blob: https://personal-portfolio-bucket.syn-forge.com https://placehold.co https://*.googleusercontent.com",
  "media-src 'self' blob: https://personal-portfolio-bucket.syn-forge.com",
  // blob: is the PDF preview iframe (SnippetDocument.tsx:324); Turnstile
  // renders its widget in a challenges.cloudflare.com frame.
  "frame-src 'self' blob: https://challenges.cloudflare.com",
  // VITE_API_URL (personal-portfolio.syn-forge.com/api) serves the portfolio
  // data; public-auth.syn-forge.com serves assistant fetches and the agent
  // websocket (useAgent host, PortfolioAssistantFab.tsx:1877); Turnstile
  // reports back to challenges.cloudflare.com.
  "connect-src 'self' https://personal-portfolio.syn-forge.com https://public-auth.syn-forge.com wss://public-auth.syn-forge.com https://challenges.cloudflare.com",
].join("; ");

// Permissions-Policy: camera, microphone, geolocation, and payment were each
// checked for a source use (getUserMedia, navigator.geolocation,
// PaymentRequest) and none exists. clipboard-write is deliberately not denied:
// navigator.clipboard.writeText is used in SnippetMarkdown.tsx and Ai.tsx.
const HTML_PERMISSIONS_POLICY = "camera=(), microphone=(), geolocation=(), payment=()";

const HTML_HEADERS_TO_DROP = [
  // Deprecated; modern browsers only react negatively to a non-zero value.
  "X-XSS-Protection",
  // Obsolete: certificate transparency is enforced without this header.
  "Expect-CT",
  // The asset layer stamps this on everything; HTML must not be readable
  // cross-origin, and no HTML consumer needs it.
  "Access-Control-Allow-Origin",
  // The head rewrite changes the body, so origin validators and length no
  // longer describe the response we send.
  "Content-Length",
  "Content-Encoding",
  "ETag",
];

function applyHtmlHeaders(headers: Headers) {
  for (const name of HTML_HEADERS_TO_DROP) headers.delete(name);
  headers.set("Strict-Transport-Security", "max-age=31536000");
  headers.set("Content-Security-Policy-Report-Only", HTML_CSP_REPORT_ONLY);
  headers.set("Permissions-Policy", HTML_PERMISSIONS_POLICY);
}

function rewriteDocumentHead(
  response: PagesResponse,
  requestUrl: string,
  articleDates?: ArticleDates,
) {
  const url = new URL(requestUrl);
  const metadata = getSocialPreviewMetadata(url.pathname);
  const imageUrl = getSocialPreviewImageUrl(url.pathname, url.origin);
  url.search = "";
  url.hash = "";

  // One graph per route, owned by the server. The graph is tagged so it stays
  // identifiable after hydration; GlobalHeadManager no longer emits JSON-LD.
  const structuredDataScript = buildStructuredDataScript({
    pathname: url.pathname,
    origin: url.origin,
    metadata,
    articleDates,
  });

  let rewriter = new HTMLRewriter()
    .on("title", {
      element(element) {
        element.setInnerContent(`${metadata.title} | Syn-Forge`);
      },
    })
    .on("head", {
      element(element) {
        element.append(
          buildManagedHead(metadata, url.href, imageUrl, structuredDataScript, articleDates),
          {
            html: true,
          },
        );
      },
    });

  const selectorsToRemove = [
    // The server now owns the graph. Removing any pre-existing block makes the
    // rewrite replace rather than stack, including the former static Person
    // block that used to live in index.html.
    'script[type="application/ld+json"]',
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
    'meta[property="article:published_time"]',
    'meta[property="article:modified_time"]',
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

  const transformed = rewriter.transform(
    response as unknown as Response,
  ) as unknown as PagesResponse;

  // HTMLRewriter.transform preserves the incoming response headers, including
  // the immutable asset-layer guard. Copy them into a mutable Headers object and
  // build a new Response so the drops actually take effect on the wire.
  const headers = new Headers();
  transformed.headers.forEach((value, name) => {
    headers.set(name, value);
  });
  applyHtmlHeaders(headers);

  // Item 1.7: a server-level signal, so a crawler that does not run JS still
  // sees it. The page keeps its self-referencing canonical; `noindex, follow`
  // plus a canonical is coherent. `follow` keeps its links crawlable.
  if (NON_INDEXABLE_ROUTES.has(url.pathname)) {
    headers.set("X-Robots-Tag", "noindex, follow");
  }

  return new Response(transformed.body as unknown as BodyInit | null, {
    status: transformed.status,
    statusText: transformed.statusText,
    headers,
  }) as unknown as PagesResponse;
}

type PagesEnv = {
  VITE_API_URL?: string;
  SNIPPET_DB?: SnippetDatabase;
  ASSETS: { fetch(resource: URL): Promise<PagesResponse> };
};

async function serveNotFound(
  assets: PagesEnv["ASSETS"],
  requestUrl: string,
): Promise<PagesResponse> {
  const notFound = await assets.fetch(new URL("/404.html", requestUrl));
  const headers = new Headers();
  headers.set("Content-Type", "text/html; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  headers.set("X-Robots-Tag", "noindex");
  applyHtmlHeaders(headers);
  return new Response(notFound.body as unknown as BodyInit | null, {
    status: 404,
    headers,
  }) as unknown as PagesResponse;
}

function parseApiDate(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  // D1's datetime('now') is UTC without a timezone suffix.
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)
    ? `${value.replace(" ", "T")}Z`
    : value;
  const timestamp = Date.parse(normalized);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : undefined;
}

function readArticleDates(body: string): ArticleDates | undefined {
  try {
    const payload = JSON.parse(body) as { data?: unknown };
    if (!payload || typeof payload !== "object" || !payload.data) return undefined;
    const data = payload.data as Record<string, unknown>;
    const modified = parseApiDate(data.modified);
    if (!modified) return undefined;

    // `/v2/snippets/:id` exposes only a modification timestamp. Emitting that
    // value as `article:published_time` would assert a publication event the
    // origin never reported, so only the modification tag is emitted. Populate
    // `published` here once the API returns a real creation date.
    return { modified };
  } catch {
    return undefined;
  }
}

type SnippetDocumentLookup = {
  readonly existence: ContentExistence;
  readonly articleDates?: ArticleDates;
};

/**
 * Existence check for a snippet document. The 404-vs-serve decision itself is
 * `classifyContentExistence` in `contentFetch.ts`, kept pure and unit tested:
 * only an explicit 404 is "missing"; timeout, network, 5xx, and other statuses
 * are "unknown" and the page is still served.
 */
async function lookupSnippetDocument(
  id: number,
  apiUrl: string | undefined,
): Promise<SnippetDocumentLookup> {
  if (!apiUrl) return { existence: "unknown" };

  const result = await fetchContentText(`${apiUrl.replace(/\/+$/, "")}/v2/snippets/${id}`, {
    timeoutMs: 4000,
    cacheTtlSeconds: 3600,
  });
  const existence = classifyContentExistence(result);
  if (!result.ok) return { existence };

  return { existence, articleDates: readArticleDates(result.body) };
}

/**
 * Folder existence comes from the same bounded, cached snippet-tree fetch the
 * rest of the snippet path uses. Any failure is "unknown": the app is still
 * served, because a broken API must not 404 working deep links. Only an explicit
 * tree without the requested folder is a missing-folder signal.
 */
async function lookupSnippetFolders(
  apiUrl: string | undefined,
): Promise<ReadonlySet<string> | undefined> {
  if (!apiUrl) return undefined;

  const result = await fetchContentText(`${apiUrl.replace(/\/+$/, "")}/snippets`, {
    timeoutMs: 4000,
    cacheTtlSeconds: 3600,
  });
  if (!result.ok) return undefined;

  try {
    const payload = JSON.parse(result.body) as { data?: unknown };
    if (!payload || typeof payload !== "object" || !("data" in payload)) return undefined;
    return collectSnippetFolderPaths(payload.data);
  } catch {
    return undefined;
  }
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

  if (!isKnownRoute(pathname)) {
    return serveNotFound(context.env.ASSETS, requestUrl);
  }

  // A snippet document is the only known route whose existence is not implied
  // by the allowlist. Only an explicit 404 from the API is grounds for a 404.
  const snippetDocument = parseSnippetDocumentPath(pathname);
  let articleDates: ArticleDates | undefined;
  if (snippetDocument) {
    const lookup = await lookupSnippetDocument(snippetDocument.id, context.env.VITE_API_URL);
    if (lookup.existence === "missing") {
      return serveNotFound(context.env.ASSETS, requestUrl);
    }
    articleDates = lookup.articleDates;
  } else {
    const folderSegments = parseSnippetFolderSegments(pathname);
    const decision = await resolveSnippetFolderRoute(
      pathname,
      folderSegments,
      (segments) => probeSnippetFolder(context.env.SNIPPET_DB, segments),
      () => lookupSnippetFolders(context.env.VITE_API_URL),
    );

    if (decision.action === "not-found") {
      return serveNotFound(context.env.ASSETS, requestUrl);
    }

    if (decision.action === "redirect") {
      const url = new URL(requestUrl);
      url.pathname = decision.pathname;
      return new Response(null, {
        status: 308,
        headers: { Location: url.href },
      }) as unknown as PagesResponse;
    }
  }

  const indexResponse = await context.env.ASSETS.fetch(new URL("/index.html", requestUrl));

  if (!isHtmlResponse(indexResponse)) {
    return serveNotFound(context.env.ASSETS, requestUrl);
  }

  return rewriteDocumentHead(indexResponse, requestUrl, articleDates);
};
