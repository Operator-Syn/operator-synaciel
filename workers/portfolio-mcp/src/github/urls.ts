import { PortfolioApiError } from "../portfolio-api/errors.ts";
import type { GitHubRepositoryRef } from "./types.ts";

export const GITHUB_MAIN_BRANCH = "main" as const;

const OWNER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/;
const REPOSITORY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$/;
const MAX_PATH_CHARACTERS = 1_024;

const SENSITIVE_BASENAMES = new Set([
  ".git-credentials",
  ".netrc",
  ".npmrc",
  ".pypirc",
  "credentials",
  "credentials.json",
  "id_dsa",
  "id_ecdsa",
  "id_ed25519",
  "id_rsa",
  "secrets.json",
  "service-account.json",
]);
const SENSITIVE_EXTENSIONS = new Set([".jks", ".key", ".keystore", ".p12", ".pem", ".pfx"]);
const BINARY_EXTENSIONS = new Set([
  ".7z",
  ".a",
  ".avif",
  ".avi",
  ".bin",
  ".bmp",
  ".class",
  ".db",
  ".dll",
  ".dmg",
  ".doc",
  ".docx",
  ".eot",
  ".exe",
  ".flac",
  ".gif",
  ".gz",
  ".ico",
  ".jar",
  ".jpeg",
  ".jpg",
  ".m4a",
  ".mkv",
  ".mov",
  ".mp3",
  ".mp4",
  ".o",
  ".otf",
  ".pdf",
  ".png",
  ".ppt",
  ".pptx",
  ".psd",
  ".rar",
  ".so",
  ".sqlite",
  ".sqlite3",
  ".tar",
  ".tgz",
  ".ttf",
  ".wav",
  ".webm",
  ".webp",
  ".woff",
  ".woff2",
  ".xls",
  ".xlsx",
  ".zip",
]);

function unsupportedProjectLink(): PortfolioApiError {
  return new PortfolioApiError(
    "The project does not link to a supported public GitHub repository.",
    400,
  );
}

function invalidPath(): PortfolioApiError {
  return new PortfolioApiError("The GitHub file path is invalid.", 400);
}

function pathExtension(pathname: string): string {
  const basename = pathname.split("/").at(-1)?.toLowerCase() ?? "";
  const dot = basename.lastIndexOf(".");
  return dot > 0 ? basename.slice(dot) : "";
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

export function normalizeGitHubFilePath(value: unknown): string {
  if (typeof value !== "string") throw invalidPath();
  const candidate = value.trim();
  if (
    !candidate ||
    candidate.length > MAX_PATH_CHARACTERS ||
    candidate.startsWith("/") ||
    candidate.endsWith("/") ||
    candidate.includes("\\") ||
    candidate.includes("\0") ||
    /%2f|%5c/i.test(candidate)
  ) {
    throw invalidPath();
  }
  const segments = candidate.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === "..")) {
    throw invalidPath();
  }
  return segments.join("/");
}

export function normalizeGitHubPathPrefix(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return normalizeGitHubFilePath(value);
}

export function isSensitiveGitHubPath(pathname: string): boolean {
  const normalized = normalizeGitHubFilePath(pathname).toLowerCase();
  const basename = normalized.split("/").at(-1) ?? "";
  if (basename === ".env" || basename.startsWith(".env.")) return true;
  if (SENSITIVE_BASENAMES.has(basename)) return true;
  if (SENSITIVE_EXTENSIONS.has(pathExtension(normalized))) return true;
  return /(?:^|\/)id_(?:rsa|dsa|ecdsa|ed25519)$/i.test(normalized);
}

export function isLikelyBinaryGitHubPath(pathname: string): boolean {
  return BINARY_EXTENSIONS.has(pathExtension(normalizeGitHubFilePath(pathname)));
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

export function getGitHubFileUrl(
  ref: GitHubRepositoryRef,
  commitSha: string,
  pathname: string,
): string {
  const encodedPath = normalizeGitHubFilePath(pathname)
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${ref.canonical_url}/blob/${encodeURIComponent(commitSha)}/${encodedPath}`;
}
