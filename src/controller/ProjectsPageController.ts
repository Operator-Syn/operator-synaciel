// src/controller/ProjectsPageController.ts
import type { Context } from "hono";
import type { Bindings } from "../Api";
import { decodeProjectCursor, ProjectsPageModel } from "../model/ProjectsPageModel";
import { respondWithInternalError } from "../utils/serverErrors";

const DEFAULT_PAGE_SIZE = 4;
const MAX_PAGE_SIZE = 12;

function parsePageSize(value: string | undefined) {
  if (value === undefined) return DEFAULT_PAGE_SIZE;

  const pageSize = Number(value);
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE) {
    return null;
  }

  return pageSize;
}

export const ProjectsPageController = {
  async handleProjects(c: Context<{ Bindings: Bindings }>) {
    try {
      const query = c.req.query();
      const limit = parsePageSize(query.limit);

      if (limit === null) {
        return c.json({ error: `limit must be an integer between 1 and ${MAX_PAGE_SIZE}` }, 400);
      }

      if (query.offset !== undefined) {
        return c.json({ error: "Offset pagination is not supported for the project archive" }, 400);
      }

      const cursor = query.cursor ? decodeProjectCursor(query.cursor) : null;
      if (query.cursor && !cursor) {
        return c.json({ error: "Invalid project cursor" }, 400);
      }

      const model = new ProjectsPageModel(c.env.DB);
      const page = await model.getPage({ limit, cursor });

      return c.json({
        data: page.projects,
        pagination: {
          limit: page.limit,
          total: page.total,
          has_more: page.has_more,
          next_cursor: page.next_cursor,
        },
      });
    } catch (err: unknown) {
      return respondWithInternalError(c, "ProjectsPageController.handleProjects", err);
    }
  },
};
