import { lstat, readFile } from "node:fs/promises";

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
import { isCredentialLikeContent, isSensitiveFileName } from "./redaction.ts";

export type RepositoryFileReadRequest = {
  readonly profile: RepositoryWriteProfile;
  readonly files: readonly { readonly path: string; readonly offset?: number }[];
  readonly maxChars?: number;
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
};

export type RepositoryFileReadResult = {
  readonly kind: "repository-files";
  readonly profile: RepositoryWriteProfile;
  readonly files: readonly RepositoryFileRead[];
  readonly omittedPaths: readonly string[];
  readonly returnedCharacters: number;
};

function validateReadPath(profile: RepositoryWriteProfile, input: string): string {
  const path = validateRelativeProjectPath(input, { allowRestrictedPaths: true });
  if (!isProfilePathAllowed(profile, path)) {
    throw new Error(`Path is not allowed by the ${profile} read profile.`);
  }
  if (path.split("/").some((part) => isSensitiveFileName(part))) {
    throw new Error("Sensitive environment and credential files cannot be read.");
  }
  if (isLikelyBinaryPath(path)) {
    throw new Error("Binary file paths cannot be read through repository source snapshots.");
  }
  return path;
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
  if (isCredentialLikeContent(content)) {
    throw new Error(`Credential-like content cannot be read: ${path}`);
  }
  return { exists: true, content, sha256: digestBytes(bytes) };
}

export async function readRepositoryFiles(
  request: RepositoryFileReadRequest,
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

  const paths = request.files.map((file) => validateReadPath(request.profile, file.path));
  if (new Set(paths).size !== paths.length) {
    throw new Error("Duplicate repository file paths are not allowed.");
  }
  const states = await Promise.all(paths.map((path) => readRepositoryFile(path)));
  let remaining = MAX_SOURCE_READ_RESPONSE_CHARACTERS;
  const files: RepositoryFileRead[] = [];
  const omittedPaths: string[] = [];

  for (let index = 0; index < paths.length; index += 1) {
    const path = paths[index];
    const requestedOffset = request.files[index].offset ?? 0;
    const state = states[index];
    if (
      !Number.isInteger(requestedOffset) ||
      requestedOffset < 0 ||
      requestedOffset > state.content.length
    ) {
      throw new Error(`Source offset must be within the requested file: ${path}`);
    }
    if (remaining <= 0) {
      omittedPaths.push(path);
      continue;
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

  return {
    kind: "repository-files",
    profile: request.profile,
    files,
    omittedPaths,
    returnedCharacters: MAX_SOURCE_READ_RESPONSE_CHARACTERS - remaining,
  };
}
