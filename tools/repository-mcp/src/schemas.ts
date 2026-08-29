import { z } from "zod";

import {
  MAX_DIFF_CHUNK_CHARACTERS,
  MAX_DIFF_PREVIEW_CHARACTERS,
  MAX_PREPARED_FILES,
  MAX_SOURCE_READ_CHUNK_CHARACTERS,
} from "./policy.ts";

const nonEmptyString = z.string().min(1);
const hashSchema = z.string().length(64);
const pathSchema = z.string().min(1);
const profileSchema = z.enum(["app", "docs", "mcp", "database", "config", "repository"]);
const verificationProfileSchema = z.enum([
  "mcp-fast",
  "app",
  "docs",
  "mcp",
  "database",
  "config",
  "repository",
  "full",
]);

const fileChangeSummarySchema = z.strictObject({
  path: pathSchema,
  oldSha256: hashSchema.or(z.null()),
  newSha256: hashSchema,
  newBytes: z.number().int().nonnegative(),
});

const diffPreviewFields = {
  diffTruncated: z.boolean(),
  diffTotalCharacters: z.number().int().nonnegative(),
  diffTotalBytes: z.number().int().nonnegative(),
  diffNextOffset: z.number().int().nonnegative().nullable(),
  omittedPaths: z.array(pathSchema),
};

const optionalDiffPreviewFields = {
  diffTruncated: z.boolean().optional(),
  diffTotalCharacters: z.number().int().nonnegative().optional(),
  diffTotalBytes: z.number().int().nonnegative().optional(),
  diffNextOffset: z.number().int().nonnegative().nullable().optional(),
  omittedPaths: z.array(pathSchema).optional(),
};

const fileReadinessSchema = z.strictObject({
  present: z.boolean(),
  executable: z.boolean().optional(),
});

export const repositoryWorkflowStatusOutputSchema = z.strictObject({
  status: z.enum(["ready", "attention", "blocked"]),
  projectRoot: nonEmptyString,
  server: z.strictObject({
    name: nonEmptyString,
    version: nonEmptyString,
  }),
  files: z.record(z.string(), fileReadinessSchema),
  tooling: z.strictObject({
    npm: z.boolean(),
    tsx: z.boolean(),
    pipenv: z.boolean(),
    graph: z.boolean(),
  }),
  git: z.strictObject({
    hooksPath: z.string().nullable(),
    hooksActive: z.boolean(),
  }),
  capabilities: z.strictObject({
    writeProfiles: z.array(z.string()),
    verificationProfiles: z.record(z.string(), z.array(z.string())),
  }),
  warnings: z.array(z.string()),
  checkedAt: nonEmptyString,
  cacheHit: z.boolean(),
});

const verificationCheckSchema = z.strictObject({
  check: z.enum([
    "typecheck",
    "lint",
    "build",
    "docs_check",
    "mcp_config_check",
    "mcp_typecheck",
    "mcp_test",
    "portfolio_mcp_typecheck",
    "portfolio_mcp_test",
    "api_typecheck",
    "api_test",
    "web_test",
    "db_migration_check",
    "skills_check",
    "biome_check",
    "migration_list_local",
  ]),
  command: z.array(nonEmptyString).min(1),
  status: z.number().int(),
  output: z.string().max(12_000),
  passed: z.boolean(),
});

const verificationSummarySchema = z.strictObject({
  profile: verificationProfileSchema,
  checks: z.array(verificationCheckSchema),
  passed: z.boolean(),
  cached: z.boolean(),
});

export const prepareRepositoryChangeOutputSchema = z.strictObject({
  status: z.enum(["prepared", "rejected"]),
  auditId: nonEmptyString,
  message: nonEmptyString,
  planId: nonEmptyString.optional(),
  requestedBy: nonEmptyString.optional(),
  profile: profileSchema.optional(),
  verificationProfile: verificationProfileSchema.optional(),
  verificationMode: z.enum(["deferred", "on_apply"]).optional(),
  verificationRequired: z.boolean().optional(),
  files: z.array(pathSchema).optional(),
  fileSummaries: z.array(fileChangeSummarySchema).max(MAX_PREPARED_FILES).optional(),
  totalBytes: z.number().int().nonnegative().optional(),
  diff: z.string().max(MAX_DIFF_PREVIEW_CHARACTERS).optional(),
  ...optionalDiffPreviewFields,
  expectedFileHashes: z.record(z.string(), hashSchema.or(z.null())).optional(),
  applyToken: nonEmptyString.optional(),
});

export const applyRepositoryChangeOutputSchema = z.strictObject({
  status: z.enum(["applied", "applied_with_verification_failures", "conflict", "failed"]),
  auditId: nonEmptyString,
  planId: nonEmptyString,
  requestedBy: nonEmptyString,
  profile: profileSchema.optional(),
  verificationProfile: verificationProfileSchema.optional(),
  verificationMode: z.enum(["deferred", "on_apply"]).optional(),
  verificationRequired: z.boolean().optional(),
  message: nonEmptyString,
  files: z.array(pathSchema).optional(),
  fileSummaries: z.array(fileChangeSummarySchema).max(MAX_PREPARED_FILES).optional(),
  totalBytes: z.number().int().nonnegative().optional(),
  finalFileHashes: z.record(z.string(), hashSchema).optional(),
  operationId: nonEmptyString.optional(),
  approvalHash: hashSchema.optional(),
  verification: verificationSummarySchema.optional(),
  conflicts: z.array(pathSchema).optional(),
});

export const verifyRepositoryChangeOutputSchema = z.strictObject({
  status: z.enum(["verified", "failed", "rejected"]),
  auditId: nonEmptyString,
  message: nonEmptyString,
  verification: verificationSummarySchema.optional(),
});

const restrictedPathReviewSchema = z.strictObject({
  path: pathSchema,
  status: z.string(),
  size: z.number().int().nonnegative(),
});

const fileSnapshotSchema = z.strictObject({
  path: pathSchema,
  status: z.string(),
  hash: hashSchema.or(z.null()),
  size: z.number().int().nonnegative(),
});

const workingTreeSnapshotSchema = z.strictObject({
  files: z.array(fileSnapshotSchema),
  diff: z.string().max(MAX_DIFF_PREVIEW_CHARACTERS),
  ...diffPreviewFields,
  hash: hashSchema,
});

export const prepareWorkingTreeCommitOutputSchema = z.strictObject({
  status: z.enum(["prepared", "consent_required"]),
  kind: z.literal("working-tree-commit"),
  paths: z.array(pathSchema),
  restrictedPaths: z.array(restrictedPathReviewSchema),
  message: nonEmptyString,
  operationId: nonEmptyString.optional(),
  approvalHash: hashSchema.optional(),
  createdAt: nonEmptyString.optional(),
  snapshot: workingTreeSnapshotSchema.optional(),
  consentToken: nonEmptyString.optional(),
});

const commitEntrySchema = z.strictObject({
  path: pathSchema,
  message: nonEmptyString,
});

const gitResultFields = {
  command: nonEmptyString,
  status: z.number().int(),
  stdout: z.string().max(12_000),
  stderr: z.string().max(12_000),
};

const commitAttemptSchema = z.strictObject({
  path: pathSchema,
  ...gitResultFields,
});

const commitExecutionFields = {
  operationId: nonEmptyString,
  approvalHash: hashSchema,
  kind: z.enum(["working-tree-commit", "applied-change-commit"]),
  paths: z.array(pathSchema),
  commits: z.array(commitAttemptSchema),
  filesPerCommit: z.array(z.number().int().nonnegative()),
  allOneFile: z.boolean(),
  beforeStatus: z.strictObject(gitResultFields),
  afterStatus: z.strictObject(gitResultFields),
  message: nonEmptyString,
};

const gitCommitOutputSchema = z.strictObject({
  status: z.enum(["committed", "partial"]),
  ...commitExecutionFields,
});

export const gitCommitWorkingTreeOutputSchema = gitCommitOutputSchema;

export const prepareCommitsOutputSchema = z.strictObject({
  status: z.literal("prepared"),
  operationId: nonEmptyString,
  approvalHash: hashSchema,
  kind: z.literal("applied-change-commit"),
  createdAt: nonEmptyString,
  paths: z.array(pathSchema),
  commits: z.array(commitEntrySchema),
  message: nonEmptyString,
});

export const gitCommitFilesOutputSchema = gitCommitOutputSchema;

const diffChunkFields = {
  content: z.string().max(MAX_DIFF_CHUNK_CHARACTERS),
  offset: z.number().int().nonnegative(),
  nextOffset: z.number().int().nonnegative().nullable(),
  totalCharacters: z.number().int().nonnegative(),
  totalBytes: z.number().int().nonnegative(),
  complete: z.boolean(),
  diffTruncated: z.boolean(),
  omittedPaths: z.array(pathSchema),
};

export const readRepositoryChangeDiffOutputSchema = z.strictObject({
  kind: z.literal("repository-change"),
  planId: nonEmptyString,
  ...diffChunkFields,
});

export const readWorkingTreeDiffOutputSchema = z.strictObject({
  kind: z.literal("working-tree"),
  operationId: nonEmptyString,
  ...diffChunkFields,
});

const repositoryFileReadSchema = z.strictObject({
  path: pathSchema,
  exists: z.boolean(),
  content: z.string().max(MAX_SOURCE_READ_CHUNK_CHARACTERS),
  sha256: hashSchema.or(z.null()),
  offset: z.number().int().nonnegative(),
  nextOffset: z.number().int().nonnegative().nullable(),
  totalCharacters: z.number().int().nonnegative(),
  totalBytes: z.number().int().nonnegative(),
  complete: z.boolean(),
});

export const readRepositoryFilesOutputSchema = z.strictObject({
  kind: z.literal("repository-files"),
  profile: profileSchema,
  files: z.array(repositoryFileReadSchema).max(MAX_PREPARED_FILES),
  omittedPaths: z.array(pathSchema),
  returnedCharacters: z.number().int().nonnegative(),
});
