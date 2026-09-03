import { randomToken } from "./crypto.ts";

const THREAD_ID_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;
const EMPTY_ORIGINS = new Set<string>();

export function isValidThreadId(value: string): boolean {
  return THREAD_ID_PATTERN.test(value);
}

export function createOpaqueId(): string {
  return randomToken(18);
}

export function safeDisplayName(value: string): string {
  return Array.from(value.trim())
    .filter((character) => character.charCodeAt(0) > 31)
    .join("")
    .slice(0, 120);
}

export function safeGoogleProfilePictureUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  if (!trimmed || trimmed.length > 2_048) return null;
  try {
    const parsed = new URL(trimmed);
    const hostname = parsed.hostname.toLowerCase();
    if (
      parsed.protocol !== "https:" ||
      parsed.username ||
      parsed.password ||
      parsed.port ||
      (hostname !== "googleusercontent.com" && !hostname.endsWith(".googleusercontent.com"))
    ) {
      return null;
    }
    return parsed.href;
  } catch {
    return null;
  }
}

export function parseBrowserOrigins(value: string | undefined): ReadonlySet<string> {
  const origins = new Set<string>();
  for (const candidate of value?.split(",") ?? []) {
    const trimmed = candidate.trim();
    if (!trimmed) continue;
    try {
      const parsed = new URL(trimmed);
      if (
        (parsed.protocol === "http:" || parsed.protocol === "https:") &&
        parsed.pathname === "/" &&
        parsed.search === "" &&
        parsed.hash === ""
      ) {
        origins.add(parsed.origin);
      }
    } catch {
      // Ignore malformed origin entries and keep the valid configured origins.
    }
  }
  return origins;
}

export function isAllowedBrowserOrigin(
  origin: string | undefined,
  allowedOrigins: ReadonlySet<string> = EMPTY_ORIGINS,
): boolean {
  return origin === undefined || allowedOrigins.has(origin);
}

export function sanitizeReturnTo(
  candidate: string | undefined,
  portfolioOrigin: string,
  allowedOrigins?: ReadonlySet<string>,
): string {
  const fallback = portfolioOrigin.replace(/\/$/, "");
  if (!candidate) return fallback;
  try {
    const parsed = new URL(candidate);
    const configured = new URL(fallback);
    if (parsed.origin !== configured.origin && !allowedOrigins?.has(parsed.origin)) return fallback;
    return parsed.href;
  } catch {
    return fallback;
  }
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function readString(
  record: Record<string, unknown>,
  key: string,
  maxLength = 512,
): string | null {
  const value = record[key];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= maxLength ? trimmed : null;
}
