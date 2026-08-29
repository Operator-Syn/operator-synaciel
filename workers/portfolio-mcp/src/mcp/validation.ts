import { MAX_GITHUB_COMMIT_PAGE } from "../config.ts";
import { PortfolioApiError } from "../portfolio-api/errors.ts";

const GITHUB_SHA_PATTERN = /^[0-9a-f]{40}$/i;

export function safeLimit(value: number | undefined, fallback: number, maximum: number): number {
  if (value === undefined) return fallback;
  if (!Number.isSafeInteger(value)) throw new Error("Invalid pagination limit.");
  return Math.min(Math.max(value, 1), maximum);
}

export function safeId(value: number): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error("Invalid portfolio identifier.");
  }

  return value;
}

export function safeGitHubSha(value: string): string {
  const sha = value.trim();
  if (!GITHUB_SHA_PATTERN.test(sha)) {
    throw new PortfolioApiError("The requested commit identifier is invalid.", 400);
  }
  return sha.toLowerCase();
}

export function encodeGitHubCommitCursor(page: number): string {
  return `main:${page}`;
}

export function decodeGitHubCommitCursor(cursor: string | undefined): number {
  if (cursor === undefined) return 1;

  const match = /^main:([1-9][0-9]*)$/.exec(cursor.trim());
  const page = match ? Number(match[1]) : Number.NaN;
  if (!Number.isSafeInteger(page) || page < 1 || page > MAX_GITHUB_COMMIT_PAGE) {
    throw new PortfolioApiError("The GitHub commit cursor is invalid.", 400);
  }
  return page;
}
