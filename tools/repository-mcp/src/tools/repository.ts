import { randomUUID } from "node:crypto";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ElicitResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import {
  type CommitEntry,
  commitAppliedFiles,
  commitWorkingTree,
  prepareCommits,
  prepareWorkingTreeCommit,
  readWorkingTreeDiff,
} from "../commit-pipeline.ts";
import { failureFields } from "../errors.ts";
import { REPOSITORY_MCP_INSTANCE_ID } from "../instance.ts";
import {
  isProfilePathAllowed,
  MAX_DIFF_CHUNK_CHARACTERS,
  MAX_PREPARED_FILES,
  MAX_SOURCE_READ_CHUNK_CHARACTERS,
  MAX_VERIFICATION_CHECKS,
  REPOSITORY_VERIFICATION_PROFILES,
  REPOSITORY_WRITE_PROFILES,
  type SafeVerificationCheck,
} from "../policy.ts";
import {
  createRepositoryReadPermissionStore,
  type ReadPermissionScope,
  type RepositoryReadPermissionStore,
} from "../read-permissions.ts";
import {
  applyRepositoryChange,
  prepareRepositoryChange,
  readRepositoryChangeDiff,
  verifyRepositoryChange,
} from "../repository-changes.ts";
import {
  formatProfileDenial,
  readRepositoryFiles,
  validateRepositoryReadPath,
} from "../repository-files.ts";
import {
  MAX_SEARCH_QUERY_CHARACTERS,
  MAX_SEARCH_RESULTS,
  searchRepository,
} from "../repository-search.ts";
import {
  applyRepositoryChangeOutputSchema,
  gitCommitFilesOutputSchema,
  gitCommitWorkingTreeOutputSchema,
  grantRepositoryReadAccessOutputSchema,
  prepareCommitsOutputSchema,
  prepareRepositoryChangeOutputSchema,
  prepareWorkingTreeCommitOutputSchema,
  readRepositoryChangeDiffOutputSchema,
  readRepositoryFilesOutputSchema,
  readWorkingTreeDiffOutputSchema,
  repositoryWorkflowStatusOutputSchema,
  searchRepositoryOutputSchema,
  verifyRepositoryChangeOutputSchema,
} from "../schemas.ts";
import { getRepositoryWorkflowStatus } from "../workflow-status.ts";

function humanSummary(value: unknown): string {
  if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;
    if (typeof record.message === "string" && record.message.trim()) {
      return record.message.replace(/\s+/g, " ").trim().slice(0, 500);
    }
    const kind = typeof record.kind === "string" ? record.kind : "repository request";
    const status = typeof record.status === "string" ? record.status : "completed";
    return `${kind} ${status}.`;
  }
  return "Repository request completed.";
}

const result = <T>(value: T) => ({
  content: [
    {
      type: "text" as const,
      text: humanSummary(value),
    },
  ],
  structuredContent: value,
});

const errorResult = (error: unknown) => {
  const message = error instanceof Error ? error.message : "Repository MCP request failed.";
  const failure = failureFields(error);
  const value = {
    status: "rejected" as const,
    auditId: randomUUID(),
    message,
    instanceId: REPOSITORY_MCP_INSTANCE_ID,
    ...failure,
  };
  return {
    isError: true,
    content: [
      {
        type: "text" as const,
        text: humanSummary(value),
      },
    ],
    structuredContent: value,
  };
};

async function callWithFailure<T>(operation: () => Promise<T>) {
  try {
    return result(await operation());
  } catch (error) {
    return errorResult(error);
  }
}

const readOnlyAnnotations = { readOnlyHint: true, openWorldHint: false } as const;

const commitEntries = z
  .array(z.object({ path: z.string().min(1), message: z.string().min(1).max(4_096) }))
  .min(1)
  .max(500);

const writeProfiles = Object.keys(REPOSITORY_WRITE_PROFILES) as [
  keyof typeof REPOSITORY_WRITE_PROFILES,
  ...Array<keyof typeof REPOSITORY_WRITE_PROFILES>,
];
const verificationProfiles = Object.keys(REPOSITORY_VERIFICATION_PROFILES) as [
  keyof typeof REPOSITORY_VERIFICATION_PROFILES,
  ...Array<keyof typeof REPOSITORY_VERIFICATION_PROFILES>,
];
const verificationChecks = [...new Set(Object.values(REPOSITORY_VERIFICATION_PROFILES).flat())] as [
  SafeVerificationCheck,
  ...SafeVerificationCheck[],
];

const readPermissionElicitationSchema = {
  type: "object" as const,
  properties: {
    scope: {
      type: "string" as const,
      title: "Permission scope",
      description: "Choose whether these exact paths are allowed once or remembered locally.",
      enum: ["temporary", "permanent"],
    },
  },
  required: ["scope"],
};

async function elicitReadPermissionScope(
  server: McpServer,
  profile: keyof typeof REPOSITORY_WRITE_PROFILES,
  paths: readonly string[],
): Promise<ReadPermissionScope> {
  let response: ElicitResult;
  try {
    response = await server.server.elicitInput({
      mode: "form",
      message: `${formatProfileDenial(profile, paths)} Choose temporary access for this read only, or permanent access for these exact paths in this checkout.`,
      requestedSchema: readPermissionElicitationSchema,
    });
  } catch {
    throw new Error(
      "Interactive permission selection is unavailable. Ask the user to choose temporary or permanent access, then retry this tool with an explicit scope.",
    );
  }
  if (response.action !== "accept") {
    throw new Error("No repository read permission was granted.");
  }
  const scope = response.content?.scope;
  if (scope !== "temporary" && scope !== "permanent") {
    throw new Error("The repository read permission choice was invalid.");
  }
  return scope;
}

export function registerRepositoryTools(
  server: McpServer,
  options: { readonly readPermissionStore?: RepositoryReadPermissionStore } = {},
): void {
  const readPermissionStore = options.readPermissionStore ?? createRepositoryReadPermissionStore();
  server.registerTool(
    "repository_workflow_status",
    {
      title: "Inspect repository workflow readiness",
      description: "Read-only repository root, tooling, Graphify, and Git-hook readiness.",
      annotations: readOnlyAnnotations,
      inputSchema: {
        refresh: z.boolean().optional(),
      },
      outputSchema: repositoryWorkflowStatusOutputSchema,
    },
    async (input) => result(await getRepositoryWorkflowStatus(input)),
  );

  server.registerTool(
    "search_repository",
    {
      title: "Search repository text",
      description:
        "Read-only literal text search over visible files in the selected repository profile. Returns bounded path, line, column, preview, hash, and continuation metadata.",
      annotations: readOnlyAnnotations,
      inputSchema: {
        profile: z.enum(writeProfiles),
        query: z.string().min(1).max(MAX_SEARCH_QUERY_CHARACTERS),
        roots: z.array(z.string().min(1)).max(20).optional(),
        caseSensitive: z.boolean().optional(),
        offset: z.number().int().nonnegative().optional(),
        maxResults: z.number().int().min(1).max(MAX_SEARCH_RESULTS).optional(),
      },
      outputSchema: searchRepositoryOutputSchema,
    },
    async (input) => callWithFailure(() => searchRepository(input)),
  );

  server.registerTool(
    "read_repository_files",
    {
      title: "Read bounded repository source snapshots",
      description:
        "Read bounded text snapshots by character offset or inclusive line range within a profile.",
      annotations: readOnlyAnnotations,
      inputSchema: {
        profile: z.enum(writeProfiles),
        files: z
          .array(
            z.object({
              path: z.string().min(1),
              offset: z.number().int().nonnegative().optional(),
              startLine: z.number().int().positive().optional(),
              endLine: z.number().int().positive().optional(),
            }),
          )
          .min(1)
          .max(MAX_PREPARED_FILES),
        maxChars: z.number().int().min(1).max(MAX_SOURCE_READ_CHUNK_CHARACTERS).optional(),
        permissionToken: z.string().min(1).optional(),
      },
      outputSchema: readRepositoryFilesOutputSchema,
    },
    async (input) =>
      callWithFailure(() =>
        readRepositoryFiles(input, {
          permissionStore: readPermissionStore,
          requestPermission: ({ profile, paths }) =>
            elicitReadPermissionScope(server, profile, paths),
        }),
      ),
  );

  server.registerTool(
    "grant_repository_read_access",
    {
      title: "Grant exact repository read access",
      description: "Approval-gated access for exact safe paths outside a focused read profile.",
      inputSchema: {
        profile: z.enum(writeProfiles),
        paths: z.array(z.string().min(1)).min(1).max(MAX_PREPARED_FILES),
        scope: z.enum(["temporary", "permanent"]).optional(),
        approve: z.literal(true),
      },
      outputSchema: grantRepositoryReadAccessOutputSchema,
    },
    async (input) =>
      callWithFailure(async () => {
        const paths = input.paths.map(validateRepositoryReadPath);
        if (new Set(paths).size !== paths.length) {
          throw new Error("Duplicate repository read permission paths are not allowed.");
        }
        const deniedPaths: string[] = [];
        for (const path of paths) {
          if (
            !isProfilePathAllowed(input.profile, path) &&
            !(await readPermissionStore.isPermanentlyAllowed(input.profile, path))
          ) {
            deniedPaths.push(path);
          }
        }
        if (deniedPaths.length === 0) {
          return {
            status: "already_allowed" as const,
            kind: "repository-read-permission" as const,
            profile: input.profile,
            scope: input.scope ?? "permanent",
            paths,
            message: "All requested repository paths are already allowed for this profile.",
          };
        }

        const scope =
          input.scope ?? (await elicitReadPermissionScope(server, input.profile, deniedPaths));
        const grant = await readPermissionStore.grant(input.profile, deniedPaths, scope);
        return {
          status: "granted" as const,
          kind: "repository-read-permission" as const,
          profile: input.profile,
          scope: grant.scope,
          paths: grant.paths,
          ...(grant.permissionToken ? { permissionToken: grant.permissionToken } : {}),
          ...(grant.expiresAt ? { expiresAt: grant.expiresAt } : {}),
          message:
            scope === "temporary"
              ? "Temporary access granted for these exact paths. Retry read_repository_files with the permissionToken; it is consumed after one successful read."
              : "Permanent access granted for these exact paths in the user-local repository read allowlist.",
        };
      }),
  );

  server.registerTool(
    "prepare_repository_change",
    {
      title: "Prepare a guarded repository change",
      description:
        "Prepare complete writes, exact anchored edits, or tracked-file deletions for review without mutating the checkout.",
      annotations: readOnlyAnnotations,
      inputSchema: {
        description: z.string().min(1).max(4_000),
        profile: z.enum(writeProfiles),
        operations: z
          .array(
            z.object({
              path: z.string().min(1),
              action: z.enum(["write", "edit", "delete"]).optional(),
              content: z.string().optional(),
              expectedSha256: z.string().length(64).optional(),
              allowContentShortening: z.boolean().optional(),
              replacements: z
                .array(
                  z.object({
                    oldText: z.string(),
                    newText: z.string(),
                  }),
                )
                .max(100)
                .optional(),
            }),
          )
          .min(1)
          .max(MAX_PREPARED_FILES),
        verificationProfile: z.enum(verificationProfiles).optional(),
        verifyOnApply: z.boolean().optional(),
        requestedBy: z.string().max(120).optional(),
      },
      outputSchema: prepareRepositoryChangeOutputSchema,
    },
    async (input) => result(await prepareRepositoryChange(input)),
  );

  server.registerTool(
    "apply_repository_change",
    {
      title: "Apply a prepared repository change",
      description:
        "Explicitly approved apply of a prepared review. Rechecks current hashes, writes atomically, rolls back failures, and safely accepts a retry of the same completed operation.",
      inputSchema: {
        planId: z.string().min(1),
        applyToken: z.string().min(1),
        reviewHash: z.string().length(64),
        approve: z.literal(true),
      },
      outputSchema: applyRepositoryChangeOutputSchema,
    },
    async (input) => callWithFailure(() => applyRepositoryChange(input)),
  );

  server.registerTool(
    "verify_repository_change",
    {
      title: "Verify a repository change",
      description: "Run only fixed repository-native checks from a named verification profile.",
      annotations: readOnlyAnnotations,
      inputSchema: {
        profile: z.enum(verificationProfiles),
        checks: z.array(z.enum(verificationChecks)).max(MAX_VERIFICATION_CHECKS).optional(),
      },
      outputSchema: verifyRepositoryChangeOutputSchema,
    },
    async (input) => result(verifyRepositoryChange(input)),
  );

  server.registerTool(
    "read_repository_change_diff",
    {
      title: "Read a prepared repository-change diff chunk",
      description: "Read bounded chunks of a prepared change diff using its review token.",
      annotations: readOnlyAnnotations,
      inputSchema: {
        planId: z.string().min(1),
        applyToken: z.string().min(1),
        offset: z.number().int().nonnegative().optional(),
        maxChars: z.number().int().min(1).max(MAX_DIFF_CHUNK_CHARACTERS).optional(),
      },
      outputSchema: readRepositoryChangeDiffOutputSchema,
    },
    async (input) => callWithFailure(() => Promise.resolve(readRepositoryChangeDiff(input))),
  );

  server.registerTool(
    "prepare_working_tree_commit",
    {
      title: "Prepare the complete dirty working tree for review",
      description:
        "Snapshot the visible dirty tree for review, including untracked files and deletions.",
      annotations: readOnlyAnnotations,
      inputSchema: {
        consentToken: z.string().min(1).optional(),
        approveRestrictedPaths: z.literal(true).optional(),
      },
      outputSchema: prepareWorkingTreeCommitOutputSchema,
    },
    async (input) => result(await prepareWorkingTreeCommit(input)),
  );

  server.registerTool(
    "read_working_tree_diff",
    {
      title: "Read a prepared working-tree diff chunk",
      description: "Read bounded chunks of a prepared dirty-tree diff.",
      annotations: readOnlyAnnotations,
      inputSchema: {
        operationId: z.string().min(1),
        approvalHash: z.string().length(64),
        offset: z.number().int().nonnegative().optional(),
        maxChars: z.number().int().min(1).max(MAX_DIFF_CHUNK_CHARACTERS).optional(),
      },
      outputSchema: readWorkingTreeDiffOutputSchema,
    },
    async (input) => result(readWorkingTreeDiff(input)),
  );

  server.registerTool(
    "git_commit_working_tree",
    {
      title: "Commit the reviewed working tree one file at a time",
      description:
        "Commit the exact reviewed dirty-tree snapshot one file at a time with active hooks.",
      inputSchema: {
        operationId: z.string().min(1),
        approvalHash: z.string().length(64),
        commits: commitEntries,
      },
      outputSchema: gitCommitWorkingTreeOutputSchema,
    },
    async (input) =>
      result(
        await commitWorkingTree(
          input.operationId,
          input.approvalHash,
          input.commits as CommitEntry[],
        ),
      ),
  );

  server.registerTool(
    "prepare_commits",
    {
      title: "Prepare commit subjects for an applied repository change",
      description: "Suggest editable one-file commit subjects for an already-applied change.",
      annotations: readOnlyAnnotations,
      inputSchema: {
        operationId: z.string().min(1),
        approvalHash: z.string().length(64),
      },
      outputSchema: prepareCommitsOutputSchema,
    },
    async (input) => result(await prepareCommits(input.operationId, input.approvalHash)),
  );

  server.registerTool(
    "git_commit_files",
    {
      title: "Commit an approved applied change one file at a time",
      description:
        "Commit an already-applied reviewed change one file at a time with active hooks.",
      inputSchema: {
        operationId: z.string().min(1),
        approvalHash: z.string().length(64),
        commits: commitEntries,
      },
      outputSchema: gitCommitFilesOutputSchema,
    },
    async (input) =>
      result(
        await commitAppliedFiles(
          input.operationId,
          input.approvalHash,
          input.commits as CommitEntry[],
        ),
      ),
  );
}
