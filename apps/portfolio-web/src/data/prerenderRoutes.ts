/**
 * The body copy that is served to a crawler before React runs.
 *
 * Every page in this app ships an empty `#root`; body content only exists after the bundle loads. Search
 * engines and link unfurlers that do not execute JavaScript therefore see headings in `<head>` and no body.
 * These fragments fix that by giving the Pages Function real markup to inject into the shell.
 *
 * This module is the single source of truth for it. The strings here are the same strings the pages render —
 * the components import them — so a copy change moves both places at once. Nothing here fetches: the heading,
 * lead and navigation are static by design, and a build with no network must still produce every fragment.
 */

import { HOME_HERO_BODY_FALLBACK, HOME_ROLE_LINE } from "./homeHeroCopy";
import { PORTFOLIO_MCP_DESCRIPTION } from "./portfolioMcp";

/** One internal navigation link, present in every fragment so a crawler can reach all seven routes. */
export interface PrerenderNavLink {
  readonly href: string;
  readonly label: string;
}

/**
 * The seven indexable public routes.
 *
 * `/netbird`, `/atelier` and `/agent` are served but deliberately excluded: they are verification and
 * app-note pages marked `noindex`, so a fragment for them would add crawlable surface the site does not want.
 */
export const PRERENDER_NAV_LINKS: readonly PrerenderNavLink[] = [
  { href: "/", label: "Home" },
  { href: "/projects", label: "Projects" },
  { href: "/certificates", label: "Certificates" },
  { href: "/snippets", label: "Snippets" },
  { href: "/ai", label: "AI" },
  { href: "/privacy-policy", label: "Privacy Policy" },
  { href: "/terms-and-conditions", label: "Terms and Conditions" },
] as const;

/** Heading and lead paragraph for one route, plus the slug its fragment file is named after. */
export interface PrerenderRoute {
  /** The route path, exactly as the middleware sees it in `URL.pathname`. */
  readonly path: string;
  /** Fragment filename stem: `/prerender/<slug>.html`. */
  readonly slug: string;
  /** The page's own `h1` text. */
  readonly heading: string;
  /** The page's own opening paragraph. */
  readonly lead: string;
}

/** Projects page heading, rendered by `Projects.tsx`. */
export const PROJECTS_HEADING = "Selected work / Project archive";
/** Projects page lead, rendered by `Projects.tsx`. */
export const PROJECTS_LEAD =
  "A focused collection of light and purposeful projects I've been working on.";
/** Certificates page heading, rendered by `Certificates.tsx`. */
export const CERTIFICATES_HEADING = "Credentials / learning archive";
/** Certificates page lead, rendered by `Certificates.tsx`. */
export const CERTIFICATES_LEAD =
  "Training completed through workshops, programs, and certifications that support continuous learning and professional growth.";
/** Snippets page heading, rendered by `Snippets.tsx`. */
export const SNIPPETS_HEADING = "Code snippets index";
/** Snippets page lead, rendered by `Snippets.tsx` as the index footer note. */
export const SNIPPETS_LEAD = "Folders open to /snippets/<name>. Markdown and PDF previews.";
/** AI page heading, rendered by `Ai.tsx`. */
export const AI_HEADING = "Portfolio, readable by agents.";
/** The sentence `Ai.tsx` appends to `PORTFOLIO_MCP_DESCRIPTION` in its lede. */
export const AI_LEAD_SUFFIX =
  "Start with a ready-to-paste request, then inspect the server contract and the evidence it can return.";
/** The AI page lede, composed exactly as `Ai.tsx` renders it. */
export const AI_LEAD = `${PORTFOLIO_MCP_DESCRIPTION} ${AI_LEAD_SUFFIX}`;
/** Privacy policy heading, rendered by `PrivacyPolicy.tsx`. */
export const PRIVACY_HEADING = "Privacy Policy";
/** Privacy policy lead, rendered by `PrivacyPolicy.tsx`. */
export const PRIVACY_LEAD =
  "This policy explains how information is handled across syn-forge.com, Operator-Syn, and personal applications that link to this page.";
/** Terms heading, rendered by `TermsAndConditions.tsx`. */
export const TERMS_HEADING = "Terms and Conditions";
/** Terms lead, rendered by `TermsAndConditions.tsx`. */
export const TERMS_LEAD =
  "These terms define the rules for using syn-forge.com, Operator-Syn, and related Syn-Forge applications that link to this page.";

/**
 * The seven prerendered routes, in navigation order.
 *
 * `/` takes its heading from the home hero's role line and its lead from the hero's own fallback paragraph,
 * so the fragment reuses that page's copy instead of describing it a second time.
 */
export const PRERENDER_ROUTES: readonly PrerenderRoute[] = [
  { path: "/", slug: "home", heading: HOME_ROLE_LINE, lead: HOME_HERO_BODY_FALLBACK },
  { path: "/projects", slug: "projects", heading: PROJECTS_HEADING, lead: PROJECTS_LEAD },
  {
    path: "/certificates",
    slug: "certificates",
    heading: CERTIFICATES_HEADING,
    lead: CERTIFICATES_LEAD,
  },
  { path: "/snippets", slug: "snippets", heading: SNIPPETS_HEADING, lead: SNIPPETS_LEAD },
  { path: "/ai", slug: "ai", heading: AI_HEADING, lead: AI_LEAD },
  { path: "/privacy-policy", slug: "privacy", heading: PRIVACY_HEADING, lead: PRIVACY_LEAD },
  { path: "/terms-and-conditions", slug: "terms", heading: TERMS_HEADING, lead: TERMS_LEAD },
] as const;

/**
 * Resolve the fragment slug for a request path.
 *
 * Algorithm:
 * 1. Compare against every prerendered route path.
 * 2. Return its slug on an exact match.
 * 3. Return `null` for anything else, so utility routes, snippet documents and 404s get the untouched shell.
 *
 * Slugs are explicit rather than derived from the path because `/privacy-policy` must not collide with a
 * future `/privacy` page and because the writer and the reader share this one function.
 *
 * @param pathname The request's `URL.pathname`.
 * @returns The fragment slug, or `null` when this path is not prerendered.
 */
export function prerenderSlugFor(pathname: string): string | null {
  for (const route of PRERENDER_ROUTES) {
    if (route.path === pathname) return route.slug;
  }
  return null;
}

/** Escape the five characters that would otherwise break out of text or an attribute value. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** One archive row an enriched fragment may carry. */
export interface PrerenderItem {
  readonly title: string;
  readonly description?: string;
}

/** Optional data a route's fragment can carry when the build could reach the API. */
export interface PrerenderEnrichment {
  /** Count line, already formatted, e.g. `[ 8 projects ]`. */
  readonly count?: string;
  /** Archive rows, in render order. */
  readonly items?: readonly PrerenderItem[];
}

/**
 * Render one route's fragment.
 *
 * Algorithm:
 * 1. Open a `<main>` with a stable class so the stylesheet can style the pre-mount moment and the test can
 *    find it.
 * 2. Emit the `h1`, then the lead paragraph — both escaped.
 * 3. Emit the optional count line, when the caller supplied one.
 * 4. Emit a `<nav>` holding every route link, so the fragment always exposes all seven routes to a crawler.
 * 5. Emit the optional `<ul>` of archive rows, when the caller supplied any.
 * 6. Close the `<main>` and return the string.
 *
 * No `<script>`, no inline `style`, no external asset: the fragment must not need anything the CSP or the
 * network would have to allow.
 *
 * @param route The route descriptor.
 * @param enrichment Optional count and rows; omitted is a valid, complete fragment.
 * @returns The HTML fragment, ready to be injected into `#root`.
 */
export function buildPrerenderFragment(
  route: PrerenderRoute,
  enrichment: PrerenderEnrichment = {},
): string {
  const nav = PRERENDER_NAV_LINKS.map(
    (link) => `<li><a href="${escapeHtml(link.href)}">${escapeHtml(link.label)}</a></li>`,
  ).join("");
  const count =
    enrichment.count === undefined
      ? ""
      : `<p class="prerender-count">${escapeHtml(enrichment.count)}</p>`;
  const items = enrichment.items?.length
    ? `<ul class="prerender-items">${enrichment.items
        .map(
          (item) =>
            `<li><h2>${escapeHtml(item.title)}</h2>${
              item.description ? `<p>${escapeHtml(item.description)}</p>` : ""
            }</li>`,
        )
        .join("")}</ul>`
    : "";

  return `<main class="prerender-body" id="prerender-body"><h1>${escapeHtml(route.heading)}</h1><p class="prerender-lead">${escapeHtml(route.lead)}</p>${count}<nav aria-label="Site sections"><ul>${nav}</ul></nav>${items}</main>`;
}
