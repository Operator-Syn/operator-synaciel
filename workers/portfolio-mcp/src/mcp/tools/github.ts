import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import {
  MAX_GITHUB_COMMIT_PAGE,
  MAX_LIST_LIMIT,
  MAX_SNIPPET_CHUNK_CHARACTERS,
  MAX_SNIPPET_OFFSET,
} from "../../config.ts";
import {
  GITHUB_MAIN_BRANCH,
  type GitHubClient,
  getGitHubCommitUrl,
  getGitHubReadmeUrl,
  parseGitHubRepositoryUrl,
} from "../../github/index.ts";
import type { PortfolioApiClient } from "../../portfolio-api/index.ts";
import { errorResult, jsonResult } from "../results.ts";
import {
  getProjectCommitOutputSchema,
  getProjectReadmeOutputSchema,
  getProjectRepositoryOutputSchema,
  listProjectCommitsOutputSchema,
} from "../schemas.ts";
import {
  decodeGitHubCommitCursor,
  encodeGitHubCommitCursor,
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
          .max(MAX_SNIPPET_OFFSET)
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
}
