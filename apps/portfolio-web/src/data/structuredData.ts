import { PORTFOLIO_MCP_DESCRIPTION, PORTFOLIO_MCP_ENDPOINT } from "./portfolioMcp.ts";
import { parseProjectPath } from "./projectRoutes.ts";
import {
  normalizeSocialPreviewPath,
  parseSnippetDocumentPath,
  SOCIAL_PREVIEW_AVATAR_URL,
  type SocialPreviewMetadata,
} from "./socialPreview.ts";

const SCHEMA_CONTEXT = "https://schema.org";

/**
 * The Person knowledge carried by the old static block in `index.html`.
 *
 * Every value here was already published in that block. Nothing is inferred:
 * no address, employer, price, rating, or aggregate is present because the
 * repository does not source one.
 */
const PERSON_PROFILE = {
  name: "Operator-Syn",
  alternateName: [
    "Operator-Syn",
    "Syn-Forge",
    "Operator-Synaciel",
    "OperatorSynaciel",
    "Operator Synaciel",
    "Syn",
    "Syn Forge",
    "SynForge",
  ],
  jobTitle: "Full-Stack Software Developer",
  knowsAbout: [
    "Linux",
    "React",
    "Cloudflare",
    "Cloudflare Workers",
    "Cloudflare Pages",
    "Java",
    "Python",
    "TypeScript",
    "Vite",
    "Web Development",
    "SQL",
    "Database Systems",
    "Cloud Infrastructure",
    "Software Engineering",
    "Open Source",
  ],
  sameAs: ["https://github.com/Operator-Syn"],
} as const;

const COLLECTION_ROUTES = new Set(["/projects", "/certificates", "/snippets"]);

export type StructuredDataArticleDates = {
  readonly published?: string;
  readonly modified?: string;
};

/**
 * The project facts a detail page's graph carries.
 *
 * Sourced from the archive response, never composed: the title, the summary, and the facets the API
 * already publishes.
 */
export type StructuredDataProject = {
  readonly title: string;
  readonly description: string;
  readonly keywords: readonly string[];
  readonly image?: string;
};

/** One member of an archive's `ItemList`. */
export type StructuredDataListItem = {
  readonly name: string;
  readonly url: string;
};

export type StructuredDataInput = {
  /** Raw request pathname; normalized internally. */
  readonly pathname: string;
  /** Request origin, so local probes emit absolute local URLs. */
  readonly origin: string;
  /** The same metadata the head rewrite uses for title/description/canonical. */
  readonly metadata: SocialPreviewMetadata;
  readonly articleDates?: StructuredDataArticleDates;
  /** Present only when a project detail page resolved its project. */
  readonly project?: StructuredDataProject;
  /** Present only when an archive's collection was read completely. */
  readonly listItems?: readonly StructuredDataListItem[];
};

type JsonLdNode = Record<string, unknown>;

export type StructuredDataGraph = {
  readonly "@context": typeof SCHEMA_CONTEXT;
  readonly "@graph": readonly JsonLdNode[];
};

function normalizeOrigin(origin: string) {
  return origin.replace(/\/+$/, "");
}

function pageUrlFor(pathname: string, origin: string) {
  return new URL(normalizeSocialPreviewPath(pathname), `${origin}/`).href;
}

function createPersonNode(origin: string): JsonLdNode {
  return {
    "@type": "Person",
    "@id": `${origin}/#person`,
    ...PERSON_PROFILE,
    url: `${origin}/`,
    image: SOCIAL_PREVIEW_AVATAR_URL,
  };
}

function createWebSiteNode(origin: string, metadata: SocialPreviewMetadata): JsonLdNode {
  return {
    "@type": "WebSite",
    "@id": `${origin}/#website`,
    name: "Syn-Forge",
    url: `${origin}/`,
    description: metadata.description,
    inLanguage: "en",
    publisher: { "@id": `${origin}/#person` },
  };
}

function createWebPageNode(metadata: SocialPreviewMetadata, pageUrl: string): JsonLdNode {
  return {
    "@type": "WebPage",
    "@id": `${pageUrl}#webpage`,
    url: pageUrl,
    name: metadata.title,
    description: metadata.description,
  };
}

function buildDocumentGraph(
  metadata: SocialPreviewMetadata,
  pageUrl: string,
  origin: string,
  articleDates?: StructuredDataArticleDates,
): StructuredDataGraph {
  const article: JsonLdNode = {
    "@type": "TechArticle",
    "@id": `${pageUrl}#techarticle`,
    headline: metadata.title,
    description: metadata.description,
    url: pageUrl,
    // The Person node is defined on `/`; this is an identifier reference, not
    // a second Person graph.
    author: { "@id": `${origin}/#person` },
  };
  if (articleDates?.published) article.datePublished = articleDates.published;
  if (articleDates?.modified) article.dateModified = articleDates.modified;

  return {
    "@context": SCHEMA_CONTEXT,
    "@graph": [
      article,
      {
        "@type": "BreadcrumbList",
        "@id": `${pageUrl}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${origin}/` },
          { "@type": "ListItem", position: 2, name: "Snippets", item: `${origin}/snippets` },
          { "@type": "ListItem", position: 3, name: metadata.title, item: pageUrl },
        ],
      },
    ],
  };
}

function buildCollectionGraph(
  metadata: SocialPreviewMetadata,
  pageUrl: string,
  listItems?: readonly StructuredDataListItem[],
): StructuredDataGraph {
  const itemListId = `${pageUrl}#itemlist`;

  // Members are published only when the server read the whole collection. A partial list would
  // claim a set the page cannot support, so an absent or empty list omits both `itemListElement`
  // and `numberOfItems` rather than describing what happened to be readable.
  const itemList: JsonLdNode = { "@type": "ItemList", "@id": itemListId, name: metadata.title };
  if (listItems !== undefined && listItems.length > 0) {
    itemList.itemListElement = listItems.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      url: item.url,
    }));
    itemList.numberOfItems = listItems.length;
  }

  return {
    "@context": SCHEMA_CONTEXT,
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${pageUrl}#collectionpage`,
        url: pageUrl,
        name: metadata.title,
        description: metadata.description,
        mainEntity: { "@id": itemListId },
      },
      itemList,
    ],
  };
}

/**
 * Graph for a project detail page.
 *
 * `TechArticle` rather than `SoftwareSourceCode`: these pages are written case studies, and only four
 * of the seven records link to a repository at all. The article and the breadcrumb are the only nodes
 * emitted — the `Person` entity stays an identifier reference to the node defined on `/`, so no second
 * Person graph appears.
 *
 * @param pageUrl The canonical absolute URL of the page.
 * @param origin The request origin, used for the breadcrumb's earlier entries.
 * @param project The project facts.
 * @param articleDates Already-normalised dates; an absent `published` emits no `datePublished`.
 * @returns The single JSON-LD graph for the page.
 */
function buildProjectGraph(
  pageUrl: string,
  origin: string,
  project: StructuredDataProject,
  articleDates?: StructuredDataArticleDates,
): StructuredDataGraph {
  const article: JsonLdNode = {
    "@type": "TechArticle",
    "@id": `${pageUrl}#techarticle`,
    headline: project.title,
    description: project.description,
    url: pageUrl,
    author: { "@id": `${origin}/#person` },
    keywords: project.keywords.join(", "),
  };
  if (project.image) article.image = project.image;
  if (articleDates?.published) article.datePublished = articleDates.published;
  if (articleDates?.modified) article.dateModified = articleDates.modified;

  return {
    "@context": SCHEMA_CONTEXT,
    "@graph": [
      article,
      {
        "@type": "BreadcrumbList",
        "@id": `${pageUrl}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${origin}/` },
          { "@type": "ListItem", position: 2, name: "Projects", item: `${origin}/projects` },
          { "@type": "ListItem", position: 3, name: project.title, item: pageUrl },
        ],
      },
    ],
  };
}

function buildAiGraph(metadata: SocialPreviewMetadata, pageUrl: string): StructuredDataGraph {
  const applicationId = `${pageUrl}#softwareapplication`;
  return {
    "@context": SCHEMA_CONTEXT,
    "@graph": [
      {
        ...createWebPageNode(metadata, pageUrl),
        about: { "@id": applicationId },
      },
      {
        "@type": "SoftwareApplication",
        "@id": applicationId,
        name: "Syn-Forge Public Portfolio MCP",
        applicationCategory: "DeveloperApplication",
        description: PORTFOLIO_MCP_DESCRIPTION,
        url: PORTFOLIO_MCP_ENDPOINT,
      },
    ],
  };
}

/**
 * Builds the single JSON-LD graph for a route.
 *
 * Pure: the same pathname, origin, metadata, and dates always produce the same
 * graph. `metadata` is passed in from `getSocialPreviewMetadata` so `name`,
 * `description`, and `url` cannot disagree with the meta tags the middleware
 * emits from the same object.
 */
export function buildStructuredData(input: StructuredDataInput): StructuredDataGraph {
  const origin = normalizeOrigin(input.origin);
  const pathname = normalizeSocialPreviewPath(input.pathname);
  const pageUrl = pageUrlFor(pathname, origin);
  const { metadata, articleDates } = input;

  if (parseSnippetDocumentPath(pathname)) {
    return buildDocumentGraph(metadata, pageUrl, origin, articleDates);
  }

  // A project detail page only has a graph when its project resolved; an unresolved path falls
  // through to the plain `WebPage` rather than publishing a graph it cannot support.
  if (parseProjectPath(pathname) && input.project) {
    return buildProjectGraph(pageUrl, origin, input.project, articleDates);
  }

  if (pathname === "/") {
    return {
      "@context": SCHEMA_CONTEXT,
      "@graph": [
        {
          "@type": "ProfilePage",
          "@id": `${pageUrl}#profilepage`,
          url: pageUrl,
          name: metadata.title,
          description: metadata.description,
          mainEntity: { "@id": `${origin}/#person` },
          isPartOf: { "@id": `${origin}/#website` },
        },
        createPersonNode(origin),
        createWebSiteNode(origin, metadata),
      ],
    };
  }

  // Any path under `/snippets/` is a served folder view rendered by the same
  // SPA collection; snippet documents were handled above.
  if (COLLECTION_ROUTES.has(pathname) || pathname.startsWith("/snippets/")) {
    return buildCollectionGraph(metadata, pageUrl, input.listItems);
  }

  if (pathname === "/ai") {
    return buildAiGraph(metadata, pageUrl);
  }

  // Legal pages are plain WebPages, and every other served route
  // (`/netbird`, `/atelier`, `/agent`) falls back to the same shape rather than
  // emitting an empty graph.
  return {
    "@context": SCHEMA_CONTEXT,
    "@graph": [createWebPageNode(metadata, pageUrl)],
  };
}

/**
 * Serializes a graph into a `<script type="application/ld+json">` data block.
 *
 * `<`, `>`, and `&` are escaped so a slug containing `</script>` cannot close
 * the block, and the JavaScript line separators are escaped for the same
 * reason JSON in HTML is escaped. The escapes stay valid JSON.
 */
export function serializeStructuredData(graph: StructuredDataGraph) {
  return JSON.stringify(graph)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export function buildStructuredDataScript(input: StructuredDataInput) {
  return `<script type="application/ld+json" data-global-head-manager="true">${serializeStructuredData(buildStructuredData(input))}</script>`;
}
