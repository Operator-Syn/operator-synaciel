import {
  GITHUB_COMMIT_FILE_LIMIT,
  GITHUB_COMMIT_MESSAGE_MAX_CHARACTERS,
  GITHUB_FILE_MAX_BYTES,
  GITHUB_README_MAX_CHARACTERS,
  GITHUB_TREE_FILE_LIMIT,
} from "../config.ts";
import { PortfolioApiError } from "../portfolio-api/errors.ts";
import { createGitHubTransport, GITHUB_CACHE_TTLS } from "./transport.ts";
import type {
  GitHubChangedFile,
  GitHubClient,
  GitHubClientOptions,
  GitHubCommitDetails,
  GitHubCommitPage,
  GitHubCommitSummary,
  GitHubFile,
  GitHubFileMetadata,
  GitHubFilePage,
  GitHubReadme,
  GitHubRepositoryMetadata,
  GitHubRepositoryRef,
  GitHubTreeFile,
} from "./types.ts";
import {
  GITHUB_MAIN_BRANCH,
  getGitHubApiRepositoryPath,
  getGitHubCommitUrl,
  getGitHubFileUrl,
  isLikelyBinaryGitHubPath,
  isSensitiveGitHubPath,
  normalizeGitHubFilePath,
  normalizeGitHubPathPrefix,
} from "./urls.ts";

const SHA_PATTERN = /^[0-9a-f]{40}$/i;

type GitHubRepositoryResponse = {
  private?: unknown;
  visibility?: unknown;
  description?: unknown;
};

type GitHubBranchResponse = {
  name?: unknown;
  commit?: { sha?: unknown };
};

type GitHubContentResponse = {
  name?: unknown;
  path?: unknown;
  type?: unknown;
  encoding?: unknown;
  content?: unknown;
};

type GitHubCommitResponse = {
  sha?: unknown;
  commit?: {
    message?: unknown;
    author?: { name?: unknown; date?: unknown };
    committer?: { date?: unknown };
  };
  author?: { login?: unknown };
  files?: Array<{
    filename?: unknown;
    status?: unknown;
    additions?: unknown;
    deletions?: unknown;
    changes?: unknown;
  }>;
};

type GitHubCompareResponse = {
  merge_base_commit?: { sha?: unknown };
};

type GitHubTreeEntryResponse = {
  path?: unknown;
  mode?: unknown;
  type?: unknown;
  sha?: unknown;
  size?: unknown;
};

type GitHubTreeResponse = {
  sha?: unknown;
  truncated?: unknown;
  tree?: unknown;
};

type GitHubBlobResponse = {
  sha?: unknown;
  size?: unknown;
  encoding?: unknown;
  content?: unknown;
};

type GitHubTreeEntry = GitHubTreeFile & { mode: string };

type GitHubTreeResult = {
  commit_sha: string;
  entries: GitHubTreeEntry[];
  tree_truncated: boolean;
};

function isUnavailable(error: unknown): boolean {
  return error instanceof PortfolioApiError && (error.status === 404 || error.status === 409);
}

function isCommitUnavailable(error: unknown): boolean {
  return (
    error instanceof PortfolioApiError &&
    (error.status === 404 || error.status === 409 || error.status === 422)
  );
}

async function optional<T>(read: () => Promise<T>): Promise<T | null> {
  try {
    return await read();
  } catch (error) {
    if (isUnavailable(error)) return null;
    throw error;
  }
}

function boundedString(value: unknown, maximum: number, fallback = ""): string {
  return typeof value === "string" ? value.slice(0, maximum) : fallback;
}

function nullableString(value: unknown, maximum: number): string | null {
  if (typeof value !== "string" || value.length === 0) return null;
  return value.slice(0, maximum);
}

function safeCount(value: unknown): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function requireSha(value: unknown): string {
  if (typeof value !== "string" || !SHA_PATTERN.test(value)) {
    throw new PortfolioApiError("GitHub returned an invalid object SHA.", 502);
  }
  return value.toLowerCase();
}

function hasNextPage(headers: Headers): boolean {
  return (
    headers
      .get("link")
      ?.split(",")
      .some((link) => /;\s*rel="next"\s*$/i.test(link.trim())) ?? false
  );
}

function decodeBase64Bytes(value: string): Uint8Array {
  try {
    const binary = atob(value.replace(/\s/g, ""));
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    throw new PortfolioApiError("GitHub returned an invalid encoded document.", 502);
  }
}

function decodeBase64Text(value: string, label: string): string {
  try {
    return new TextDecoder().decode(decodeBase64Bytes(value));
  } catch {
    throw new PortfolioApiError(`GitHub returned an invalid ${label}.`, 502);
  }
}

function decodeSourceText(bytes: Uint8Array): string | null {
  if (bytes.includes(0)) return null;
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    let controls = 0;
    for (const character of text) {
      const code = character.charCodeAt(0);
      if ((code >= 1 && code <= 8) || code === 11 || code === 12 || (code >= 14 && code <= 31)) {
        controls += 1;
      }
    }
    return controls > Math.max(8, Math.floor(text.length * 0.02)) ? null : text;
  } catch {
    return null;
  }
}

function normalizeCommit(
  ref: GitHubRepositoryRef,
  value: GitHubCommitResponse,
): GitHubCommitSummary {
  const sha = requireSha(value.sha);
  return {
    sha,
    message: boundedString(value.commit?.message, GITHUB_COMMIT_MESSAGE_MAX_CHARACTERS),
    author: {
      login: nullableString(value.author?.login, 100),
      name: nullableString(value.commit?.author?.name, 200),
    },
    authored_at: nullableString(value.commit?.author?.date, 64),
    committed_at: nullableString(value.commit?.committer?.date, 64),
    canonical_url: getGitHubCommitUrl(ref, sha),
  };
}

function normalizeChangedFile(
  value: NonNullable<GitHubCommitResponse["files"]>[number],
): GitHubChangedFile {
  return {
    filename: boundedString(value.filename, 512, "(unnamed file)"),
    status: boundedString(value.status, 32, "unknown"),
    additions: safeCount(value.additions),
    deletions: safeCount(value.deletions),
    changes: safeCount(value.changes),
  };
}

function isPublicRepository(value: GitHubRepositoryResponse): boolean {
  return (
    value.private === false && (value.visibility === undefined || value.visibility === "public")
  );
}

export function createGitHubClient(options: GitHubClientOptions = {}): GitHubClient {
  const transport = createGitHubTransport(options);

  async function requirePublicRepository(
    ref: GitHubRepositoryRef,
  ): Promise<GitHubRepositoryResponse> {
    const response = await transport.getJson<GitHubRepositoryResponse>(
      getGitHubApiRepositoryPath(ref),
      0,
      ref,
    );
    if (!isPublicRepository(response.data)) {
      throw new PortfolioApiError("The linked GitHub repository is not public.", 404);
    }
    return response.data;
  }

  async function getMainBranch(ref: GitHubRepositoryRef): Promise<GitHubBranchResponse> {
    const response = await transport.getJson<GitHubBranchResponse>(
      `${getGitHubApiRepositoryPath(ref)}/branches/${GITHUB_MAIN_BRANCH}`,
      GITHUB_CACHE_TTLS.commitReachability,
      ref,
    );
    if (
      response.data.name !== GITHUB_MAIN_BRANCH ||
      typeof response.data.commit?.sha !== "string"
    ) {
      throw new PortfolioApiError("GitHub did not expose a main branch.", 404);
    }
    requireSha(response.data.commit.sha);
    return response.data;
  }

  async function getReadmePayload(ref: GitHubRepositoryRef): Promise<GitHubContentResponse> {
    const path = `${getGitHubApiRepositoryPath(ref)}/contents/README.md?ref=${GITHUB_MAIN_BRANCH}`;
    const response = await transport.getJson<GitHubContentResponse>(
      path,
      GITHUB_CACHE_TTLS.readme,
      ref,
    );
    if (
      response.data.type !== "file" ||
      response.data.name !== "README.md" ||
      response.data.path !== "README.md"
    ) {
      throw new PortfolioApiError("GitHub did not return the root README.md.", 502);
    }
    return response.data;
  }

  async function listCommits(ref: GitHubRepositoryRef, limit: number, page: number) {
    const search = new URLSearchParams({
      page: String(page),
      per_page: String(limit),
      sha: GITHUB_MAIN_BRANCH,
    });
    const response = await transport.getJson<GitHubCommitResponse[]>(
      `${getGitHubApiRepositoryPath(ref)}/commits?${search.toString()}`,
      GITHUB_CACHE_TTLS.commitList,
      ref,
    );
    if (!Array.isArray(response.data)) {
      throw new PortfolioApiError("GitHub returned an invalid commit list.", 502);
    }

    return {
      commits: response.data.map((commit) => normalizeCommit(ref, commit)),
      has_more: hasNextPage(response.headers),
    };
  }

  async function getCommitDetails(
    ref: GitHubRepositoryRef,
    sha: string,
  ): Promise<GitHubCommitDetails> {
    const comparisonPath = `${getGitHubApiRepositoryPath(ref)}/compare/${encodeURIComponent(sha)}...${GITHUB_MAIN_BRANCH}?per_page=1`;
    let comparison: Awaited<ReturnType<typeof transport.getJson<GitHubCompareResponse>>>;
    try {
      comparison = await transport.getJson<GitHubCompareResponse>(
        comparisonPath,
        GITHUB_CACHE_TTLS.commitReachability,
        ref,
      );
    } catch (error) {
      if (isCommitUnavailable(error)) {
        throw new PortfolioApiError("The requested commit is not reachable from main.", 404);
      }
      throw error;
    }
    const mergeBaseSha = comparison.data.merge_base_commit?.sha;
    if (typeof mergeBaseSha !== "string" || mergeBaseSha.toLowerCase() !== sha.toLowerCase()) {
      throw new PortfolioApiError("The requested commit is not reachable from main.", 404);
    }

    const response = await transport.getJson<GitHubCommitResponse>(
      `${getGitHubApiRepositoryPath(ref)}/commits/${encodeURIComponent(sha)}`,
      GITHUB_CACHE_TTLS.commit,
      ref,
    );
    const summary = normalizeCommit(ref, response.data);
    if (summary.sha !== sha.toLowerCase()) {
      throw new PortfolioApiError("GitHub returned a different commit.", 502);
    }
    const rawFiles = Array.isArray(response.data.files) ? response.data.files : [];
    return {
      ...summary,
      files: rawFiles.slice(0, GITHUB_COMMIT_FILE_LIMIT).map(normalizeChangedFile),
      files_truncated: rawFiles.length > GITHUB_COMMIT_FILE_LIMIT || hasNextPage(response.headers),
    };
  }

  async function getMainTree(ref: GitHubRepositoryRef): Promise<GitHubTreeResult> {
    const main = await getMainBranch(ref);
    const commitSha = requireSha(main.commit?.sha);
    const response = await transport.getJson<GitHubTreeResponse>(
      `${getGitHubApiRepositoryPath(ref)}/git/trees/${commitSha}?recursive=1`,
      GITHUB_CACHE_TTLS.tree,
      ref,
    );
    if (!Array.isArray(response.data.tree)) {
      throw new PortfolioApiError("GitHub returned an invalid repository tree.", 502);
    }

    const entries: GitHubTreeEntry[] = [];
    for (const candidate of response.data.tree as GitHubTreeEntryResponse[]) {
      if (
        candidate.type !== "blob" ||
        typeof candidate.mode !== "string" ||
        !candidate.mode.startsWith("100") ||
        typeof candidate.path !== "string"
      ) {
        continue;
      }
      try {
        const path = normalizeGitHubFilePath(candidate.path);
        if (isSensitiveGitHubPath(path)) continue;
        entries.push({
          path,
          size: safeCount(candidate.size),
          blob_sha: requireSha(candidate.sha),
          mode: candidate.mode,
        });
      } catch {
        // Invalid or unsafe GitHub paths are not exposed to callers.
      }
      if (entries.length >= GITHUB_TREE_FILE_LIMIT) break;
    }

    entries.sort((left, right) => left.path.localeCompare(right.path));
    return {
      commit_sha: commitSha,
      entries,
      tree_truncated: response.data.truncated === true || entries.length >= GITHUB_TREE_FILE_LIMIT,
    };
  }

  async function getRepository(ref: GitHubRepositoryRef): Promise<GitHubRepositoryMetadata> {
    const repository = await requirePublicRepository(ref);
    const description = nullableString(repository.description, 500);

    const main = await optional(() => getMainBranch(ref));
    if (!main) {
      return {
        ...ref,
        full_name: `${ref.owner}/${ref.name}`,
        description,
        branch: GITHUB_MAIN_BRANCH,
        main_available: false,
        main_sha: null,
        readme_available: false,
        commit_history_available: false,
      };
    }

    const [readme, commits] = await Promise.all([
      optional(() => getReadmePayload(ref)),
      optional(() => listCommits(ref, 1, 1)),
    ]);

    return {
      ...ref,
      full_name: `${ref.owner}/${ref.name}`,
      description,
      branch: GITHUB_MAIN_BRANCH,
      main_available: true,
      main_sha: requireSha(main.commit?.sha),
      readme_available: readme !== null,
      commit_history_available: commits !== null && commits.commits.length > 0,
    };
  }

  async function getReadme(ref: GitHubRepositoryRef): Promise<GitHubReadme> {
    await requirePublicRepository(ref);
    const payload = await getReadmePayload(ref);
    if (payload.encoding !== "base64" || typeof payload.content !== "string") {
      throw new PortfolioApiError("GitHub returned an unreadable README.", 502);
    }

    const text = decodeBase64Text(payload.content, "README");
    if (text.length > GITHUB_README_MAX_CHARACTERS) {
      throw new PortfolioApiError("The GitHub README exceeds the public MCP limit.", 413);
    }
    return { text };
  }

  async function listRepositoryCommits(
    ref: GitHubRepositoryRef,
    limit: number,
    page: number,
  ): Promise<GitHubCommitPage> {
    await requirePublicRepository(ref);
    return listCommits(ref, limit, page);
  }

  async function getRepositoryCommit(
    ref: GitHubRepositoryRef,
    sha: string,
  ): Promise<GitHubCommitDetails> {
    await requirePublicRepository(ref);
    return getCommitDetails(ref, sha);
  }

  async function listFiles(
    ref: GitHubRepositoryRef,
    rawPrefix: string | undefined,
    offset: number,
    limit: number,
  ): Promise<GitHubFilePage> {
    await requirePublicRepository(ref);
    const prefix = normalizeGitHubPathPrefix(rawPrefix);
    const tree = await getMainTree(ref);
    const readable = tree.entries.filter((entry) => !isLikelyBinaryGitHubPath(entry.path));
    const matching = prefix
      ? readable.filter((entry) => entry.path === prefix || entry.path.startsWith(`${prefix}/`))
      : readable;
    const page = matching.slice(offset, offset + limit);
    const nextOffset = offset + page.length;
    const hasMore = nextOffset < matching.length;
    return {
      commit_sha: tree.commit_sha,
      files: page.map(({ path, size, blob_sha }) => ({ path, size, blob_sha })),
      total_files: matching.length,
      tree_truncated: tree.tree_truncated,
      has_more: hasMore,
      next_offset: hasMore ? nextOffset : null,
    };
  }

  async function getFile(ref: GitHubRepositoryRef, rawPath: string): Promise<GitHubFile> {
    await requirePublicRepository(ref);
    const path = normalizeGitHubFilePath(rawPath);
    if (isSensitiveGitHubPath(path)) {
      throw new PortfolioApiError("The requested GitHub file is not available.", 404);
    }

    const tree = await getMainTree(ref);
    const file = tree.entries.find((entry) => entry.path === path);
    if (!file) {
      throw new PortfolioApiError("The requested GitHub file is not available.", 404);
    }

    const metadata: GitHubFileMetadata = {
      commit_sha: tree.commit_sha,
      path: file.path,
      size: file.size,
      blob_sha: file.blob_sha,
      canonical_url: getGitHubFileUrl(ref, tree.commit_sha, file.path),
    };
    if (isLikelyBinaryGitHubPath(path)) {
      return { ...metadata, content_available: false, reason: "binary" };
    }
    if (file.size > GITHUB_FILE_MAX_BYTES) {
      return { ...metadata, content_available: false, reason: "too_large" };
    }

    const response = await transport.getJson<GitHubBlobResponse>(
      `${getGitHubApiRepositoryPath(ref)}/git/blobs/${file.blob_sha}`,
      GITHUB_CACHE_TTLS.blob,
      ref,
    );
    if (
      requireSha(response.data.sha) !== file.blob_sha ||
      response.data.encoding !== "base64" ||
      typeof response.data.content !== "string"
    ) {
      throw new PortfolioApiError("GitHub returned an unreadable source file.", 502);
    }
    const bytes = decodeBase64Bytes(response.data.content);
    if (bytes.byteLength > GITHUB_FILE_MAX_BYTES) {
      return { ...metadata, content_available: false, reason: "too_large" };
    }
    const text = decodeSourceText(bytes);
    if (text === null) return { ...metadata, content_available: false, reason: "binary" };
    return { ...metadata, content_available: true, text };
  }

  return {
    getRepository,
    getReadme,
    listCommits: listRepositoryCommits,
    getCommit: getRepositoryCommit,
    listFiles,
    getFile,
  };
}
