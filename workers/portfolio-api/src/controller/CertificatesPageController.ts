import type { Context } from "hono";
import type { Bindings } from "../bindings";
import { CertificatesPageModel, decodeCertificateCursor } from "../model/CertificatesPageModel";
import { respondWithInternalError } from "../utils/serverErrors";

const DEFAULT_PAGE_SIZE = 6;
const MAX_PAGE_SIZE = 12;

function parsePageSize(value: string | undefined) {
  if (value === undefined) return DEFAULT_PAGE_SIZE;

  const pageSize = Number(value);
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE) {
    return null;
  }

  return pageSize;
}

export const CertificatesPageController = {
  async handleCertificates(c: Context<{ Bindings: Bindings }>) {
    try {
      const query = c.req.query();
      const limit = parsePageSize(query.limit);

      if (limit === null) {
        return c.json({ error: "limit must be an integer between 1 and 12" }, 400);
      }

      if (query.offset !== undefined) {
        return c.json(
          { error: "Offset pagination is not supported for the certificate archive" },
          400,
        );
      }

      const cursor = query.cursor ? decodeCertificateCursor(query.cursor) : null;
      if (query.cursor && !cursor) {
        return c.json({ error: "Invalid certificate cursor" }, 400);
      }

      const model = new CertificatesPageModel(c.env.DB);
      const page = await model.getPage({ limit, cursor });

      return c.json({
        data: page.certificates,
        pagination: {
          limit: page.limit,
          total: page.total,
          has_more: page.has_more,
          next_cursor: page.next_cursor,
        },
      });
    } catch (err: unknown) {
      return respondWithInternalError(c, "CertificatesPageController.handleCertificates", err);
    }
  },
};
