// src/controller/SnippetsPage/SnippetsPageController.ts

import { type Context } from "hono";
import { type Bindings } from "../../Api";
import { SnippetsPageModel } from "../../model/SnippetsPage/SnippetsPageModel";
import { respondWithInternalError } from "../../utils/serverErrors";

type AppContext = Context<{ Bindings: Bindings }>;

function parsePositiveId(value: string | undefined): number | null {
  if (!value) return null;

  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  return id;
}

function parseOptionalParentId(value: FormDataEntryValue | null): number | null {
  if (value === null || value === "") {
    return null;
  }

  if (value instanceof File) {
    throw new Error("Invalid parent_id");
  }

  const parentId = Number(value);

  if (!Number.isInteger(parentId) || parentId <= 0) {
    throw new Error("Invalid parent_id");
  }

  return parentId;
}

function parseOptionalJsonParentId(value: unknown): number | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parentId = Number(value);

  if (!Number.isInteger(parentId) || parentId <= 0) {
    throw new Error("Invalid parent_id");
  }

  return parentId;
}

function parseOptionalDisplayOrder(value: unknown): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === "") {
    throw new Error("Invalid display_order");
  }

  const displayOrder = Number(value);

  if (!Number.isInteger(displayOrder) || displayOrder < 0) {
    throw new Error("Invalid display_order");
  }

  return displayOrder;
}

export const createSnippetsPageController = (prefix = "snippets/") => ({
  // GET /api/snippets
  getSnippets: async (c: AppContext) => {
    try {
      const model = new SnippetsPageModel(c.env.DB, c.env.BUCKET, prefix);
      const data = await model.getFileTree();

      return c.json({
        success: true,
        data,
      });
    } catch (err: unknown) {
      return respondWithInternalError(c, "SnippetsPageController.getSnippets", err);
    }
  },

  // GET /api/snippets/:id
  getSnippet: async (c: AppContext) => {
    try {
      const id = parsePositiveId(c.req.param("id"));

      if (!id) {
        return c.json({ error: "Invalid ID" }, 400);
      }

      const model = new SnippetsPageModel(c.env.DB, c.env.BUCKET, prefix);
      const data = await model.getSnippetById(id);

      if (!data) {
        return c.json({ error: "Snippet not found" }, 404);
      }

      return c.json({
        success: true,
        data,
      });
    } catch (err: unknown) {
      return respondWithInternalError(c, "SnippetsPageController.getSnippet", err);
    }
  },

  // GET /api/snippets/:id/content
  downloadSnippet: async (c: AppContext) => {
    try {
      const id = parsePositiveId(c.req.param("id"));

      if (!id) {
        return c.json({ error: "Invalid ID" }, 400);
      }

      const model = new SnippetsPageModel(c.env.DB, c.env.BUCKET, prefix);
      const result = await model.getFileContent(id);

      if (!result) {
        return c.json({ error: "File not found" }, 404);
      }

      return c.body(
        result.stream as unknown as ReadableStream,
        200,
        result.headers,
      );
    } catch (err: unknown) {
      return respondWithInternalError(c, "SnippetsPageController.downloadSnippet", err);
    }
  },

  // POST /api/snippets
  // application/json creates folder
  // multipart/form-data uploads file
  createSnippet: async (c: AppContext) => {
    try {
      const contentType = c.req.header("Content-Type") || "";
      const model = new SnippetsPageModel(c.env.DB, c.env.BUCKET, prefix);

      if (contentType.includes("application/json")) {
        const body = await c.req.json<{
          name?: string;
          parent_id?: number | null;
        }>();

        const name = body.name?.trim();

        if (!name) {
          return c.json({ error: "Name is required" }, 400);
        }

        const parentId = parseOptionalJsonParentId(body.parent_id);
        const folder = await model.createFolder(name, parentId);

        return c.json(
          {
            success: true,
            data: folder,
          },
          201,
        );
      }

      if (contentType.includes("multipart/form-data")) {
        const formData = await c.req.formData();

        const file = formData.get("file");
        const parentIdRaw = formData.get("parent_id");

        if (!file || !(file instanceof File)) {
          return c.json({ error: "No file provided" }, 400);
        }

        const parentId = parseOptionalParentId(parentIdRaw);
        const uploaded = await model.uploadFile(file, parentId);

        return c.json(
          {
            success: true,
            data: uploaded,
          },
          201,
        );
      }

      return c.json({ error: "Unsupported Content-Type" }, 415);
    } catch (err: unknown) {
      console.error("[SnippetsPageController.createSnippet]", err);
      return c.json({ error: "Creation failed" }, 500);
    }
  },

  // PATCH /api/snippets/:id
  updateSnippet: async (c: AppContext) => {
    try {
      const id = parsePositiveId(c.req.param("id"));

      if (!id) {
        return c.json({ error: "Invalid ID" }, 400);
      }

      const body = await c.req.json<{
        name?: string;
        parent_id?: number | null;
        display_order?: number;
      }>();

      const name = body.name === undefined ? undefined : body.name.trim();
      const parentId =
        body.parent_id === undefined
          ? undefined
          : parseOptionalJsonParentId(body.parent_id);
      const displayOrder = parseOptionalDisplayOrder(body.display_order);

      if (
        name === undefined &&
        parentId === undefined &&
        displayOrder === undefined
      ) {
        return c.json({ error: "No changes provided" }, 400);
      }

      if (name !== undefined && name.length === 0) {
        return c.json({ error: "Name cannot be empty" }, 400);
      }

      const model = new SnippetsPageModel(c.env.DB, c.env.BUCKET, prefix);

      const updated = await model.updateNode(id, {
        name,
        parent_id: parentId,
        display_order: displayOrder,
      });

      if (!updated) {
        return c.json({ error: "Snippet not found" }, 404);
      }

      return c.json({
        success: true,
        data: updated,
      });
    } catch (err: unknown) {
      console.error("[SnippetsPageController.updateSnippet]", err);
      return c.json({ error: "Update failed" }, 500);
    }
  },

  // DELETE /api/snippets/:id
  deleteSnippet: async (c: AppContext) => {
    try {
      const id = parsePositiveId(c.req.param("id"));

      if (!id) {
        return c.json({ error: "Invalid ID" }, 400);
      }

      const model = new SnippetsPageModel(c.env.DB, c.env.BUCKET, prefix);
      const deleted = await model.deleteNode(id);

      if (!deleted) {
        return c.json({ error: "Snippet not found" }, 404);
      }

      return c.json({
        success: true,
        message: `Snippet ${id} deleted.`,
      });
    } catch (err: unknown) {
      return respondWithInternalError(c, "SnippetsPageController.deleteSnippet", err);
    }
  },
});

// Backward-compatible export, like your MediaController.
export const SnippetsPageController = createSnippetsPageController("snippets/");
