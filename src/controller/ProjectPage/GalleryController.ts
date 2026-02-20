// src/controller/ProjectPage/GalleryController.ts
import type { Context } from "hono";
import type { Bindings } from "../../Api";
import { GalleryModel } from "../../model/ProjectPage/GalleryModel";

export class GalleryController {
  // List all gallery items for a specific project
  static async listByProject(c: Context<{ Bindings: Bindings }>) {
    // Match the route param name
    const projectId = Number(c.req.param("projectId")); 
    if (isNaN(projectId)) return c.json({ error: "Invalid project ID" }, 400);

    const model = new GalleryModel(c.env.DB);
    const gallery = await model.listByProject(projectId);

    return c.json(gallery);
  }

  // Create a new gallery item
  static async create(c: Context<{ Bindings: Bindings }>) {
    const body = await c.req.json();
    const model = new GalleryModel(c.env.DB);
    await model.create(body);
    return c.json({ success: true });
  }

  // Update a gallery item
  static async update(c: Context<{ Bindings: Bindings }>) {
    const id = Number(c.req.param("id"));
    if (isNaN(id)) return c.json({ error: "Invalid gallery item ID" }, 400);

    const body = await c.req.json();
    const model = new GalleryModel(c.env.DB);
    await model.update(id, body);
    return c.json({ success: true });
  }

  // Delete a gallery item
  static async delete(c: Context<{ Bindings: Bindings }>) {
    const id = Number(c.req.param("id"));
    if (isNaN(id)) return c.json({ error: "Invalid gallery item ID" }, 400);

    const model = new GalleryModel(c.env.DB);
    await model.delete(id);
    return c.json({ success: true });
  }
}
