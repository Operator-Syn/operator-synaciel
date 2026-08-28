import { randomUUID } from "node:crypto";
import { lstat, readFile, rm } from "node:fs/promises";

import { registerAppliedRepositoryOperation } from "./commit-pipeline.ts";
import {
  buildDiffDocument,
  type DiffChunk,
  type DiffDocument,
  type DiffSection,
  previewDiff,
  readDiffChunk,
} from "./diff.ts";
import { withMutationLock } from "./mutation-lock.ts";
import {
  atomicWrite,
  digestBytes,
  MAX_FILE_BYTES,
  safeAbsolutePath,
  validateLocalProjectRoot,
  validateRelativeProjectPath,
} from "./path.ts";
import {
  MAX_PREPARED_FILES,
  REPOSITORY_WRITE_PROFILES,
  type RepositoryVerificationProfile,
  type RepositoryWriteProfile,
} from "./policy.ts";
import { isCredentialLikeContent, isSensitiveFileName } from "./redaction.ts";
import { runVerificationProfile, type VerificationSummary } from "./verification.ts";

const PLAN_TTL_MS = 30 * 60 * 1_000;
const MAX_PLANS = 100;

export type RepositoryChangeOperation = {
  readonly path: string;
  readonly content: string;
  readonly expectedSha256?: string;
  readonly allowContentShortening?: boolean;
};

export type RepositoryChangeRequest = {
  readonly taskType: "patch" | "app" | "docs" | "mcp" | "database" | "config";
  readonly description: string;
  readonly profile: RepositoryWriteProfile;
  readonly operations: readonly RepositoryChangeOperation[];
  readonly verificationProfile?: RepositoryVerificationProfile;
  readonly requestedBy?: string;
};

type FileState = {
  readonly exists: boolean;
  readonly sha256: string | null;
  readonly content: string | null;
};

type PreparedOperation = {
  readonly path: string;
  readonly content: string;
  readonly expectedSha256: string | null;
  readonly newSha256: string;
  readonly newBytes: number;
};

export type RepositoryChangeFileSummary = {
  readonly path: string;
  readonly oldSha256: string | null;
  readonly newSha256: string;
  readonly newBytes: number;
};

type RepositoryPlan = {
  readonly id: string;
  readonly applyToken: string;
  readonly createdAt: string;
  readonly expiresAt: number;
  readonly requestedBy: string;
  readonly profile: RepositoryWriteProfile;
  readonly verificationProfile: RepositoryVerificationProfile | null;
  readonly operations: readonly PreparedOperation[];
  readonly fileSummaries: readonly RepositoryChangeFileSummary[];
  readonly totalBytes: number;
  readonly diff: DiffDocument;
};

export type RepositoryChangeResult = {
  readonly status:
    | "prepared"
    | "applied"
    | "applied_with_verification_failures"
    | "verified"
    | "rejected"
    | "conflict"
    | "failed";
  readonly auditId: string;
  readonly planId?: string;
  readonly requestedBy?: string;
  readonly profile?: RepositoryWriteProfile;
  readonly verificationProfile?: RepositoryVerificationProfile;
  readonly verificationRequired?: boolean;
  readonly files?: readonly string[];
  readonly fileSummaries?: readonly RepositoryChangeFileSummary[];
  readonly totalBytes?: number;
  readonly finalFileHashes?: Readonly<Record<string, string>>;
  readonly diff?: string;
  readonly diffTruncated?: boolean;
  readonly diffTotalCharacters?: number;
  readonly diffTotalBytes?: number;
  readonly diffNextOffset?: number | null;
  readonly omittedPaths?: readonly string[];
  readonly message: string;
  readonly verification?: VerificationSummary;
  readonly conflicts?: readonly string[];
  readonly expectedFileHashes?: Readonly<Record<string, string | null>>;
  readonly applyToken?: string;
  readonly operationId?: string;
  readonly approvalHash?: string;
};

const plans = new Map<string, RepositoryPlan>();

function auditId(): string {
  return randomUUID();
}

function cleanRequestedBy(value: string | undefined): string {
  return (value?.trim() || "unknown-client").slice(0, 120);
}

async function localFileState(path: string): Promise<FileState> {
  const { absolutePath } = await safeAbsolutePath(path);
  const info = await lstat(absolutePath).catch(() => null);
  if (!info) return { exists: false, sha256: null, content: null };
  if (!info.isFile()) throw new Error(`The repository path is not a regular file: ${path}`);
  if (info.size > MAX_FILE_BYTES)
    throw new Error(`The repository file is too large to review: ${path}`);
  const bytes = await readFile(absolutePath);
  const content = bytes.toString("utf8");
  if (content.includes("\0")) throw new Error(`Binary file content is not accepted: ${path}`);
  if (isCredentialLikeContent(content))
    throw new Error(`Credential-like content cannot be reviewed: ${path}`);
  return { exists: true, sha256: digestBytes(bytes), content };
}

function profileAllowsPath(profile: RepositoryWriteProfile, path: string): boolean {
  return REPOSITORY_WRITE_PROFILES[profile].prefixes.some((prefix) =>
    prefix.endsWith("/") ? path.startsWith(prefix) : path === prefix,
  );
}

function taskMatchesProfile(
  taskType: RepositoryChangeRequest["taskType"],
  profile: RepositoryWriteProfile,
): boolean {
  return taskType === "patch" || taskType === profile;
}

function validateWritePath(profile: RepositoryWriteProfile, input: string): string {
  const path = validateRelativeProjectPath(input, { allowRestrictedPaths: true });
  if (!profileAllowsPath(profile, path))
    throw new Error(`Path is not allowed by the ${profile} write profile.`);
  if (path.split("/").some((part) => isSensitiveFileName(part))) {
    throw new Error("Sensitive environment and credential files cannot be changed.");
  }
  return path;
}

function buildDiff(
  operations: readonly PreparedOperation[],
  states: ReadonlyMap<string, FileState>,
): DiffDocument {
  const sections: DiffSection[] = operations.map((operation) => {
    const before = states.get(operation.path)?.content ?? "";
    const oldLines = before.split(/\r?\n/);
    const newLines = operation.content.split(/\r?\n/);
    return {
      path: operation.path,
      content: [
        `--- a/${operation.path}`,
        `+++ b/${operation.path}`,
        `@@ -1,${oldLines.length} +1,${newLines.length} @@`,
        ...(before ? oldLines.map((line) => `-${line}`) : []),
        ...newLines.map((line) => `+${line}`),
      ].join("\n"),
    };
  });
  return buildDiffDocument(sections);
}

function diffResult(
  kind: "repository-change" | "working-tree",
  identity: Record<string, string>,
  chunk: DiffChunk,
): Record<string, unknown> {
  return {
    kind,
    ...identity,
    ...chunk,
  };
}

function prunePlans(): void {
  const now = Date.now();
  for (const [id, plan] of plans) if (plan.expiresAt <= now) plans.delete(id);
  while (plans.size > MAX_PLANS) {
    const first = plans.keys().next().value;
    if (!first) break;
    plans.delete(first);
  }
}

export async function prepareRepositoryChange(
  request: RepositoryChangeRequest,
): Promise<RepositoryChangeResult> {
  const id = auditId();
  try {
    const root = await validateLocalProjectRoot();
    if (!root.valid) throw new Error(root.reason);
    if (!taskMatchesProfile(request.taskType, request.profile)) {
      throw new Error(`The task type must match the ${request.profile} profile.`);
    }
    if (request.description.trim().length === 0 || request.description.length > 4_000) {
      throw new Error("A bounded change description is required.");
    }
    const policy = REPOSITORY_WRITE_PROFILES[request.profile];
    if (
      request.operations.length === 0 ||
      request.operations.length > Math.min(policy.maxFiles, MAX_PREPARED_FILES)
    ) {
      throw new Error(
        `One prepared operation may contain at most ${Math.min(policy.maxFiles, MAX_PREPARED_FILES)} files for the ${request.profile} profile.`,
      );
    }

    const seen = new Set<string>();
    let totalBytes = 0;
    const prepared: PreparedOperation[] = [];
    const fileSummaries: RepositoryChangeFileSummary[] = [];
    const states = new Map<string, FileState>();
    for (const operation of request.operations) {
      const path = validateWritePath(request.profile, operation.path);
      if (seen.has(path)) throw new Error(`Duplicate file operation: ${path}`);
      seen.add(path);
      if (isCredentialLikeContent(operation.content)) {
        throw new Error(`Credential-like content is not accepted: ${path}`);
      }
      const bytes = Buffer.byteLength(operation.content, "utf8");
      if (operation.content.includes("\0"))
        throw new Error(`Binary file content is not allowed: ${path}`);
      totalBytes += bytes;
      if (totalBytes > policy.maxBytes) {
        throw new Error(`The ${request.profile} profile permits at most ${policy.maxBytes} bytes.`);
      }
      const state = await localFileState(path);
      states.set(path, state);
      if (
        state.exists &&
        state.content !== null &&
        bytes < Buffer.byteLength(state.content, "utf8") &&
        !operation.allowContentShortening
      ) {
        throw new Error(`Content-shortening changes require allowContentShortening: true: ${path}`);
      }
      if (state.exists) {
        if (!operation.expectedSha256 || operation.expectedSha256 !== state.sha256) {
          throw new Error(`Expected hash does not match the current file: ${path}`);
        }
      } else if (operation.expectedSha256) {
        throw new Error(`New files must not provide expectedSha256: ${path}`);
      }
      const newSha256 = digestBytes(Buffer.from(operation.content, "utf8"));
      prepared.push({
        path,
        content: operation.content,
        expectedSha256: state.sha256,
        newSha256,
        newBytes: bytes,
      });
      fileSummaries.push({
        path,
        oldSha256: state.sha256,
        newSha256,
        newBytes: bytes,
      });
    }

    prunePlans();
    const planId = randomUUID();
    const applyToken = randomUUID();
    const plan: RepositoryPlan = {
      id: planId,
      applyToken,
      createdAt: new Date().toISOString(),
      expiresAt: Date.now() + PLAN_TTL_MS,
      requestedBy: cleanRequestedBy(request.requestedBy),
      profile: request.profile,
      verificationProfile: request.verificationProfile ?? null,
      operations: prepared,
      fileSummaries,
      totalBytes,
      diff: buildDiff(prepared, states),
    };
    plans.set(planId, plan);
    const preview = previewDiff(plan.diff);
    return {
      status: "prepared",
      auditId: id,
      planId,
      requestedBy: plan.requestedBy,
      profile: plan.profile,
      verificationProfile: plan.verificationProfile ?? plan.profile,
      verificationRequired: true,
      files: prepared.map((operation) => operation.path),
      fileSummaries: plan.fileSummaries,
      totalBytes: plan.totalBytes,
      diff: preview.content,
      diffTruncated: preview.diffTruncated,
      diffTotalCharacters: preview.totalCharacters,
      diffTotalBytes: preview.totalBytes,
      diffNextOffset: preview.nextOffset,
      omittedPaths: preview.omittedPaths,
      message: "Change prepared. Review the diff before applying it.",
      expectedFileHashes: Object.fromEntries(
        prepared.map((operation) => [operation.path, operation.expectedSha256]),
      ),
      applyToken,
    };
  } catch (error) {
    return {
      status: "rejected",
      auditId: id,
      message: error instanceof Error ? error.message : "Repository change was rejected.",
    };
  }
}

function getPlan(planId: string, applyToken: string): RepositoryPlan {
  prunePlans();
  const plan = plans.get(planId);
  if (!plan || plan.applyToken !== applyToken) {
    throw new Error("The repository plan or apply token is invalid or stale.");
  }
  return plan;
}

export async function applyRepositoryChange(input: {
  readonly planId: string;
  readonly applyToken: string;
  readonly expectedFileHashes: Readonly<Record<string, string | null>>;
  readonly approve: true;
}): Promise<RepositoryChangeResult> {
  const id = auditId();
  const plan = getPlan(input.planId, input.applyToken);
  return withMutationLock(async () => {
    const expectedPaths = new Set(plan.operations.map((operation) => operation.path));
    const suppliedPaths = new Set(Object.keys(input.expectedFileHashes));
    if (
      suppliedPaths.size !== expectedPaths.size ||
      [...suppliedPaths].some((path) => !expectedPaths.has(path))
    ) {
      return {
        status: "conflict",
        auditId: id,
        planId: plan.id,
        requestedBy: plan.requestedBy,
        profile: plan.profile,
        verificationProfile: plan.verificationProfile ?? plan.profile,
        verificationRequired: true,
        message: "The expected hash map must cover exactly the prepared file set.",
        conflicts: plan.operations.map((operation) => operation.path),
      };
    }

    const conflicts: string[] = [];
    for (const operation of plan.operations) {
      const current = await localFileState(operation.path);
      if (
        current.sha256 !== operation.expectedSha256 ||
        input.expectedFileHashes[operation.path] !== operation.expectedSha256
      ) {
        conflicts.push(operation.path);
      }
    }
    if (conflicts.length > 0) {
      return {
        status: "conflict",
        auditId: id,
        planId: plan.id,
        requestedBy: plan.requestedBy,
        profile: plan.profile,
        verificationProfile: plan.verificationProfile ?? plan.profile,
        verificationRequired: true,
        message: "Collaborator changes detected; the plan is stale and was not applied.",
        conflicts,
      };
    }

    const backups = new Map<string, FileState>();
    const changed: string[] = [];
    try {
      for (const operation of plan.operations)
        backups.set(operation.path, await localFileState(operation.path));
      for (const operation of plan.operations) {
        await atomicWrite(operation.path, operation.content, plan.id);
        changed.push(operation.path);
      }

      const finalFileHashes = Object.fromEntries(
        await Promise.all(
          plan.operations.map(async (operation) => {
            const finalState = await localFileState(operation.path);
            if (!finalState.exists || !finalState.sha256) {
              throw new Error(`The applied file is no longer present: ${operation.path}`);
            }
            if (finalState.sha256 !== operation.newSha256) {
              throw new Error(
                `The applied file hash does not match the prepared content: ${operation.path}`,
              );
            }
            return [operation.path, finalState.sha256] as const;
          }),
        ),
      );
      const commitOperation = registerAppliedRepositoryOperation({
        files: plan.operations.map((operation) => ({
          path: operation.path,
          action: operation.expectedSha256 ? "update" : "create",
          hash: finalFileHashes[operation.path],
        })),
      });
      plans.delete(plan.id);
      const verification = plan.verificationProfile
        ? runVerificationProfile(plan.verificationProfile)
        : undefined;
      return {
        status:
          verification && !verification.passed ? "applied_with_verification_failures" : "applied",
        auditId: id,
        planId: plan.id,
        requestedBy: plan.requestedBy,
        profile: plan.profile,
        verificationProfile: plan.verificationProfile ?? plan.profile,
        verificationRequired: verification?.passed !== true,
        files: changed,
        fileSummaries: plan.fileSummaries,
        totalBytes: plan.totalBytes,
        finalFileHashes,
        message:
          verification && !verification.passed
            ? "Change applied, but verification reported failures."
            : "Change applied. Review the result before committing.",
        operationId: commitOperation.operationId,
        approvalHash: commitOperation.approvalHash,
        verification,
      };
    } catch (error) {
      for (const [path, backup] of [...backups].reverse()) {
        if (backup.exists && backup.content !== null) {
          await atomicWrite(path, backup.content, `${plan.id}-rollback`);
        } else {
          const { absolutePath } = await safeAbsolutePath(path);
          await rm(absolutePath, { force: true }).catch(() => undefined);
        }
      }
      return {
        status: "failed",
        auditId: id,
        planId: plan.id,
        requestedBy: plan.requestedBy,
        profile: plan.profile,
        verificationProfile: plan.verificationProfile ?? plan.profile,
        verificationRequired: true,
        message:
          error instanceof Error ? error.message : "Repository change failed and was rolled back.",
      };
    }
  });
}

export function readRepositoryChangeDiff(input: {
  readonly planId: string;
  readonly applyToken: string;
  readonly offset?: number;
  readonly maxChars?: number;
}): Record<string, unknown> {
  const plan = getPlan(input.planId, input.applyToken);
  return diffResult(
    "repository-change",
    { planId: plan.id },
    readDiffChunk(plan.diff, input.offset, input.maxChars),
  );
}

export function verifyRepositoryChange(input: {
  readonly profile: RepositoryVerificationProfile;
  readonly checks?: readonly import("./policy.ts").SafeVerificationCheck[];
}): RepositoryChangeResult {
  const id = auditId();
  try {
    const verification = runVerificationProfile(input.profile, input.checks);
    return {
      status: verification.passed ? "verified" : "failed",
      auditId: id,
      message: verification.passed ? "Verification passed." : "Verification reported failures.",
      verification,
    };
  } catch (error) {
    return {
      status: "rejected",
      auditId: id,
      message: error instanceof Error ? error.message : "Verification was rejected.",
    };
  }
}
