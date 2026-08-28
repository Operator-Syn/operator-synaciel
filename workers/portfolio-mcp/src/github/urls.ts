import { PortfolioApiError } from "../portfolio-api/errors.ts";
import type { GitHubRepositoryRef } from "./types.ts";

export const GITHUB_MAIN_BRANCH = "main" as const;

const OWNER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/;
const REPOSITORY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$/;

function unsupportedProjectLink(): PortfolioApiError {
  return new PortfolioApiError(
    "The project does not link to a supported public GitHub repository.",
    400,
  );
}

export function parseGitHubRepositoryUrl(value: unknown): GitHubRepositoryRef {
  if (typeof value !== "string") throw unsupportedProjectLink();
  const candidate = value.trim();
  if (!candidate || candidate.length > 2_048) throw unsupportedProjectLink();

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw unsupportedProjectLink();
  }

  if (
    url.protocol !== "https:" ||
    url.hostname.toLowerCase() !== "github.com" ||
    url.port ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    candidate.includes("?") ||
    candidate.includes("#")
  ) {
    throw unsupportedProjectLink();
  }

  const segments = url.pathname.split("/").slice(1);
  if (segments.at(-1) === "") segments.pop();
  if (segments.length !== 2) throw unsupportedProjectLink();

  const owner = segments[0];
  let name = segments[1];
  if (!owner || !name) throw unsupportedProjectLink();

  if (name.endsWith(".git")) name = name.slice(0, -4);
  if (!OWNER_PATTERN.test(owner) || !REPOSITORY_PATTERN.test(name)) {
    throw unsupportedProjectLink();
  }

  const normalizedOwner = owner.toLowerCase();
  const normalizedName = name.toLowerCase();
  return {
    owner: normalizedOwner,
    name: normalizedName,
    canonical_url: `https://github.com/${normalizedOwner}/${normalizedName}`,
  };
}

export function getGitHubApiRepositoryPath(ref: GitHubRepositoryRef): string {
  return `/repos/${encodeURIComponent(ref.owner)}/${encodeURIComponent(ref.name)}`;
}

export function getGitHubRepositoryUrl(ref: GitHubRepositoryRef): string {
  return ref.canonical_url;
}

export function getGitHubReadmeUrl(ref: GitHubRepositoryRef): string {
  return `${ref.canonical_url}/blob/${GITHUB_MAIN_BRANCH}/README.md`;
}

export function getGitHubCommitUrl(ref: GitHubRepositoryRef, sha: string): string {
  return `${ref.canonical_url}/commit/${encodeURIComponent(sha)}`;
}
