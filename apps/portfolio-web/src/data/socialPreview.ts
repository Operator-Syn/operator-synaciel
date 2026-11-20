export const SOCIAL_PREVIEW_SITE_ORIGIN = "https://syn-forge.com";
export const SOCIAL_PREVIEW_IMAGE_SUFFIX = "/social-image.png";
export const SOCIAL_PREVIEW_WIDTH = 1200;
export const SOCIAL_PREVIEW_HEIGHT = 630;
export const SOCIAL_PREVIEW_CONTENT_TYPE = "image/png";
export const SOCIAL_PREVIEW_AVATAR_URL =
  "https://personal-portfolio-bucket.syn-forge.com/ProfilePicture/nice.webp";
export const SOCIAL_PREVIEW_COLORS = {
  canvas: "#101111",
  surface: "#171918",
  text: "#f2ede3",
  textMuted: "#b7b1a7",
  textFaint: "#8d8a83",
  line: "rgb(242 237 227 / 18%)",
  lineStrong: "rgb(242 237 227 / 35%)",
  signal: "#f0a42a",
} as const;

export type SocialPreviewRouteKey =
  | "home"
  | "projects"
  | "certificates"
  | "snippets"
  | "privacy"
  | "terms"
  | "netbird"
  | "atelier"
  | "ai"
  | "agent";

export type SocialPreviewRouteDefinition = {
  readonly route: SocialPreviewRouteKey;
  readonly pathname: string;
  readonly label: string;
  readonly title: string;
  readonly description: string;
};

export type SocialPreviewMetadata = SocialPreviewRouteDefinition & {
  readonly imageAlt: string;
  readonly routeIndex: string;
};

export const HOME_PAGE_DESCRIPTION =
  "Explore Syn-Forge: Operator-Syn's software developer portfolio of projects, experiments, code snippets, and practical notes on software development.";

export const SOCIAL_PREVIEW_ROUTES = [
  {
    route: "home",
    pathname: "/",
    label: "Home",
    title: "Software Developer Portfolio — Operator-Syn",
    description: HOME_PAGE_DESCRIPTION,
  },
  {
    route: "projects",
    pathname: "/projects",
    label: "Projects",
    title: "Projects & Case Studies — Software Developer",
    description:
      "Selected software projects with the problem, the stack and the outcome, plus build notes on the architecture behind each one.",
  },
  {
    route: "certificates",
    pathname: "/certificates",
    label: "Certificates",
    title: "Certifications & Training — Developer Skills",
    description:
      "Training and credentials in full-stack development, cloud and data, listed with issuer, date and what each course covered.",
  },
  {
    route: "snippets",
    pathname: "/snippets",
    label: "Snippets",
    title: "Code Snippets & Notes — Database Migrations",
    description:
      "Code snippets and developer notes on database migrations, schema changes and deployment practices, written up as short walkthroughs.",
  },
  {
    route: "privacy",
    pathname: "/privacy-policy",
    label: "Privacy",
    title: "Privacy Policy — Data Handling on syn-forge.com",
    description:
      "How syn-forge.com and the portfolio assistant handle your data: what is stored, what is not, and how to request deletion.",
  },
  {
    route: "terms",
    pathname: "/terms-and-conditions",
    label: "Terms",
    title: "Terms & Conditions — Using syn-forge.com",
    description:
      "The terms for using syn-forge.com: acceptable use, intellectual property, availability and the limits of the demo features.",
  },
  {
    route: "netbird",
    pathname: "/netbird",
    label: "NetBird",
    title: "NetBird",
    description:
      "NetBird access homepage for Syn-Forge infrastructure and Google project verification.",
  },
  {
    route: "atelier",
    pathname: "/atelier",
    label: "Atelier",
    title: "Atelier",
    description:
      "Atelier dashboard homepage for Syn-Forge portfolio administration and application verification.",
  },
  {
    route: "ai",
    pathname: "/ai",
    label: "AI and MCP",
    title: "AI & MCP Access — Agent-Readable Portfolio",
    description:
      "Connect AI agents to Syn-Forge's public portfolio MCP for grounded profile, project, certificate, public snippet, and bounded GitHub project information.",
  },
  {
    route: "agent",
    pathname: "/agent",
    label: "Feilhann Agent",
    title: "Feilhann Agent",
    description: "Feilhann Agent homepage for Syn-Forge and Google project verification.",
  },
] as const satisfies readonly SocialPreviewRouteDefinition[];

const fallbackRoute = SOCIAL_PREVIEW_ROUTES[0];

export function normalizeSocialPreviewPath(pathname: string) {
  const rawPath = pathname.trim().split(/[?#]/, 1)[0] ?? "";
  if (!rawPath) return "/";

  const withLeadingSlash = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
  const normalized = withLeadingSlash.replace(/\/+$/, "");
  return normalized || "/";
}

/**
 * `/snippets/document/<id>/<slug>` recogniser.
 *
 * This is the single copy used by the metadata layer and the Pages middleware.
 * `functions/canonicalRedirect.ts` has its own private, equivalent regex; it
 * lives in a module this increment must not edit, so exporting from there was
 * not an option and a second private copy in the middleware was the worse
 * choice. Both regexes describe the same app route.
 */
const SNIPPET_DOCUMENT_PATH = /^\/snippets\/document\/(\d+)\/([^/]+)$/;

export type SnippetDocumentPath = {
  readonly id: number;
  readonly slug: string;
};

export function parseSnippetDocumentPath(pathname: string): SnippetDocumentPath | null {
  const match = SNIPPET_DOCUMENT_PATH.exec(normalizeSocialPreviewPath(pathname));
  if (!match) return null;

  const id = Number.parseInt(match[1], 10);
  return Number.isSafeInteger(id) ? { id, slug: match[2] } : null;
}

/**
 * Title-cases the first letter of a dash-separated word without touching the
 * rest, so percent-decoded capitalisation such as `Café` survives.
 */
function titleCaseWord(word: string) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function decodeSlug(slug: string) {
  try {
    return decodeURIComponent(slug);
  } catch {
    // A malformed escape is still a slug; use it literally rather than throw.
    return slug;
  }
}

const SNIPPET_DESCRIPTION_MAX_LENGTH = 155;

function clampDescription(description: string) {
  if (description.length <= SNIPPET_DESCRIPTION_MAX_LENGTH) return description;
  const clipped = description.slice(0, SNIPPET_DESCRIPTION_MAX_LENGTH - 1);
  const lastSpace = clipped.lastIndexOf(" ");
  const base = lastSpace > 100 ? clipped.slice(0, lastSpace) : clipped;
  return `${base.trimEnd()}…`;
}

/**
 * Derives a snippet document's title and description from its URL slug.
 *
 * The description is derived from the filename, not a summary of the
 * document's content. It stays synchronous and API-free on purpose: a title
 * that changes when the API is down is worse than a slightly generic one.
 *
 * Rule: percent-decode, strip a trailing file extension (only the final
 * `.ext`, so dots inside the stem survive), split on `-`, title-case each
 * word, then join with spaces and append `— Code Snippets`.
 */
export function deriveSnippetDocumentMetadata(slug: string) {
  const decoded = decodeSlug(slug);
  const stem = decoded.replace(/\.[a-z][a-z0-9]{0,7}$/i, "");
  const words = stem.split("-").filter((word) => word.length > 0);
  const titleText = words.map(titleCaseWord).join(" ") || "Snippet Document";
  const description = clampDescription(
    `Read ${titleText}, a code snippet document in the Syn-Forge portfolio: source code, developer notes, and reference material from Operator-Syn.`,
  );

  return {
    title: `${titleText} — Code Snippets`,
    description,
  };
}

export function getSocialPreviewMetadata(pathname: string): SocialPreviewMetadata {
  const normalized = normalizeSocialPreviewPath(pathname);
  const snippetDocument = parseSnippetDocumentPath(normalized);
  const definition =
    SOCIAL_PREVIEW_ROUTES.find(
      (candidate) =>
        candidate.pathname === normalized ||
        (candidate.pathname !== "/" && normalized.startsWith(`${candidate.pathname}/`)),
    ) ?? fallbackRoute;

  const routePosition = SOCIAL_PREVIEW_ROUTES.findIndex(
    (candidate) => candidate.route === definition.route,
  );
  const routeIndex = [
    String(routePosition + 1).padStart(2, "0"),
    String(SOCIAL_PREVIEW_ROUTES.length).padStart(2, "0"),
  ].join(" / ");

  // A document keeps the "snippets" route so its image path and route index
  // stay `/snippets/social-image.png` and `04 / 10`; only the copy is unique.
  if (snippetDocument) {
    const derived = deriveSnippetDocumentMetadata(snippetDocument.slug);
    return {
      ...definition,
      title: derived.title,
      description: derived.description,
      imageAlt: `${derived.title} — Syn-Forge social preview`,
      routeIndex,
    };
  }

  return {
    ...definition,
    imageAlt: `${definition.title} — Syn-Forge social preview`,
    routeIndex,
  };
}

export function getSocialPreviewImagePath(pathname: string) {
  const metadata = getSocialPreviewMetadata(pathname);
  return metadata.pathname === "/"
    ? SOCIAL_PREVIEW_IMAGE_SUFFIX
    : metadata.pathname + SOCIAL_PREVIEW_IMAGE_SUFFIX;
}

export function getSocialPreviewImageUrl(pathname: string, origin = SOCIAL_PREVIEW_SITE_ORIGIN) {
  return new URL(getSocialPreviewImagePath(pathname), `${origin.replace(/\/+$/, "")}/`).href;
}
