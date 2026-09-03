import { lstat, readFile } from "node:fs/promises";
import { RepositoryDomainError } from "./errors.ts";
import {
  digestBytes,
  isLikelyBinaryPath,
  MAX_FILE_BYTES,
  safeAbsolutePath,
  validateLocalProjectRoot,
  validateRelativeProjectPath,
} from "./path.ts";
import {
  DEFAULT_SOURCE_READ_CHUNK_CHARACTERS,
  isProfilePathAllowed,
  MAX_PREPARED_FILES,
  MAX_SOURCE_READ_CHUNK_CHARACTERS,
  MAX_SOURCE_READ_RESPONSE_CHARACTERS,
  type RepositoryWriteProfile,
} from "./policy.ts";
import type { ReadPermissionScope, RepositoryReadPermissionStore } from "./read-permissions.ts";
import { isCredentialLikeContent, isSensitiveFileName } from "./redaction.ts";

export type RepositoryFileReadRequest = {
  readonly profile: RepositoryWriteProfile;
  readonly files: readonly {
    readonly path: string;
    readonly offset?: number;
    readonly startLine?: number;
    readonly endLine?: number;
  }[];
  readonly maxChars?: number;
  readonly permissionToken?: string;
};

export type RepositoryFileReadOptions = {
  readonly permissionStore?: RepositoryReadPermissionStore;
  readonly requestPermission?: (request: {
    readonly profile: RepositoryWriteProfile;
    readonly paths: readonly string[];
  }) => Promise<ReadPermissionScope | null>;
};

export type RepositoryFileRead = {
  readonly path: string;
  readonly exists: boolean;
  readonly content: string;
  readonly sha256: string | null;
  readonly offset: number;
  readonly nextOffset: number | null;
  readonly totalCharacters: number;
  readonly totalBytes: number;
  readonly complete: boolean;
  readonly startLine?: number;
  readonly endLine?: number;
  readonly nextLine?: number | null;
  readonly totalLines?: number;
};

export type RepositoryFileReadResult = {
  readonly kind: "repository-files";
  readonly profile: RepositoryWriteProfile;
  readonly files: readonly RepositoryFileRead[];
  readonly omittedPaths: readonly string[];
  readonly returnedCharacters: number;
};

export function validateRepositoryReadPath(input: string): string {
  let path: string;
  try {
    path = validateRelativeProjectPath(input, { allowRestrictedPaths: true });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Path ${JSON.stringify(input)} cannot be read: ${reason}`);
  }
  if (path.split("/").some((part) => isSensitiveFileName(part))) {
    throw new Error(`Path ${JSON.stringify(path)} is a sensitive environment or credential file.`);
  }
  if (isLikelyBinaryPath(path)) {
    throw new Error(
      `Path ${JSON.stringify(path)} is a binary file and cannot be read through repository source snapshots.`,
    );
  }
  return path;
}

export function formatProfileDenial(
  profile: RepositoryWriteProfile,
  paths: readonly string[],
): string {
  const labels = paths.map((path) => JSON.stringify(path));
  const subject = labels.length === 1 ? `Path ${labels[0]}` : `Paths ${labels.join(", ")}`;
  const verb = labels.length === 1 ? "is" : "are";
  return `${subject} ${verb} not allowed by the ${profile} read profile.`;
}

function permissionInstructions(profile: RepositoryWriteProfile, paths: readonly string[]): string {
  return `${formatProfileDenial(profile, paths)} Ask the user whether to grant temporary access for these exact paths or add them to the persistent user-local allowlist. Then call grant_repository_read_access with approve:true and retry; temporary access requires the returned permissionToken.`;
}

function splitLines(content: string): string[] {
  if (content.length === 0) return [];
  return (
    content
      .match(/[^\r\n]*(?:\r\n|\n|\r|$)/g)
      ?.filter((line, index, lines) => !(index === lines.length - 1 && line === "")) ?? []
  );
}

function readLineRange(
  content: string,
  startLine: number,
  endLine: number,
  maxChars: number,
  path: string,
): {
  readonly content: string;
  readonly endLine: number;
  readonly nextLine: number | null;
  readonly totalLines: number;
} {
  const lines = splitLines(content);
  if (
    !Number.isInteger(startLine) ||
    !Number.isInteger(endLine) ||
    startLine < 1 ||
    endLine < startLine ||
    endLine - startLine + 1 > 500 ||
    (lines.length > 0 && startLine > lines.length) ||
    (lines.length > 0 && endLine > lines.length)
  ) {
    throw new RepositoryDomainError(`Line range is invalid for ${path}.`, "LINE_RANGE_INVALID", {
      retryable: true,
      nextAction: { tool: "search_repository" },
    });
  }
  if (lines.length === 0) {
    throw new RepositoryDomainError(`Line range is invalid for ${path}.`, "LINE_RANGE_INVALID", {
      retryable: true,
      nextAction: { tool: "search_repository" },
    });
  }
  let result = "";
  let actualEnd = startLine - 1;
  for (let line = startLine; line <= endLine; line += 1) {
    const next = result + lines[line - 1];
    if (next.length > maxChars) {
      if (actualEnd < startLine) {
        throw new RepositoryDomainError(
          `The requested line is longer than the read limit for ${path}; retry with character-offset mode.`,
          "LINE_TOO_LONG",
          { retryable: true, nextAction: { tool: "read_repository_files" } },
        );
      }
      break;
    }
    result = next;
    actualEnd = line;
  }
  return {
    content: result,
    endLine: actualEnd,
    nextLine: actualEnd < endLine || actualEnd < lines.length ? actualEnd + 1 : null,
    totalLines: lines.length,
  };
}

async function readRepositoryFile(path: string): Promise<{
  readonly exists: boolean;
  readonly content: string;
  readonly sha256: string | null;
}> {
  const { absolutePath } = await safeAbsolutePath(path, { allowRestrictedPaths: true });
  const info = await lstat(absolutePath).catch(() => null);
  if (!info) return { exists: false, content: "", sha256: null };
  if (!info.isFile()) throw new Error(`The repository path is not a regular file: ${path}`);
  if (info.size > MAX_FILE_BYTES) {
    throw new Error(`The repository file is too large to read: ${path}`);
  }
  const bytes = await readFile(absolutePath);
  const content = bytes.toString("utf8");
  if (content.includes("\0")) throw new Error(`Binary file content is not readable: ${path}`);
  if (!Buffer.from(content, "utf8").equals(bytes)) {
    throw new RepositoryDomainError(
      `Invalid text encoding cannot be read through repository source snapshots: ${path}`,
      "CONTENT_GUARD_REJECTED",
    );
  }
  if (isCredentialLikeContent(content)) {
    throw new Error(`Credential-like content cannot be read: ${path}`);
  }
  return { exists: true, content, sha256: digestBytes(bytes) };
}

export async function readRepositoryFiles(
  request: RepositoryFileReadRequest,
  options: RepositoryFileReadOptions = {},
): Promise<RepositoryFileReadResult> {
  const root = await validateLocalProjectRoot();
  if (!root.valid) throw new Error(root.reason);
  if (request.files.length === 0 || request.files.length > MAX_PREPARED_FILES) {
    throw new Error(`Read between 1 and ${MAX_PREPARED_FILES} repository files.`);
  }
  const maxChars = request.maxChars ?? DEFAULT_SOURCE_READ_CHUNK_CHARACTERS;
  if (!Number.isInteger(maxChars) || maxChars < 1 || maxChars > MAX_SOURCE_READ_CHUNK_CHARACTERS) {
    throw new Error(
      `maxChars must be an integer between 1 and ${MAX_SOURCE_READ_CHUNK_CHARACTERS.toLocaleString()}.`,
    );
  }

  const paths = request.files.map((file) => validateRepositoryReadPath(file.path));
  if (new Set(paths).size !== paths.length) {
    throw new Error("Duplicate repository file paths are not allowed.");
  }
  for (const file of request.files) {
    const lineMode = file.startLine !== undefined || file.endLine !== undefined;
    const offsetMode = file.offset !== undefined;
    if (lineMode && offsetMode) {
      throw new RepositoryDomainError(
        "A repository read must use either offset mode or line mode, not both.",
        "INVALID_REQUEST",
      );
    }
    if (lineMode && (file.startLine === undefined || file.endLine === undefined)) {
      throw new RepositoryDomainError(
        "Line mode requires both startLine and endLine.",
        "LINE_RANGE_INVALID",
        { retryable: true, nextAction: { tool: "search_repository" } },
      );
    }
  }

  const persistentAllowances = options.permissionStore
    ? await Promise.all(
        paths.map((path) => options.permissionStore?.isPermanentlyAllowed(request.profile, path)),
      )
    : paths.map(() => false);
  const deniedPaths = paths.filter(
    (path, index) => !isProfilePathAllowed(request.profile, path) && !persistentAllowances[index],
  );
  let temporaryPermissionUsed = false;
  if (deniedPaths.length > 0) {
    const hasTemporaryPermission =
      Boolean(request.permissionToken) &&
      Boolean(
        options.permissionStore?.coversTemporaryGrant(
          request.profile,
          deniedPaths,
          request.permissionToken ?? "",
        ),
      );
    let permissionGranted = hasTemporaryPermission;
    if (!hasTemporaryPermission && options.requestPermission) {
      let scope: ReadPermissionScope | null;
      try {
        scope = await options.requestPermission({
          profile: request.profile,
          paths: deniedPaths,
        });
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        throw new RepositoryDomainError(
          `${permissionInstructions(request.profile, deniedPaths)} ${reason}`,
          "READ_PERMISSION_REQUIRED",
          {
            retryable: true,
            nextAction: { tool: "grant_repository_read_access" },
          },
        );
      }
      if (scope !== "temporary" && scope !== "permanent") {
        throw new RepositoryDomainError(
          permissionInstructions(request.profile, deniedPaths),
          "READ_PERMISSION_REQUIRED",
          {
            retryable: true,
            nextAction: { tool: "grant_repository_read_access" },
          },
        );
      }
      if (!options.permissionStore) {
        throw new RepositoryDomainError(
          `${permissionInstructions(request.profile, deniedPaths)} Permission storage is unavailable.`,
          "READ_PERMISSION_REQUIRED",
          {
            retryable: true,
            nextAction: { tool: "grant_repository_read_access" },
          },
        );
      }
      const grant = await options.permissionStore.grant(request.profile, deniedPaths, scope);
      if (scope === "temporary") {
        if (!grant.permissionToken) {
          throw new Error("The temporary repository read permission did not return a token.");
        }
        request = { ...request, permissionToken: grant.permissionToken };
        temporaryPermissionUsed = true;
      }
      permissionGranted = true;
    }
    if (!permissionGranted) {
      throw new RepositoryDomainError(
        permissionInstructions(request.profile, deniedPaths),
        "READ_PERMISSION_REQUIRED",
        {
          retryable: true,
          nextAction: { tool: "grant_repository_read_access" },
        },
      );
    }
    if (hasTemporaryPermission) temporaryPermissionUsed = true;
  }

  const states = await Promise.all(paths.map((path) => readRepositoryFile(path)));
  let remaining = MAX_SOURCE_READ_RESPONSE_CHARACTERS;
  const files: RepositoryFileRead[] = [];
  const omittedPaths: string[] = [];

  for (let index = 0; index < paths.length; index += 1) {
    const path = paths[index];
    const requestedOffset = request.files[index].offset ?? 0;
    const state = states[index];
    if (remaining <= 0) {
      omittedPaths.push(path);
      continue;
    }
    const lineMode =
      request.files[index].startLine !== undefined || request.files[index].endLine !== undefined;
    if (lineMode) {
      if (!state.exists) {
        files.push({
          path,
          exists: false,
          content: "",
          sha256: null,
          offset: 0,
          nextOffset: null,
          totalCharacters: 0,
          totalBytes: 0,
          complete: true,
          startLine: request.files[index].startLine,
          endLine: request.files[index].endLine,
          nextLine: null,
          totalLines: 0,
        });
        continue;
      }
      const range = readLineRange(
        state.content,
        request.files[index].startLine ?? 1,
        request.files[index].endLine ?? 1,
        Math.min(maxChars, remaining),
        path,
      );
      remaining -= range.content.length;
      files.push({
        path,
        exists: state.exists,
        content: range.content,
        sha256: state.sha256,
        offset: 0,
        nextOffset: null,
        totalCharacters: state.content.length,
        totalBytes: Buffer.byteLength(state.content, "utf8"),
        complete: range.nextLine === null,
        startLine: request.files[index].startLine,
        endLine: range.endLine,
        nextLine: range.nextLine,
        totalLines: range.totalLines,
      });
      continue;
    }
    if (
      !Number.isInteger(requestedOffset) ||
      requestedOffset < 0 ||
      requestedOffset > state.content.length
    ) {
      throw new Error(`Source offset must be within the requested file: ${path}`);
    }
    const chunkEnd = Math.min(
      requestedOffset + maxChars,
      state.content.length,
      requestedOffset + remaining,
    );
    const content = state.content.slice(requestedOffset, chunkEnd);
    remaining -= content.length;
    files.push({
      path,
      exists: state.exists,
      content,
      sha256: state.sha256,
      offset: requestedOffset,
      nextOffset: chunkEnd < state.content.length ? chunkEnd : null,
      totalCharacters: state.content.length,
      totalBytes: Buffer.byteLength(state.content, "utf8"),
      complete: chunkEnd >= state.content.length,
    });
  }

  const result: RepositoryFileReadResult = {
    kind: "repository-files",
    profile: request.profile,
    files,
    omittedPaths,
    returnedCharacters: MAX_SOURCE_READ_RESPONSE_CHARACTERS - remaining,
  };
  if (temporaryPermissionUsed)
    options.permissionStore?.consumeTemporaryGrant(request.permissionToken ?? "");
  return result;
}
