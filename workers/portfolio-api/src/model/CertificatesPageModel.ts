import type { D1Database } from "@cloudflare/workers-types";

export type CertificateMediaType = "video" | "image";

export interface CertificateArchiveItem {
  id: number;
  certificate_id: number;
  type: CertificateMediaType;
  url: string;
  display_order: number;
}

export interface CertificateArchiveCertificate {
  id: number;
  title: string;
  type: CertificateMediaType;
  url: string;
  short_description: string;
  long_description: string;
  certificate_link: string | null;
  display_order: number;
  created_at: string;
  items: CertificateArchiveItem[];
}

export interface CertificateCursor {
  display_order: number;
  id: number;
}

export interface CertificateArchivePage {
  certificates: CertificateArchiveCertificate[];
  total: number;
  limit: number;
  has_more: boolean;
  next_cursor: string | null;
}

interface CertificateRow {
  id: number;
  title: string;
  type: string;
  url: string;
  short_description: string;
  long_description: string;
  certificate_link: string | null;
  display_order: number | null;
  created_at: string | null;
}

interface CertificateItemRow {
  id: number;
  certificate_id: number;
  type: string;
  url: string;
  display_order: number | null;
}

const CURSOR_VERSION = 1;

function toBase64Url(value: string) {
  return btoa(value).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function fromBase64Url(value: string) {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/");
  return atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, "="));
}

export function encodeCertificateCursor(cursor: CertificateCursor) {
  return toBase64Url(
    JSON.stringify({
      v: CURSOR_VERSION,
      order: cursor.display_order,
      id: cursor.id,
    }),
  );
}

export function decodeCertificateCursor(value: string): CertificateCursor | null {
  try {
    const parsed = JSON.parse(fromBase64Url(value)) as {
      v?: unknown;
      order?: unknown;
      id?: unknown;
    };

    if (
      parsed.v !== CURSOR_VERSION ||
      !Number.isSafeInteger(parsed.order) ||
      !Number.isSafeInteger(parsed.id) ||
      Number(parsed.id) <= 0
    ) {
      return null;
    }

    return {
      display_order: Number(parsed.order),
      id: Number(parsed.id),
    };
  } catch {
    return null;
  }
}

function normalizeDisplayOrder(value: number | null) {
  return Number.isInteger(value) ? Number(value) : 0;
}

function normalizeMediaType(value: string): CertificateMediaType {
  return value === "video" ? "video" : "image";
}

function toCertificate(row: CertificateRow): CertificateArchiveCertificate {
  return {
    id: Number(row.id),
    title: String(row.title),
    type: normalizeMediaType(row.type),
    url: String(row.url),
    short_description: String(row.short_description),
    long_description: String(row.long_description),
    certificate_link: row.certificate_link === null ? null : String(row.certificate_link),
    display_order: normalizeDisplayOrder(row.display_order),
    created_at: row.created_at ? String(row.created_at) : "",
    items: [],
  };
}

function toCertificateItem(row: CertificateItemRow): CertificateArchiveItem {
  return {
    id: Number(row.id),
    certificate_id: Number(row.certificate_id),
    type: normalizeMediaType(row.type),
    url: String(row.url),
    display_order: normalizeDisplayOrder(row.display_order),
  };
}

export class CertificatesPageModel {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  async getPage(options: {
    limit: number;
    cursor: CertificateCursor | null;
  }): Promise<CertificateArchivePage> {
    const { limit, cursor } = options;
    const boundary = cursor
      ? "WHERE (COALESCE(c.display_order, 0) > ? " +
        "OR (COALESCE(c.display_order, 0) = ? AND c.id > ?))"
      : "";
    const pageBindings = cursor
      ? [cursor.display_order, cursor.display_order, cursor.id, limit + 1]
      : [limit + 1];

    const [certificateResult, totalResult] = await Promise.all([
      this.db
        .prepare(
          "SELECT c.id, c.title, c.type, c.url, c.short_description, " +
            "c.long_description, c.certificate_link, " +
            "COALESCE(c.display_order, 0) AS display_order, c.created_at " +
            "FROM Certificates c " +
            boundary +
            " ORDER BY COALESCE(c.display_order, 0) ASC, c.id ASC LIMIT ?",
        )
        .bind(...pageBindings)
        .all<CertificateRow>(),
      this.db.prepare("SELECT COUNT(*) AS total FROM Certificates").first<{ total: number }>(),
    ]);

    const rows = certificateResult.results ?? [];
    const hasMore = rows.length > limit;
    const certificates = rows.slice(0, limit).map(toCertificate);

    if (certificates.length > 0) {
      const certificateIds = certificates.map((certificate) => certificate.id);
      const placeholders = certificateIds.map(() => "?").join(", ");
      const itemResult = await this.db
        .prepare(
          "SELECT id, certificate_id, type, url, " +
            "COALESCE(display_order, 0) AS display_order " +
            "FROM CertificateItems " +
            "WHERE certificate_id IN (" +
            placeholders +
            ") " +
            "ORDER BY certificate_id ASC, COALESCE(display_order, 0) ASC, id ASC",
        )
        .bind(...certificateIds)
        .all<CertificateItemRow>();

      const itemsByCertificate = new Map<number, CertificateArchiveItem[]>();
      for (const row of itemResult.results ?? []) {
        const item = toCertificateItem(row);
        const items = itemsByCertificate.get(item.certificate_id) ?? [];
        items.push(item);
        itemsByCertificate.set(item.certificate_id, items);
      }

      for (const certificate of certificates) {
        certificate.items = itemsByCertificate.get(certificate.id) ?? [];
      }
    }

    const lastCertificate = certificates.at(-1);

    return {
      certificates,
      total: Number(totalResult?.total ?? 0),
      limit,
      has_more: hasMore,
      next_cursor:
        hasMore && lastCertificate
          ? encodeCertificateCursor({
              display_order: lastCertificate.display_order,
              id: lastCertificate.id,
            })
          : null,
    };
  }
}
