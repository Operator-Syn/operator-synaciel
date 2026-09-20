export type SnippetStructuredDataInput = {
  canonicalUrl: string;
  format: "pdf" | "md";
  modified: string;
  name: string;
  readingTimeMinutes: number | null;
};

const SQLITE_DATE_TIME_PATTERN = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(?:\.(\d{1,9}))?$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function normalizeSchemaDate(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const sqliteDateTime = trimmed.match(SQLITE_DATE_TIME_PATTERN);
  if (sqliteDateTime) {
    const [, date, time, fraction] = sqliteDateTime;
    return `${date}T${time}${fraction ? `.${fraction}` : ""}Z`;
  }

  if (ISO_DATE_PATTERN.test(trimmed)) return trimmed;

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return undefined;

  return parsed.toISOString();
}

export function createSnippetStructuredData({
  canonicalUrl,
  format,
  modified,
  name,
  readingTimeMinutes,
}: SnippetStructuredDataInput): Record<string, unknown> {
  const dateModified = normalizeSchemaDate(modified);

  return {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: name,
    ...(dateModified ? { dateModified } : {}),
    encodingFormat: format === "md" ? "text/markdown" : "application/pdf",
    url: canonicalUrl,
    ...(readingTimeMinutes === null ? {} : { timeRequired: `PT${readingTimeMinutes}M` }),
    isPartOf: {
      "@type": "CollectionPage",
      name: "Code Snippets",
      url: "https://syn-forge.com/snippets/",
    },
  };
}
