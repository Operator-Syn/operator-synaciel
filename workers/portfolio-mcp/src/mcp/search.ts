import type { PortfolioApiClient } from "../portfolio-api/index.ts";
import { getPortfolioPageUrl } from "./links.ts";
import { flattenPublicSnippets } from "./snippets.ts";

function searchTerms(query: string): string[] {
  return query
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean);
}

function matchesSearch(fields: string[], terms: string[]): number {
  const haystack = fields.join(" ").toLowerCase();
  const matched = terms.filter((term) => haystack.includes(term));
  return matched.length === terms.length ? terms.length + 1 : matched.length;
}

type ScoredSearchResult = Record<string, unknown> & { score: number };

export async function buildSearchResults(
  api: PortfolioApiClient,
  query: string,
  limit: number,
): Promise<Array<Record<string, unknown>>> {
  const terms = searchTerms(query);
  const [overview, projects, certificates, snippetTree] = await Promise.all([
    api.getOverview(),
    api.getAllProjects(),
    api.getAllCertificates(),
    api.getSnippetTree(),
  ]);
  const results: ScoredSearchResult[] = [];

  const profileScore = matchesSearch(
    [
      ...overview.profile.flatMap((item) => [item.label, item.value]),
      ...overview.sections.flatMap((section) => [
        section.title,
        ...section.items.flatMap((item) => [item.label ?? "", item.content ?? ""]),
      ]),
    ],
    terms,
  );
  if (profileScore > 0) {
    results.push({
      kind: "profile",
      title: "Syn-Forge portfolio overview",
      summary: "Identity, capabilities, home content, and public links from the portfolio.",
      url: "https://syn-forge.com/",
      score: profileScore,
    });
  }

  for (const project of projects) {
    const score = matchesSearch(
      [project.title, project.short_description, project.long_description],
      terms,
    );
    if (score > 0) {
      results.push({
        kind: "project",
        id: project.id,
        title: project.title,
        summary: project.short_description,
        url: getPortfolioPageUrl("project"),
        project_link: project.project_link,
        score,
      });
    }
  }

  for (const certificate of certificates) {
    const score = matchesSearch(
      [certificate.title, certificate.short_description, certificate.long_description],
      terms,
    );
    if (score > 0) {
      results.push({
        kind: "certificate",
        id: certificate.id,
        title: certificate.title,
        summary: certificate.short_description,
        url: getPortfolioPageUrl("certificate"),
        certificate_link: certificate.certificate_link,
        score,
      });
    }
  }

  for (const snippet of flattenPublicSnippets(snippetTree)) {
    const score = matchesSearch(
      [snippet.name, snippet.path_segments.join(" "), snippet.format ?? ""],
      terms,
    );
    if (score > 0) {
      results.push({
        kind: "snippet",
        title: snippet.name,
        summary: snippet.path_segments.join(" / "),
        ...snippet,
        score,
      });
    }
  }

  return results
    .sort(
      (left, right) =>
        right.score - left.score || String(left.title).localeCompare(String(right.title)),
    )
    .slice(0, limit)
    .map((result) => {
      const { score, ...entry } = result;
      void score;
      return entry;
    });
}
