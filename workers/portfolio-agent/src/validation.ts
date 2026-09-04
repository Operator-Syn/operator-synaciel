const EMPTY_ORIGINS = new Set<string>();
const THREAD_ID_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;

export function isValidThreadId(value: string): boolean {
  return THREAD_ID_PATTERN.test(value);
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
  origin: string | null,
  allowedOrigins: ReadonlySet<string> = EMPTY_ORIGINS,
): boolean {
  return origin === null || allowedOrigins.has(origin);
}
