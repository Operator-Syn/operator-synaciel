// src/controller/SnippetsPageController.ts
import type { Context } from "hono";
import { SnippetsPageModel } from "../model/SnippetsPageModel";
import type { Bindings } from "../Api";

export class SnippetsPageController {
  
  // GET /api/snippets/:id
  // Retrieves a specific file or folder metadata
  static async getSnippet(c: Context<{ Bindings: Bindings }>) {
    const id = Number(c.req.param('id'));
    if (isNaN(id)) return c.json({ error: "Invalid ID" }, 400);

    const model = new SnippetsPageModel(c.env.DB, c.env.BUCKET);
    try {
      const data = await model.getSnippetById(id);
      if (!data) return c.json({ error: "Snippet not found" }, 404);
      return c.json(data);
    } catch (err: unknown) {
      return c.json({ error: err instanceof Error ? err.message : "Fetch failed" }, 500);
    }
  }

  // GET /api/snippets
  // Retrieves the resource collection (Full Tree)
  static async getSnippets(c: Context<{ Bindings: Bindings }>) {
    const model = new SnippetsPageModel(c.env.DB, c.env.BUCKET);
    try {
      const data = await model.getFileTree();
      return c.json(data);
    } catch (err: unknown) {
      return c.json({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
    }
  }

  // GET /api/snippets/:id/content
  // Retrieves the actual file content (Download)
  static async downloadSnippet(c: Context<{ Bindings: Bindings }>) {
    const id = Number(c.req.param('id'));
    if (isNaN(id)) return c.json({ error: "Invalid ID" }, 400);

    const model = new SnippetsPageModel(c.env.DB, c.env.BUCKET);
    try {
      const result = await model.getFileContent(id);
      if (!result) return c.json({ error: "File not found or empty" }, 404);
      
      // We use a double cast (unknown -> ReadableStream) to bridge the definition 
      // mismatch between @cloudflare/workers-types and the standard DOM types Hono expects.
      return c.body(result.stream as unknown as ReadableStream, 200, result.headers);
    } catch (err: unknown) {
      return c.json({ error: err instanceof Error ? err.message : "Download failed" }, 500);
    }
  }

  // POST /api/snippets
  // Creates a new resource (File OR Folder)
  static async createSnippet(c: Context<{ Bindings: Bindings }>) {
    const model = new SnippetsPageModel(c.env.DB, c.env.BUCKET);
    const contentType = c.req.header('Content-Type') || '';

    try {
      if (contentType.includes('application/json')) {
        const { name, parent_id } = await c.req.json<{ name: string; parent_id?: number }>();
        if (!name) return c.json({ error: "Name is required" }, 400);
        const newFolder = await model.createFolder(name, parent_id || null);
        return c.json(newFolder, 201);
      } 
      else if (contentType.includes('multipart/form-data')) {
        const formData = await c.req.parseBody();
        const file = formData['file'];
        const parentIdRaw = formData['parent_id'];
        if (!(file instanceof File)) return c.json({ error: "Invalid file" }, 400);
        const parentId = parentIdRaw ? Number(parentIdRaw) : null;
        const newFile = await model.uploadFile(file, parentId);
        return c.json(newFile, 201);
      }
      else {
        return c.json({ error: "Unsupported Content-Type" }, 415);
      }
    } catch (err: unknown) {
      return c.json({ error: err instanceof Error ? err.message : "Creation failed" }, 500);
    }
  }

  // PATCH /api/snippets/:id
  // Updates metadata (Rename or Move)
  static async updateSnippet(c: Context<{ Bindings: Bindings }>) {
    const id = Number(c.req.param('id'));
    if (isNaN(id)) return c.json({ error: "Invalid ID" }, 400);

    const model = new SnippetsPageModel(c.env.DB, c.env.BUCKET);
    try {
      const { name, parent_id } = await c.req.json<{ name?: string; parent_id?: number | null }>();
      
      if (name === undefined && parent_id === undefined) {
        return c.json({ error: "No changes provided" }, 400);
      }

      const updatedNode = await model.updateNode(id, { name, parent_id });
      return c.json(updatedNode);

    } catch (err: unknown) {
      return c.json({ error: err instanceof Error ? err.message : "Update failed" }, 500);
    }
  }

  // DELETE /api/snippets/:id
  static async deleteSnippet(c: Context<{ Bindings: Bindings }>) {
    const id = Number(c.req.param('id'));
    if (isNaN(id)) return c.json({ error: "Invalid ID" }, 400);

    const model = new SnippetsPageModel(c.env.DB, c.env.BUCKET);
    try {
      await model.deleteNode(id);
      return c.json({ success: true }, 200);
    } catch (err: unknown) {
      return c.json({ error: err instanceof Error ? err.message : "Deletion failed" }, 500);
    }
  }
}