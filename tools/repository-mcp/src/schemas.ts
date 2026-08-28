import { z } from "zod";

const nonEmptyString = z.string().min(1);
const hashSchema = z.string().length(64);
const pathSchema = z.string().min(1);

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
    "migration_list_local",
  ]),
  command: z.array(nonEmptyString).min(1),
  status: z.number().int(),
  output: z.string().max(12_000),
  passed: z.boolean(),
});

const verificationSummarySchema = z.strictObject({
  profile: z.enum(["app", "docs", "mcp", "database", "config", "full"]),
  checks: z.array(verificationCheckSchema),
  passed: z.boolean(),
});

export const prepareRepositoryChangeOutputSchema = z.strictObject({
  status: z.enum(["prepared", "rejected"]),
  auditId: nonEmptyString,
  message: nonEmptyString,
  planId: nonEmptyString.optional(),
  requestedBy: nonEmptyString.optional(),
  files: z.array(pathSchema).optional(),
  diff: z.string().optional(),
  expectedFileHashes: z.record(z.string(), hashSchema.or(z.null())).optional(),
  applyToken: nonEmptyString.optional(),
});

export const applyRepositoryChangeOutputSchema = z.strictObject({
  status: z.enum(["applied", "applied_with_verification_failures", "conflict", "failed"]),
  auditId: nonEmptyString,
  planId: nonEmptyString,
  requestedBy: nonEmptyString,
  message: nonEmptyString,
  files: z.array(pathSchema).optional(),
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
  diff: z.string(),
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
  stdout: z.string(),
  stderr: z.string(),
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
