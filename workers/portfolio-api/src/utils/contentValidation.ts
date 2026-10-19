export type MediaType = "video" | "image";

export type ContentRecord = Record<string, unknown>;

export function asContentRecord(value: unknown): ContentRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as ContentRecord;
}

export async function readContentRecord(
  request: Pick<Request, "json">,
): Promise<ContentRecord | null> {
  try {
    return asContentRecord(await request.json());
  } catch {
    return null;
  }
}

export function parsePositiveId(value: unknown): number | null {
  if (typeof value === "string" && !/^\d+$/.test(value)) return null;
  const parsed = typeof value === "number" || typeof value === "string" ? Number(value) : NaN;
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export function parseNonNegativeInteger(value: unknown): number | null {
  if (typeof value !== "number") return null;
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

export function parseBoundedText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text.length > 0 && text.length <= maxLength ? text : null;
}

export function parseOptionalText(value: unknown, maxLength: number): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return null;
  return value.length <= maxLength ? value : null;
}

export function parseMediaType(value: unknown): MediaType | null {
  return value === "video" || value === "image" ? value : null;
}

export type StringListNormalization = "token" | "text";

export function parseStringList(
  value: unknown,
  options: {
    maxItems: number;
    maxLength: number;
    normalize: StringListNormalization;
  },
): string[] | null {
  if (!Array.isArray(value) || value.length > options.maxItems) return null;

  const seen = new Set<string>();
  const items: string[] = [];

  for (const entry of value) {
    if (typeof entry !== "string") return null;
    const normalized =
      options.normalize === "token"
        ? entry
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9+#._-]+/g, "-")
            .replace(/[_]+/g, "-")
            .replace(/-+/g, "-")
            .replace(/^[.-]+|[.-]+$/g, "")
        : entry.trim();
    if (normalized.length === 0 || normalized.length > options.maxLength) return null;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    items.push(normalized);
  }

  return items;
}

export function parseJsonStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  if (typeof value !== "string") return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

export function serializeJsonStringArray(value: string[] | undefined): string {
  return JSON.stringify(Array.isArray(value) ? value : []);
}

export function hasOnlyKnownKeys(value: ContentRecord, allowed: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}
