import { spawnSync } from "node:child_process";
import { lstat, readFile } from "node:fs/promises";
import type { RepositoryReasonCode } from "./errors.ts";
import { RepositoryDomainError } from "./errors.ts";
import {
  digestBytes,
  isLikelyBinaryPath,
  MAX_FILE_BYTES,
  PROJECT_ROOT,
  safeAbsolutePath,
  validateLocalProjectRoot,
  validateRelativeProjectPath,
} from "./path.ts";
import { isProfilePathAllowed, type RepositoryWriteProfile } from "./policy.ts";
import {
  isCredentialLikeContent,
  isSafeEnvironmentFileContent,
  isSensitivePath,
} from "./redaction.ts";

export const MAX_SEARCH_RESULTS = 200;
export const DEFAULT_SEARCH_RESULTS = 40;
export const MAX_SEARCH_CANDIDATE_FILES = 5_000;
export const MAX_SEARCH_BYTES = 32 * 1024 * 1024;
export const MAX_SEARCH_QUERY_CHARACTERS = 1_000;
export const MAX_SEARCH_PREVIEW_CHARACTERS = 512;

export type SearchRepositoryRequest = {
  readonly profile: RepositoryWriteProfile;
  readonly query: string;
  readonly roots?: readonly string[];
  readonly caseSensitive?: boolean;
  readonly offset?: number;
  readonly maxResults?: number;
};

export type SearchRepositoryMatch = {
  readonly path: string;
  readonly line: number;
  readonly column: number;
  readonly preview: string;
  readonly sha256: string;
};

export type SearchRepositoryResult = {
  readonly status: "ok";
  readonly profile: RepositoryWriteProfile;
  readonly query: string;
  readonly matches: readonly SearchRepositoryMatch[];
  readonly offset: number;
  readonly nextOffset: number | null;
  readonly truncated: boolean;
  readonly scannedFiles: number;
  readonly scannedBytes: number;
  readonly omittedPaths: readonly string[];
  readonly reasonCode?: RepositoryReasonCode;
  readonly retryable?: boolean;
};

function gitVisibleFiles(): string[] {
  const result = spawnSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    {
      cwd: PROJECT_ROOT,
      encoding: "utf8",
      timeout: 10_000,
      maxBuffer: 8 * 1024 * 1024,
      shell: false,
    },
  );
  if (result.status !== 0) {
    throw new RepositoryDomainError(
      "The repository file index could not be read.",
      "INTERNAL_ERROR",
    );
  }
  return [...new Set(result.stdout.split("\0").filter(Boolean))].sort();
}

function pathMatchesRoot(path: string, root: string): boolean {
  return path === root || path.startsWith(`${root}/`);
}

function validateSearchRoots(
  profile: RepositoryWriteProfile,
  roots: readonly string[] | undefined,
): string[] | undefined {
  if (roots === undefined) return undefined;
  if (roots.length === 0 || roots.length > 20) {
    throw new RepositoryDomainError(
      "Search roots must contain between 1 and 20 exact paths.",
      "PROFILE_DENIED",
    );
  }
  const normalized = roots.map((root) =>
    validateRelativeProjectPath(root, { allowRestrictedPaths: true }),
  );
  if (new Set(normalized).size !== normalized.length) {
    throw new RepositoryDomainError("Duplicate search roots are not allowed.", "PROFILE_DENIED");
  }
  for (const root of normalized) {
    const probe = `${root}/__repository_search_probe__`;
    if (!isProfilePathAllowed(profile, root) && !isProfilePathAllowed(profile, probe)) {
      throw new RepositoryDomainError(
        `Search root ${JSON.stringify(root)} is not allowed by the ${profile} read profile.`,
        "PROFILE_DENIED",
      );
    }
  }
  return normalized;
}

function safePreview(line: string): string {
  const preview = line.replace(/\r$/, "");
  return preview.length <= MAX_SEARCH_PREVIEW_CHARACTERS
    ? preview
    : `${preview.slice(0, MAX_SEARCH_PREVIEW_CHARACTERS - 1)}…`;
}

function matchingColumns(line: string, query: string, caseSensitive: boolean): number[] {
  const haystack = caseSensitive ? line : line.toLowerCase();
  const needle = caseSensitive ? query : query.toLowerCase();
  const columns: number[] = [];
  let index = haystack.indexOf(needle);
  while (index >= 0) {
    columns.push(index);
    index = haystack.indexOf(needle, index + Math.max(needle.length, 1));
  }
  return columns;
}

export async function searchRepository(
  request: SearchRepositoryRequest,
): Promise<SearchRepositoryResult> {
  const root = await validateLocalProjectRoot();
  if (!root.valid) throw new Error(root.reason);
  if (
    request.query.length === 0 ||
    request.query.length > MAX_SEARCH_QUERY_CHARACTERS ||
    request.query.includes("\0")
  ) {
    throw new RepositoryDomainError(
      `Search query must contain between 1 and ${MAX_SEARCH_QUERY_CHARACTERS.toLocaleString()} characters.`,
      "INVALID_REQUEST",
    );
  }
  const offset = request.offset ?? 0;
  const maxResults = request.maxResults ?? DEFAULT_SEARCH_RESULTS;
  if (!Number.isInteger(offset) || offset < 0) {
    throw new RepositoryDomainError(
      "Search offset must be a non-negative integer.",
      "INVALID_REQUEST",
    );
  }
  if (!Number.isInteger(maxResults) || maxResults < 1 || maxResults > MAX_SEARCH_RESULTS) {
    throw new RepositoryDomainError(
      `maxResults must be between 1 and ${MAX_SEARCH_RESULTS}.`,
      "INVALID_REQUEST",
    );
  }

  const roots = validateSearchRoots(request.profile, request.roots);
  const caseSensitive = request.caseSensitive ?? false;
  const matches: SearchRepositoryMatch[] = [];
  const omittedPaths: string[] = [];
  let scannedFiles = 0;
  let scannedBytes = 0;
  let seenMatches = 0;
  let truncated = false;

  for (const path of gitVisibleFiles()) {
    if (!isProfilePathAllowed(request.profile, path)) continue;
    if (roots && !roots.some((rootPath) => pathMatchesRoot(path, rootPath))) continue;
    if (scannedFiles >= MAX_SEARCH_CANDIDATE_FILES || scannedBytes >= MAX_SEARCH_BYTES) {
      truncated = true;
      break;
    }
    if (isSensitivePath(path) || isLikelyBinaryPath(path)) {
      continue;
    }

    const { absolutePath } = await safeAbsolutePath(path).catch(() => ({ absolutePath: null }));
    if (!absolutePath) continue;
    const info = await lstat(absolutePath).catch(() => null);
    if (!info?.isFile() || info.size > MAX_FILE_BYTES) {
      omittedPaths.push(path);
      continue;
    }
    if (scannedBytes + info.size > MAX_SEARCH_BYTES) {
      truncated = true;
      break;
    }
    const bytes = await readFile(absolutePath);
    const content = bytes.toString("utf8");
    scannedFiles += 1;
    scannedBytes += bytes.byteLength;
    if (
      content.includes("\0") ||
      !Buffer.from(content, "utf8").equals(bytes) ||
      isCredentialLikeContent(content) ||
      !isSafeEnvironmentFileContent(path, content)
    ) {
      continue;
    }

    const lines = content.split("\n");
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      for (const column of matchingColumns(lines[lineIndex], request.query, caseSensitive)) {
        if (seenMatches < offset) {
          seenMatches += 1;
          continue;
        }
        if (matches.length >= maxResults) {
          truncated = true;
          break;
        }
        matches.push({
          path,
          line: lineIndex + 1,
          column: column + 1,
          preview: safePreview(lines[lineIndex]),
          sha256: digestBytes(bytes),
        });
        seenMatches += 1;
      }
      if (truncated) break;
    }
    if (truncated) break;
  }

  return {
    status: "ok",
    profile: request.profile,
    query: request.query,
    matches,
    offset,
    nextOffset: truncated ? offset + matches.length : null,
    truncated,
    scannedFiles,
    scannedBytes,
    omittedPaths,
    ...(truncated ? { reasonCode: "SEARCH_LIMIT_REACHED" as const, retryable: true } : {}),
  };
}
