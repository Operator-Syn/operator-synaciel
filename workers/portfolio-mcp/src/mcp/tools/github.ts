import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import {
  GITHUB_FILE_MAX_CHARACTERS,
  MAX_GITHUB_COMMIT_PAGE,
  MAX_GITHUB_FILE_PAGE,
  MAX_LIST_LIMIT,
  MAX_SNIPPET_CHUNK_CHARACTERS,
} from "../../config.ts";
import {
  GITHUB_MAIN_BRANCH,
  type GitHubClient,
  getGitHubCommitUrl,
  getGitHubReadmeUrl,
  normalizeGitHubFilePath,
  normalizeGitHubPathPrefix,
  parseGitHubRepositoryUrl,
} from "../../github/index.ts";
import type { PortfolioApiClient } from "../../portfolio-api/index.ts";
import { errorResult, jsonResult } from "../results.ts";
import {
  getProjectCommitOutputSchema,
  getProjectFileOutputSchema,
  getProjectReadmeOutputSchema,
  getProjectRepositoryOutputSchema,
  listProjectCommitsOutputSchema,
  listProjectFilesOutputSchema,
} from "../schemas.ts";
import {
  decodeGitHubCommitCursor,
  decodeGitHubFileCursor,
  encodeGitHubCommitCursor,
  encodeGitHubFileCursor,
  safeGitHubSha,
  safeId,
  safeLimit,
} from "../validation.ts";

async function resolveProjectRepository(api: PortfolioApiClient, projectId: number) {
  const project = await api.getProject(safeId(projectId));
  return {
    project_id: project.project.id,
    repository: parseGitHubRepositoryUrl(project.project.project_link),
  };
}

export function registerGitHubProjectTools(
  server: McpServer,
  api: PortfolioApiClient,
  github: GitHubClient,
): void {
  server.registerTool(
    "get_project_repository",
    {
      title: "Get project repository",
      description:
        "Inspect the public GitHub repository linked by a portfolio project, pinned to the main branch.",
      inputSchema: z.strictObject({
        project_id: z.number().int().safe().positive(),
      }),
      outputSchema: getProjectRepositoryOutputSchema,
      annotations: { readOnlyHint: true },
    },
    async ({ project_id }) => {
      try {
        const resolved = await resolveProjectRepository(api, project_id);
        return jsonResult({
          project_id: resolved.project_id,
          repository: await github.getRepository(resolved.repository),
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "get_project_readme",
    {
      title: "Get project README",
      description:
        "Read the root README.md from the public GitHub repository linked by a project, from main only, in bounded chunks.",
      inputSchema: z.strictObject({
        project_id: z.number().int().safe().positive(),
        offset: z
          .number()
          .int()
          .safe()
          .min(0)
          .max(GITHUB_FILE_MAX_CHARACTERS)
          .optional()
          .describe("UTF-16 character offset for the next README chunk."),
        max_chars: z
          .number()
          .int()
          .safe()
          .min(1)
          .max(MAX_SNIPPET_CHUNK_CHARACTERS)
          .optional()
          .describe("Maximum README characters in this response."),
      }),
      outputSchema: getProjectReadmeOutputSchema,
      annotations: { readOnlyHint: true },
    },
    async ({ project_id, offset, max_chars }) => {
      try {
        const resolved = await resolveProjectRepository(api, project_id);
        const readme = await github.getReadme(resolved.repository);
        const start = Math.min(offset ?? 0, readme.text.length);
        const end = Math.min(
          start + (max_chars ?? MAX_SNIPPET_CHUNK_CHARACTERS),
          readme.text.length,
        );
        return jsonResult({
          project_id: resolved.project_id,
          repository_url: resolved.repository.canonical_url,
          branch: GITHUB_MAIN_BRANCH,
          path: "README.md" as const,
          canonical_url: getGitHubReadmeUrl(resolved.repository),
          offset: start,
          content: readme.text.slice(start, end),
          next_offset: end,
          total_characters: readme.text.length,
          complete: end >= readme.text.length,
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "list_project_commits",
    {
      title: "List project commits",
      description:
        "List bounded public commit metadata reachable from the linked GitHub repository's main branch.",
      inputSchema: z.strictObject({
        project_id: z.number().int().safe().positive(),
        limit: z.number().int().safe().min(1).max(MAX_LIST_LIMIT).optional(),
        cursor: z.string().trim().min(1).max(512).optional(),
      }),
      outputSchema: listProjectCommitsOutputSchema,
      annotations: { readOnlyHint: true },
    },
    async ({ project_id, limit, cursor }) => {
      try {
        const resolved = await resolveProjectRepository(api, project_id);
        const page = decodeGitHubCommitCursor(cursor);
        const pageSize = safeLimit(limit, 6, MAX_LIST_LIMIT);
        const result = await github.listCommits(resolved.repository, pageSize, page);
        const hasMore = result.has_more && page < MAX_GITHUB_COMMIT_PAGE;
        return jsonResult({
          project_id: resolved.project_id,
          repository_url: resolved.repository.canonical_url,
          branch: GITHUB_MAIN_BRANCH,
          commits: result.commits,
          pagination: {
            limit: pageSize,
            has_more: hasMore,
            next_cursor: hasMore ? encodeGitHubCommitCursor(page + 1) : null,
          },
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "get_project_commit",
    {
      title: "Get project commit",
      description:
        "Return a bounded summary for a full-SHA commit reachable from the linked repository's main branch.",
      inputSchema: z.strictObject({
        project_id: z.number().int().safe().positive(),
        sha: z
          .string()
          .trim()
          .regex(/^[0-9a-f]{40}$/i)
          .describe("Full 40-character commit SHA."),
      }),
      outputSchema: getProjectCommitOutputSchema,
      annotations: { readOnlyHint: true },
    },
    async ({ project_id, sha }) => {
      try {
        const resolved = await resolveProjectRepository(api, project_id);
        const commit = await github.getCommit(resolved.repository, safeGitHubSha(sha));
        return jsonResult({
          project_id: resolved.project_id,
          repository_url: resolved.repository.canonical_url,
          branch: GITHUB_MAIN_BRANCH,
          commit: {
            ...commit,
            canonical_url: getGitHubCommitUrl(resolved.repository, commit.sha),
          },
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "list_project_files",
    {
      title: "List project files",
      description:
        "List bounded text-file paths from the linked public GitHub repository's current main branch.",
      inputSchema: z.strictObject({
        project_id: z.number().int().safe().positive(),
        path_prefix: z.string().trim().min(1).max(1_024).optional(),
        limit: z.number().int().safe().min(1).max(MAX_GITHUB_FILE_PAGE).optional(),
        cursor: z.string().trim().min(1).max(512).optional(),
      }),
      outputSchema: listProjectFilesOutputSchema,
      annotations: { readOnlyHint: true },
    },
    async ({ project_id, path_prefix, limit, cursor }) => {
      try {
        const resolved = await resolveProjectRepository(api, project_id);
        const offset = decodeGitHubFileCursor(cursor);
        const pageSize = safeLimit(limit, 50, MAX_GITHUB_FILE_PAGE);
        const prefix = normalizeGitHubPathPrefix(path_prefix);
        const result = await github.listFiles(resolved.repository, prefix, offset, pageSize);
        return jsonResult({
          project_id: resolved.project_id,
          repository_url: resolved.repository.canonical_url,
          branch: GITHUB_MAIN_BRANCH,
          commit_sha: result.commit_sha,
          files: result.files,
          total_files: result.total_files,
          tree_truncated: result.tree_truncated,
          pagination: {
            limit: pageSize,
            has_more: result.has_more,
            next_cursor:
              result.next_offset === null ? null : encodeGitHubFileCursor(result.next_offset),
          },
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "get_project_file",
    {
      title: "Read project file",
      description:
        "Read a bounded text file from the linked public GitHub repository's current main branch.",
      inputSchema: z.strictObject({
        project_id: z.number().int().safe().positive(),
        path: z.string().trim().min(1).max(1_024),
        offset: z
          .number()
          .int()
          .safe()
          .min(0)
          .max(GITHUB_FILE_MAX_CHARACTERS)
          .optional()
          .describe("UTF-16 character offset for the next source chunk."),
        max_chars: z
          .number()
          .int()
          .safe()
          .min(1)
          .max(MAX_SNIPPET_CHUNK_CHARACTERS)
          .optional()
          .describe("Maximum source characters in this response."),
      }),
      outputSchema: getProjectFileOutputSchema,
      annotations: { readOnlyHint: true },
    },
    async ({ project_id, path, offset, max_chars }) => {
      try {
        const resolved = await resolveProjectRepository(api, project_id);
        const normalizedPath = normalizeGitHubFilePath(path);
        const file = await github.getFile(resolved.repository, normalizedPath);
        if (!file.content_available) {
          return jsonResult({
            project_id: resolved.project_id,
            repository_url: resolved.repository.canonical_url,
            branch: GITHUB_MAIN_BRANCH,
            commit_sha: file.commit_sha,
            path: file.path,
            blob_sha: file.blob_sha,
            size: file.size,
            canonical_url: file.canonical_url,
            content_available: false as const,
            reason: file.reason,
          });
        }

        const start = Math.min(offset ?? 0, file.text.length);
        const end = Math.min(start + (max_chars ?? MAX_SNIPPET_CHUNK_CHARACTERS), file.text.length);
        return jsonResult({
          project_id: resolved.project_id,
          repository_url: resolved.repository.canonical_url,
          branch: GITHUB_MAIN_BRANCH,
          commit_sha: file.commit_sha,
          path: file.path,
          blob_sha: file.blob_sha,
          size: file.size,
          canonical_url: file.canonical_url,
          content_available: true as const,
          offset: start,
          content: file.text.slice(start, end),
          next_offset: end,
          total_characters: file.text.length,
          complete: end >= file.text.length,
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );
}
