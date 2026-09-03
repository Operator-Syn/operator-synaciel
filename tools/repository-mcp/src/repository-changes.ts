import { randomUUID } from "node:crypto";
import { lstat, readFile, rename, rm } from "node:fs/promises";

import { registerAppliedRepositoryOperation } from "./commit-pipeline.ts";
import {
  buildDiffDocument,
  type DiffChunk,
  type DiffDocument,
  type DiffSection,
  previewDiff,
  readDiffChunk,
  renderDiffDocument,
} from "./diff.ts";
import { failureFields, RepositoryDomainError, type RepositoryReasonCode } from "./errors.ts";
import { REPOSITORY_MCP_INSTANCE_ID } from "./instance.ts";
import { withMutationLock } from "./mutation-lock.ts";
import {
  atomicWrite,
  digestBytes,
  isLikelyBinaryPath,
  isTrackedRepositoryPath,
  MAX_FILE_BYTES,
  safeAbsolutePath,
  validateLocalProjectRoot,
  validateRelativeProjectPath,
} from "./path.ts";
import {
  isProfilePathAllowed,
  MAX_PREPARED_FILES,
  MAX_RETAINED_REVIEW_BYTES,
  REPOSITORY_WRITE_PROFILES,
  type RepositoryVerificationProfile,
  type RepositoryWriteProfile,
} from "./policy.ts";
import { isCredentialLikeContent, isSensitiveFileName } from "./redaction.ts";
import { applyExactReplacements, type ExactReplacement } from "./text-edits.ts";
import {
  clearVerificationCache,
  runVerificationProfile,
  type VerificationSummary,
} from "./verification.ts";
import { invalidateWorkflowStatusCache } from "./workflow-status.ts";

const PLAN_TTL_MS = 30 * 60 * 1_000;
const MAX_PLANS = 100;

export type RepositoryChangeOperation = {
  readonly path: string;
  readonly action?: "write" | "edit" | "delete";
  readonly content?: string;
  readonly expectedSha256?: string;
  readonly allowContentShortening?: boolean;
  readonly replacements?: readonly ExactReplacement[];
};

export type RepositoryChangeRequest = {
  readonly description: string;
  readonly profile: RepositoryWriteProfile;
  readonly operations: readonly RepositoryChangeOperation[];
  readonly verificationProfile?: RepositoryVerificationProfile;
  readonly verifyOnApply?: boolean;
  readonly requestedBy?: string;
};

type FileState = {
  readonly exists: boolean;
  readonly sha256: string | null;
  readonly content: string | null;
};

type PreparedOperation = {
  readonly path: string;
  readonly action: "write" | "edit" | "delete";
  readonly content: string;
  readonly expectedSha256: string | null;
  readonly newSha256: string | null;
  readonly newBytes: number;
};

export type RepositoryChangeFileSummary =
  | {
      readonly path: string;
      readonly action?: "edit";
      readonly oldSha256: string | null;
      readonly newSha256: string;
      readonly newBytes: number;
    }
  | {
      readonly path: string;
      readonly action: "delete";
      readonly oldSha256: string;
      readonly newSha256: null;
      readonly newBytes: 0;
    };

type RepositoryPlan = {
  readonly id: string;
  readonly applyToken: string;
  readonly createdAt: string;
  readonly expiresAt: number;
  readonly requestedBy: string;
  readonly profile: RepositoryWriteProfile;
  readonly verificationProfile: RepositoryVerificationProfile | null;
  readonly verifyOnApply: boolean;
  readonly reviewHash: string;
  readonly instanceId: string;
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
  readonly verificationMode?: "deferred" | "on_apply";
  readonly verificationRequired?: boolean;
  readonly reasonCode?: RepositoryReasonCode;
  readonly retryable?: boolean;
  readonly nextAction?: { readonly tool: string };
  readonly files?: readonly string[];
  readonly fileSummaries?: readonly RepositoryChangeFileSummary[];
  readonly totalBytes?: number;
  readonly finalFileHashes?: Readonly<Record<string, string | null>>;
  readonly diff?: string;
  readonly diffTruncated?: boolean;
  readonly diffTotalCharacters?: number;
  readonly diffTotalBytes?: number;
  readonly diffNextOffset?: number | null;
  readonly omittedPaths?: readonly string[];
  readonly message: string;
  readonly verification?: VerificationSummary;
  readonly conflicts?: readonly {
    readonly path: string;
    readonly expectedSha256?: string | null;
    readonly currentSha256?: string | null;
  }[];
  readonly reviewHash?: string;
  readonly instanceId?: string;
  readonly expiresAt?: string;
  readonly applyToken?: string;
  readonly operationId?: string;
  readonly approvalHash?: string;
};

const plans = new Map<string, RepositoryPlan>();
type AppliedReceipt = {
  readonly planId: string;
  readonly applyToken: string;
  readonly reviewHash: string;
  readonly expiresAt: number;
  readonly result: RepositoryChangeResult;
};
const appliedReceipts = new Map<string, AppliedReceipt>();
let retainedPlanBytes = 0;

function planBytes(plan: RepositoryPlan): number {
  return plan.totalBytes + plan.diff.totalBytes;
}

function deletePlan(planId: string): void {
  const plan = plans.get(planId);
  if (!plan) return;
  retainedPlanBytes = Math.max(0, retainedPlanBytes - planBytes(plan));
  plans.delete(planId);
}

function pruneReceipts(): void {
  const now = Date.now();
  for (const [id, receipt] of appliedReceipts) {
    if (receipt.expiresAt <= now) appliedReceipts.delete(id);
  }
  while (appliedReceipts.size > MAX_PLANS) {
    const first = appliedReceipts.keys().next().value;
    if (!first) break;
    appliedReceipts.delete(first);
  }
}

function auditId(): string {
  return randomUUID();
}

function cleanRequestedBy(value: string | undefined): string {
  return (value?.trim() || "unknown-client").slice(0, 120);
}

function reviewHash(
  profile: RepositoryWriteProfile,
  operations: readonly PreparedOperation[],
  diff: DiffDocument,
): string {
  const canonical = JSON.stringify({
    profile,
    operations: operations.map((operation) => ({
      path: operation.path,
      action: operation.action,
      expectedSha256: operation.expectedSha256,
      newSha256: operation.newSha256,
      newBytes: operation.newBytes,
      content: operation.content,
    })),
    diff: renderDiffDocument(diff),
  });
  return digestBytes(Buffer.from(canonical, "utf8"));
}

function failureResult(
  id: string,
  message: string,
  error: unknown,
  fields: Partial<RepositoryChangeResult> = {},
): RepositoryChangeResult {
  const failure = failureFields(error);
  return {
    status: "rejected",
    auditId: id,
    message,
    instanceId: REPOSITORY_MCP_INSTANCE_ID,
    reasonCode: failure.reasonCode,
    retryable: failure.retryable,
    ...(failure.nextAction ? { nextAction: failure.nextAction } : {}),
    ...(failure.conflicts ? { conflicts: failure.conflicts } : {}),
    ...fields,
  };
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
  if (!Buffer.from(content, "utf8").equals(bytes)) {
    throw new RepositoryDomainError(
      `Invalid text encoding cannot be reviewed: ${path}`,
      "CONTENT_GUARD_REJECTED",
    );
  }
  if (isCredentialLikeContent(content))
    throw new Error(`Credential-like content cannot be reviewed: ${path}`);
  return { exists: true, sha256: digestBytes(bytes), content };
}

function validateWritePath(profile: RepositoryWriteProfile, input: string): string {
  let path: string;
  try {
    path = validateRelativeProjectPath(input, { allowRestrictedPaths: true });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Path ${JSON.stringify(input)} cannot be changed: ${reason}`);
  }
  if (!isProfilePathAllowed(profile, path)) {
    throw new Error(
      `Path ${JSON.stringify(path)} is not allowed by the ${profile} write profile. Write access is not widened by read permissions; retry with an explicitly approved broader write profile if appropriate.`,
    );
  }
  if (path.split("/").some((part) => isSensitiveFileName(part))) {
    throw new Error(`Path ${JSON.stringify(path)} is a sensitive environment or credential file.`);
  }
  if (isLikelyBinaryPath(path)) {
    throw new Error(
      `Path ${JSON.stringify(path)} is a binary file and cannot be changed through text repository changes.`,
    );
  }
  return path;
}

function buildDiff(
  operations: readonly PreparedOperation[],
  states: ReadonlyMap<string, FileState>,
): DiffDocument {
  const sections: DiffSection[] = operations.map((operation) => ({
    path: operation.path,
    before: states.get(operation.path)?.content ?? "",
    after: operation.content,
  }));
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

function prunePlans(incomingBytes = 0): void {
  const now = Date.now();
  for (const [id, plan] of plans) {
    if (plan.expiresAt <= now) deletePlan(id);
  }
  while (plans.size > MAX_PLANS || retainedPlanBytes + incomingBytes > MAX_RETAINED_REVIEW_BYTES) {
    const first = plans.keys().next().value;
    if (!first) break;
    deletePlan(first);
  }
}

export async function prepareRepositoryChange(
  request: RepositoryChangeRequest,
): Promise<RepositoryChangeResult> {
  const id = auditId();
  try {
    const root = await validateLocalProjectRoot();
    if (!root.valid) throw new Error(root.reason);
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
    const validated = request.operations.map((operation) => {
      const path = validateWritePath(request.profile, operation.path);
      if (seen.has(path)) throw new Error(`Duplicate file operation: ${path}`);
      seen.add(path);
      const action = operation.action ?? "write";
      if (action !== "write" && action !== "edit" && action !== "delete") {
        throw new Error(`Unsupported repository change action for ${path}.`);
      }
      if (action === "delete") {
        if (
          operation.content !== undefined ||
          operation.allowContentShortening !== undefined ||
          operation.replacements !== undefined
        ) {
          throw new Error(
            `Delete operations must omit content, replacements, and allowContentShortening: ${path}`,
          );
        }
        if (!operation.expectedSha256) {
          throw new Error(`Delete operations require expectedSha256: ${path}`);
        }
        return { operation, path, action, bytes: 0 };
      }
      if (action === "edit") {
        if (
          operation.content !== undefined ||
          operation.allowContentShortening !== undefined ||
          !operation.replacements ||
          operation.replacements.length === 0
        ) {
          throw new Error(
            `Edit operations require replacements and must omit content and allowContentShortening: ${path}`,
          );
        }
        if (!operation.expectedSha256) {
          throw new Error(`Edit operations require expectedSha256: ${path}`);
        }
        return { operation, path, action, bytes: 0 };
      }
      if (operation.replacements !== undefined) {
        throw new RepositoryDomainError(
          `Write operations must omit replacements; use action: edit for anchored changes: ${path}`,
          "INVALID_REQUEST",
        );
      }
      if (operation.content === undefined) {
        throw new Error(`Write operations require complete content: ${path}`);
      }
      if (isCredentialLikeContent(operation.content)) {
        throw new Error(`Credential-like content is not accepted: ${path}`);
      }
      if (operation.content.includes("\0")) {
        throw new Error(`Binary file content is not allowed: ${path}`);
      }
      const bytes = Buffer.byteLength(operation.content, "utf8");
      totalBytes += bytes;
      if (totalBytes > policy.maxBytes) {
        throw new Error(`The ${request.profile} profile permits at most ${policy.maxBytes} bytes.`);
      }
      return { operation, path, action, bytes };
    });

    const states = new Map(
      await Promise.all(
        validated.map(async ({ path }) => [path, await localFileState(path)] as const),
      ),
    );
    const prepared: PreparedOperation[] = [];
    const fileSummaries: RepositoryChangeFileSummary[] = [];
    for (const { operation, path, action, bytes } of validated) {
      const state = states.get(path);
      if (!state) throw new Error(`Could not capture the current state for: ${path}`);
      if (action === "delete") {
        if (!state.exists || !state.sha256 || !isTrackedRepositoryPath(path)) {
          throw new Error(`Delete targets must be existing tracked regular files: ${path}`);
        }
        if (operation.expectedSha256 !== state.sha256) {
          throw new Error(`Expected hash does not match the current file: ${path}`);
        }
        prepared.push({
          path,
          action,
          content: "",
          expectedSha256: state.sha256,
          newSha256: null,
          newBytes: 0,
        });
        fileSummaries.push({
          path,
          action: "delete",
          oldSha256: state.sha256,
          newSha256: null,
          newBytes: 0,
        });
        continue;
      }
      if (action === "edit") {
        if (!state.exists || state.content === null || !state.sha256) {
          throw new Error(`Edit targets must be existing regular files: ${path}`);
        }
        if (operation.expectedSha256 !== state.sha256) {
          throw new RepositoryDomainError(
            `Expected hash does not match the current file: ${path}`,
            "HASH_MISMATCH",
            { retryable: true, nextAction: { tool: "read_repository_files" } },
          );
        }
        const edited = applyExactReplacements(state.content, operation.replacements ?? []);
        if (!edited.ok) {
          throw new RepositoryDomainError(edited.error.message, edited.error.code, {
            retryable: true,
            nextAction: { tool: "read_repository_files" },
          });
        }
        const content = edited.content;
        if (isCredentialLikeContent(content) || content.includes("\0")) {
          throw new RepositoryDomainError(
            `The computed edit result is not safe to write: ${path}`,
            "CONTENT_GUARD_REJECTED",
          );
        }
        const newBytes = Buffer.byteLength(content, "utf8");
        totalBytes += newBytes;
        if (totalBytes > policy.maxBytes) {
          throw new Error(
            `The ${request.profile} profile permits at most ${policy.maxBytes} bytes.`,
          );
        }
        const newSha256 = digestBytes(Buffer.from(content, "utf8"));
        prepared.push({
          path,
          action,
          content,
          expectedSha256: state.sha256,
          newSha256,
          newBytes,
        });
        fileSummaries.push({
          path,
          action: "edit",
          oldSha256: state.sha256,
          newSha256,
          newBytes,
        });
        continue;
      }
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
      const content = operation.content;
      if (content === undefined) {
        throw new Error(`Write operations require complete content: ${path}`);
      }
      const newSha256 = digestBytes(Buffer.from(content, "utf8"));
      prepared.push({
        path,
        action,
        content,
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

    const diff = buildDiff(prepared, states);
    const verifyOnApply = request.verifyOnApply ?? request.verificationProfile !== undefined;

    const planId = randomUUID();
    const applyToken = randomUUID();
    const preparedDiffHash = reviewHash(request.profile, prepared, diff);
    const plan: RepositoryPlan = {
      id: planId,
      applyToken,
      createdAt: new Date().toISOString(),
      expiresAt: Date.now() + PLAN_TTL_MS,
      requestedBy: cleanRequestedBy(request.requestedBy),
      profile: request.profile,
      verificationProfile: request.verificationProfile ?? null,
      verifyOnApply,
      reviewHash: preparedDiffHash,
      instanceId: REPOSITORY_MCP_INSTANCE_ID,
      operations: prepared,
      fileSummaries,
      totalBytes,
      diff,
    };
    const retainedBytes = planBytes(plan);
    if (retainedBytes > MAX_RETAINED_REVIEW_BYTES) {
      throw new Error(
        `The prepared review exceeds the ${MAX_RETAINED_REVIEW_BYTES.toLocaleString()}-byte retention limit; split the change into smaller operations.`,
      );
    }
    prunePlans(retainedBytes);
    plans.set(planId, plan);
    retainedPlanBytes += retainedBytes;
    const preview = previewDiff(plan.diff);
    return {
      status: "prepared",
      auditId: id,
      planId,
      requestedBy: plan.requestedBy,
      profile: plan.profile,
      verificationProfile: plan.verificationProfile ?? plan.profile,
      verificationMode: plan.verifyOnApply ? "on_apply" : "deferred",
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
      reviewHash: plan.reviewHash,
      instanceId: plan.instanceId,
      expiresAt: new Date(plan.expiresAt).toISOString(),
      applyToken,
    };
  } catch (error) {
    return failureResult(
      id,
      error instanceof Error ? error.message : "Repository change was rejected.",
      error,
    );
  }
}

function getPlan(planId: string, applyToken: string): RepositoryPlan {
  prunePlans();
  const plan = plans.get(planId);
  if (!plan || plan.applyToken !== applyToken) {
    throw new RepositoryDomainError(
      "The repository plan or apply token is unavailable or stale.",
      "PLAN_UNAVAILABLE",
      {
        retryable: true,
        nextAction: { tool: "prepare_repository_change" },
      },
    );
  }
  return plan;
}

function unavailablePlan(
  id: string,
  message = "The repository plan is unavailable or stale.",
): RepositoryChangeResult {
  return {
    status: "rejected",
    auditId: id,
    message,
    reasonCode: "PLAN_UNAVAILABLE",
    retryable: true,
    instanceId: REPOSITORY_MCP_INSTANCE_ID,
    nextAction: { tool: "prepare_repository_change" },
  };
}

async function quarantineFile(relativePath: string, token: string): Promise<string> {
  const { absolutePath } = await safeAbsolutePath(relativePath);
  const tombstonePath = `${absolutePath}.operator-synaciel-delete-${token}-${randomUUID()}.tmp`;
  await rename(absolutePath, tombstonePath);
  return tombstonePath;
}

export async function applyRepositoryChange(input: {
  readonly planId: string;
  readonly applyToken: string;
  readonly reviewHash: string;
  readonly approve: true;
}): Promise<RepositoryChangeResult> {
  const id = auditId();
  pruneReceipts();
  const receipt = appliedReceipts.get(input.planId);
  if (receipt) {
    if (receipt.applyToken !== input.applyToken) {
      return unavailablePlan(id, "The repository plan token is invalid or stale.");
    }
    if (receipt.reviewHash !== input.reviewHash) {
      return {
        ...unavailablePlan(id, "The reviewed plan hash does not match the completed operation."),
        reasonCode: "REVIEW_HASH_MISMATCH",
        retryable: false,
        nextAction: undefined,
      };
    }
    return receipt.result;
  }

  prunePlans();
  const plan = plans.get(input.planId);
  if (!plan || plan.applyToken !== input.applyToken) {
    return unavailablePlan(id);
  }
  if (input.reviewHash !== plan.reviewHash) {
    return {
      status: "rejected",
      auditId: id,
      planId: plan.id,
      requestedBy: plan.requestedBy,
      profile: plan.profile,
      message: "The reviewed plan hash does not match the prepared change.",
      reasonCode: "REVIEW_HASH_MISMATCH",
      retryable: false,
      instanceId: plan.instanceId,
    };
  }
  return withMutationLock(async () => {
    const completed = appliedReceipts.get(input.planId);
    if (completed) {
      if (completed.applyToken !== input.applyToken) {
        return unavailablePlan(id, "The repository plan token is invalid or stale.");
      }
      if (completed.reviewHash !== input.reviewHash) {
        return {
          ...unavailablePlan(id, "The reviewed plan hash does not match the completed operation."),
          reasonCode: "REVIEW_HASH_MISMATCH" as const,
          retryable: false,
          nextAction: undefined,
        };
      }
      return completed.result;
    }
    const currentStates = new Map(
      await Promise.all(
        plan.operations.map(async (operation) => {
          const current = await localFileState(operation.path);
          return [operation.path, current] as const;
        }),
      ),
    );
    const conflicts = [
      ...plan.operations
        .filter((operation) => {
          const current = currentStates.get(operation.path);
          return current?.sha256 !== operation.expectedSha256;
        })
        .map((operation) => operation.path),
      ...plan.operations
        .filter(
          (operation) => operation.action === "delete" && !isTrackedRepositoryPath(operation.path),
        )
        .map((operation) => operation.path),
    ].filter((path, index, paths) => paths.indexOf(path) === index);
    if (conflicts.length > 0) {
      const conflictDetails = conflicts.map((path) => ({
        path,
        expectedSha256: plan.operations.find((operation) => operation.path === path)
          ?.expectedSha256,
        currentSha256: currentStates.get(path)?.sha256 ?? null,
      }));
      return {
        status: "conflict",
        auditId: id,
        planId: plan.id,
        requestedBy: plan.requestedBy,
        profile: plan.profile,
        verificationProfile: plan.verificationProfile ?? plan.profile,
        verificationMode: plan.verifyOnApply ? "on_apply" : "deferred",
        verificationRequired: true,
        message: "Collaborator changes detected; the plan is stale and was not applied.",
        conflicts: conflictDetails,
        reasonCode: "HASH_MISMATCH",
        retryable: true,
        nextAction: { tool: "read_repository_files" },
      };
    }

    const backups = currentStates;
    const changed: string[] = [];
    const tombstones = new Map<string, string>();
    try {
      for (const operation of plan.operations) {
        if (operation.action === "delete") {
          tombstones.set(operation.path, await quarantineFile(operation.path, plan.id));
        } else {
          await atomicWrite(operation.path, operation.content, plan.id);
        }
        changed.push(operation.path);
      }

      const finalFileHashes = Object.fromEntries(
        await Promise.all(
          plan.operations.map(async (operation) => {
            const finalState = await localFileState(operation.path);
            if (operation.action === "delete") {
              if (finalState.exists || finalState.sha256 !== null) {
                throw new Error(`The deleted file is still present: ${operation.path}`);
              }
              return [operation.path, null] as const;
            }
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
      for (const tombstonePath of tombstones.values()) {
        await rm(tombstonePath);
      }
      const commitOperation = registerAppliedRepositoryOperation({
        files: plan.operations.map((operation) => ({
          path: operation.path,
          action:
            operation.action === "delete"
              ? "delete"
              : operation.expectedSha256
                ? "update"
                : "create",
          hash: finalFileHashes[operation.path],
        })),
      });
      const verification =
        plan.verifyOnApply && plan.verificationProfile
          ? runVerificationProfile(plan.verificationProfile)
          : undefined;
      const result: RepositoryChangeResult = {
        status:
          verification && !verification.passed ? "applied_with_verification_failures" : "applied",
        auditId: id,
        planId: plan.id,
        requestedBy: plan.requestedBy,
        profile: plan.profile,
        verificationProfile: plan.verificationProfile ?? plan.profile,
        verificationMode: plan.verifyOnApply ? "on_apply" : "deferred",
        verificationRequired: verification?.passed !== true,
        ...(verification && !verification.passed
          ? { reasonCode: "VERIFICATION_FAILED" as const, retryable: false }
          : {}),
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
        reviewHash: plan.reviewHash,
        instanceId: plan.instanceId,
        expiresAt: new Date(plan.expiresAt).toISOString(),
      };
      appliedReceipts.set(plan.id, {
        planId: plan.id,
        applyToken: plan.applyToken,
        reviewHash: plan.reviewHash,
        expiresAt: Date.now() + PLAN_TTL_MS,
        result,
      });
      pruneReceipts();
      deletePlan(plan.id);
      clearVerificationCache();
      invalidateWorkflowStatusCache();
      return result;
    } catch (error) {
      for (const [path, backup] of [...backups].reverse()) {
        const tombstonePath = tombstones.get(path);
        if (tombstonePath && (await lstat(tombstonePath).catch(() => null))) {
          const { absolutePath } = await safeAbsolutePath(path);
          await rename(tombstonePath, absolutePath);
          continue;
        }
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
        verificationMode: plan.verifyOnApply ? "on_apply" : "deferred",
        verificationRequired: true,
        message:
          error instanceof Error ? error.message : "Repository change failed and was rolled back.",
        reasonCode: "APPLY_ROLLED_BACK",
        retryable: true,
        nextAction: { tool: "prepare_repository_change" },
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
      ...(verification.passed
        ? {}
        : { reasonCode: "VERIFICATION_FAILED" as const, retryable: false }),
      verification,
    };
  } catch (error) {
    return failureResult(
      id,
      error instanceof Error ? error.message : "Verification was rejected.",
      error,
    );
  }
}
