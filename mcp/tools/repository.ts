import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import {
  type CommitEntry,
  commitAppliedFiles,
  commitWorkingTree,
  prepareCommits,
  prepareWorkingTreeCommit,
} from "../commit-pipeline.ts";
import {
  REPOSITORY_VERIFICATION_PROFILES,
  REPOSITORY_WRITE_PROFILES,
  type SafeVerificationCheck,
} from "../policy.ts";
import {
  applyRepositoryChange,
  prepareRepositoryChange,
  verifyRepositoryChange,
} from "../repository-changes.ts";
import { getRepositoryWorkflowStatus } from "../workflow-status.ts";

const result = (value: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
});

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

export function registerRepositoryTools(server: McpServer): void {
  server.registerTool(
    "repository_workflow_status",
    {
      title: "Inspect repository workflow readiness",
      description:
        "Read-only status for the clone-safe MCP registrations, local dependencies, Graphify output, Obsidian vault index, and versioned Git hooks. It never returns secrets or mutates the checkout.",
      annotations: readOnlyAnnotations,
      inputSchema: {},
    },
    async () => result(await getRepositoryWorkflowStatus()),
  );

  server.registerTool(
    "prepare_repository_change",
    {
      title: "Prepare a guarded repository change",
      description:
        "Read-only preparation for a bounded text-file change. Returns exact paths, hashes, a reviewable diff, and a one-time apply token without modifying the checkout.",
      annotations: readOnlyAnnotations,
      inputSchema: {
        taskType: z.enum(["patch", "app", "docs", "mcp", "database", "config"]),
        description: z.string().min(1).max(4_000),
        profile: z.enum(writeProfiles),
        operations: z
          .array(
            z.object({
              path: z.string().min(1),
              content: z.string(),
              expectedSha256: z.string().length(64).optional(),
            }),
          )
          .min(1)
          .max(80),
        verificationProfile: z.enum(verificationProfiles).optional(),
        requestedBy: z.string().max(120).optional(),
      },
    },
    async (input) => result(await prepareRepositoryChange(input)),
  );

  server.registerTool(
    "apply_repository_change",
    {
      title: "Apply a prepared repository change",
      description:
        "Approval-gated local apply. Requires the exact one-time token, explicit approval, and a hash map covering exactly the prepared files. Rolls back on failure.",
      inputSchema: {
        planId: z.string().min(1),
        applyToken: z.string().min(1),
        expectedFileHashes: z.record(z.string(), z.string().length(64).or(z.null())),
        approve: z.literal(true),
      },
    },
    async (input) => result(await applyRepositoryChange(input)),
  );

  server.registerTool(
    "verify_repository_change",
    {
      title: "Verify a repository change",
      description:
        "Runs only fixed repository-native npm checks selected by a named verification profile. Arbitrary shell commands and deployment operations are not accepted.",
      annotations: readOnlyAnnotations,
      inputSchema: {
        profile: z.enum(verificationProfiles),
        checks: z.array(z.enum(verificationChecks)).max(10).optional(),
      },
    },
    async (input) => result(verifyRepositoryChange(input)),
  );

  server.registerTool(
    "prepare_working_tree_commit",
    {
      title: "Prepare the complete dirty working tree for review",
      description:
        "Read-only snapshot of every visible dirty path, including untracked files, deletions, binary hashes, and a reviewable diff. Restricted developer paths require one-time explicit consent.",
      annotations: readOnlyAnnotations,
      inputSchema: {
        consentToken: z.string().min(1).optional(),
        approveRestrictedPaths: z.literal(true).optional(),
      },
    },
    async (input) => result(await prepareWorkingTreeCommit(input)),
  );

  server.registerTool(
    "git_commit_working_tree",
    {
      title: "Commit the reviewed working tree one file at a time",
      description:
        "Approval-gated local commit of the exact prepared snapshot. Rechecks hashes and status, requires one reviewed sentence-style subject per file, keeps hooks active, and reports partial progress.",
      inputSchema: {
        operationId: z.string().min(1),
        approvalHash: z.string().length(64),
        commits: commitEntries,
      },
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
      description:
        "Read-only helper that rechecks applied file hashes and suggests one subject per file. The reviewer must edit the subjects before approval.",
      annotations: readOnlyAnnotations,
      inputSchema: {
        operationId: z.string().min(1),
        approvalHash: z.string().length(64),
      },
    },
    async (input) => result(await prepareCommits(input.operationId, input.approvalHash)),
  );

  server.registerTool(
    "git_commit_files",
    {
      title: "Commit an approved applied change one file at a time",
      description:
        "Approval-gated local commit for an already-applied change. Requires exact file coverage, rejects unrelated or stale changes, keeps hooks active, and creates one commit per reviewed file.",
      inputSchema: {
        operationId: z.string().min(1),
        approvalHash: z.string().length(64),
        commits: commitEntries,
      },
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
