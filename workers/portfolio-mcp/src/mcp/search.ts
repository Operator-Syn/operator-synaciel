import type { PortfolioApiClient } from "../portfolio-api/index.ts";
import { getPortfolioPageUrl } from "./links.ts";
import { flattenPublicSnippets, type PublicSnippet } from "./snippets.ts";

export type SearchMode = "broad" | "all";

type SearchField = {
  name: string;
  value: string;
};

type SearchMatch = {
  score: number;
  matchedTerms: string[];
  matchedFields: string[];
};

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[‐‑‒–—−]/gu, "-")
    .replace(/[^\p{L}\p{N}+#._-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Split only the terms the caller supplied; no word changes domain or intent. */
export function parseSearchTerms(query: string): string[] {
  return [
    ...new Set(
      normalizeSearchText(query)
        .split(/\s+/)
        .map((term) => term.replace(/^[._-]+|[._-]+$/g, ""))
        .filter(Boolean),
    ),
  ];
}

function matchesSearch(
  fields: SearchField[],
  terms: string[],
  mode: SearchMode,
): SearchMatch | null {
  const matchedTerms = terms.filter((term) =>
    fields.some((field) => normalizeSearchText(field.value).includes(term)),
  );
  const matchedFields = [
    ...new Set(
      fields
        .filter((field) => terms.some((term) => normalizeSearchText(field.value).includes(term)))
        .map((field) => field.name),
    ),
  ];
  const matches = mode === "all" ? matchedTerms.length === terms.length : matchedTerms.length > 0;
  if (!matches) return null;

  return {
    score: matchedTerms.length === terms.length ? terms.length + 1 : matchedTerms.length,
    matchedTerms,
    matchedFields,
  };
}

export type SearchResult =
  | {
      kind: "profile";
      title: string;
      summary: string;
      url: string;
      matched_terms: string[];
      matched_fields: string[];
    }
  | {
      kind: "project";
      id: number;
      title: string;
      summary: string;
      url: string;
      project_link: string;
      matched_terms: string[];
      matched_fields: string[];
    }
  | {
      kind: "certificate";
      id: number;
      title: string;
      summary: string;
      url: string;
      certificate_link: string | null;
      matched_terms: string[];
      matched_fields: string[];
    }
  | (PublicSnippet & {
      kind: "snippet";
      title: string;
      summary: string;
      matched_terms: string[];
      matched_fields: string[];
    });

type ScoredSearchResult = SearchResult & { score: number };

export async function buildSearchResults(
  api: PortfolioApiClient,
  query: string,
  limit: number,
  mode: SearchMode = "broad",
): Promise<SearchResult[]> {
  const terms = parseSearchTerms(query);
  if (terms.length === 0) return [];

  const [overview, projects, certificates, snippetTree] = await Promise.all([
    api.getOverview(),
    api.getAllProjects(),
    api.getAllCertificates(),
    api.getSnippetTree(),
  ]);
  const results: ScoredSearchResult[] = [];

  const profileFields: SearchField[] = [
    ...overview.profile.map((item) => ({
      name: "profile",
      value: `${item.label} ${item.value}`,
    })),
    ...overview.sections.flatMap((section) => [
      { name: "section.title", value: section.title },
      ...section.items.flatMap((item) => [
        { name: "section.item.label", value: item.label ?? "" },
        { name: "section.item.content", value: item.content ?? "" },
        { name: "section.item.target_url", value: item.target_url ?? "" },
      ]),
    ]),
  ];
  const profileMatch = matchesSearch(profileFields, terms, mode);
  if (profileMatch) {
    results.push({
      kind: "profile",
      title: "Syn-Forge portfolio overview",
      summary: "Identity, capabilities, home content, and public links from the portfolio.",
      url: "https://syn-forge.com/",
      matched_terms: profileMatch.matchedTerms,
      matched_fields: profileMatch.matchedFields,
      score: profileMatch.score,
    });
  }

  for (const project of projects) {
    const match = matchesSearch(
      [
        { name: "title", value: project.title },
        { name: "short_description", value: project.short_description },
        { name: "long_description", value: project.long_description },
      ],
      terms,
      mode,
    );
    if (!match) continue;
    results.push({
      kind: "project",
      id: project.id,
      title: project.title,
      summary: project.short_description,
      url: getPortfolioPageUrl("project"),
      project_link: project.project_link,
      matched_terms: match.matchedTerms,
      matched_fields: match.matchedFields,
      score: match.score,
    });
  }

  for (const certificate of certificates) {
    const match = matchesSearch(
      [
        { name: "title", value: certificate.title },
        { name: "short_description", value: certificate.short_description },
        { name: "long_description", value: certificate.long_description },
      ],
      terms,
      mode,
    );
    if (!match) continue;
    results.push({
      kind: "certificate",
      id: certificate.id,
      title: certificate.title,
      summary: certificate.short_description,
      url: getPortfolioPageUrl("certificate"),
      certificate_link: certificate.certificate_link,
      matched_terms: match.matchedTerms,
      matched_fields: match.matchedFields,
      score: match.score,
    });
  }

  for (const snippet of flattenPublicSnippets(snippetTree)) {
    const match = matchesSearch(
      [
        { name: "name", value: snippet.name },
        { name: "path_segments", value: snippet.path_segments.join(" ") },
        { name: "format", value: snippet.format ?? "" },
      ],
      terms,
      mode,
    );
    if (!match) continue;
    results.push({
      kind: "snippet",
      id: snippet.id,
      name: snippet.name,
      format: snippet.format,
      modified: snippet.modified,
      size: snippet.size,
      path_segments: [...snippet.path_segments],
      page_url: snippet.page_url,
      download_url: snippet.download_url,
      title: snippet.name,
      summary: snippet.path_segments.join(" / "),
      matched_terms: match.matchedTerms,
      matched_fields: match.matchedFields,
      score: match.score,
    });
  }

  return results
    .sort(
      (left, right) =>
        right.score - left.score || String(left.title).localeCompare(String(right.title)),
    )
    .slice(0, limit)
    .map((result): SearchResult => {
      const { score, ...entry } = result;
      void score;
      return entry;
    });
}
