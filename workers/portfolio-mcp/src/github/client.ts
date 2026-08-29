import {
  GITHUB_COMMIT_FILE_LIMIT,
  GITHUB_COMMIT_MESSAGE_MAX_CHARACTERS,
  GITHUB_README_MAX_CHARACTERS,
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
  GitHubReadme,
  GitHubRepositoryMetadata,
  GitHubRepositoryRef,
} from "./types.ts";
import { GITHUB_MAIN_BRANCH, getGitHubApiRepositoryPath, getGitHubCommitUrl } from "./urls.ts";

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
    throw new PortfolioApiError("GitHub returned an invalid commit SHA.", 502);
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

function decodeBase64(value: string): string {
  try {
    const binary = atob(value.replace(/\s/g, ""));
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    throw new PortfolioApiError("GitHub returned an invalid README.", 502);
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

export function createGitHubClient(options: GitHubClientOptions = {}): GitHubClient {
  const transport = createGitHubTransport(options);

  async function getMainBranch(ref: GitHubRepositoryRef): Promise<GitHubBranchResponse> {
    const response = await transport.getJson<GitHubBranchResponse>(
      `${getGitHubApiRepositoryPath(ref)}/branches/${GITHUB_MAIN_BRANCH}`,
      GITHUB_CACHE_TTLS.commitReachability,
    );
    if (
      response.data.name !== GITHUB_MAIN_BRANCH ||
      typeof response.data.commit?.sha !== "string"
    ) {
      throw new PortfolioApiError("GitHub returned an invalid main branch.", 502);
    }
    requireSha(response.data.commit.sha);
    return response.data;
  }

  async function getReadmePayload(ref: GitHubRepositoryRef): Promise<GitHubContentResponse> {
    const path = `${getGitHubApiRepositoryPath(ref)}/contents/README.md?ref=${GITHUB_MAIN_BRANCH}`;
    const response = await transport.getJson<GitHubContentResponse>(path, GITHUB_CACHE_TTLS.readme);
    if (
      response.data.type !== "file" ||
      response.data.name !== "README.md" ||
      response.data.path !== "README.md"
    ) {
      throw new PortfolioApiError("GitHub did not return the root README.md.", 502);
    }
    return response.data;
  }

  async function getRepository(ref: GitHubRepositoryRef): Promise<GitHubRepositoryMetadata> {
    const response = await transport.getJson<GitHubRepositoryResponse>(
      getGitHubApiRepositoryPath(ref),
      GITHUB_CACHE_TTLS.repository,
    );
    if (
      response.data.private !== false ||
      (response.data.visibility !== undefined && response.data.visibility !== "public")
    ) {
      throw new PortfolioApiError("The linked GitHub repository is not public.", 404);
    }
    const description = nullableString(response.data.description, 500);

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
    const payload = await getReadmePayload(ref);
    if (payload.encoding !== "base64" || typeof payload.content !== "string") {
      throw new PortfolioApiError("GitHub returned an unreadable README.", 502);
    }

    const text = decodeBase64(payload.content);
    if (text.length > GITHUB_README_MAX_CHARACTERS) {
      throw new PortfolioApiError("The GitHub README exceeds the public MCP limit.", 413);
    }
    return { text };
  }

  async function listCommits(
    ref: GitHubRepositoryRef,
    limit: number,
    page: number,
  ): Promise<GitHubCommitPage> {
    const search = new URLSearchParams({
      page: String(page),
      per_page: String(limit),
      sha: GITHUB_MAIN_BRANCH,
    });
    const response = await transport.getJson<GitHubCommitResponse[]>(
      `${getGitHubApiRepositoryPath(ref)}/commits?${search.toString()}`,
      GITHUB_CACHE_TTLS.commitList,
    );
    if (!Array.isArray(response.data)) {
      throw new PortfolioApiError("GitHub returned an invalid commit list.", 502);
    }

    return {
      commits: response.data.map((commit) => normalizeCommit(ref, commit)),
      has_more: hasNextPage(response.headers),
    };
  }

  async function getCommit(ref: GitHubRepositoryRef, sha: string): Promise<GitHubCommitDetails> {
    const comparisonPath = `${getGitHubApiRepositoryPath(ref)}/compare/${encodeURIComponent(sha)}...${GITHUB_MAIN_BRANCH}?per_page=1`;
    let comparison: Awaited<ReturnType<typeof transport.getJson<GitHubCompareResponse>>>;
    try {
      comparison = await transport.getJson<GitHubCompareResponse>(
        comparisonPath,
        GITHUB_CACHE_TTLS.commitReachability,
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

  return { getRepository, getReadme, listCommits, getCommit };
}
