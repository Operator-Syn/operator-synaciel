// workers/portfolio-api/src/controller/ProjectPage/GalleryController.ts
import type { Context } from "hono";
import type { Bindings } from "../../bindings";
import { GalleryModel } from "../../model/ProjectPage/GalleryModel";

export const GalleryController = {
  // List all gallery items for a specific project
  async listByProject(c: Context<{ Bindings: Bindings }>) {
    // Match the route param name
    const projectId = Number(c.req.param("projectId"));
    if (Number.isNaN(projectId)) return c.json({ error: "Invalid project ID" }, 400);

    const model = new GalleryModel(c.env.DB);
    const gallery = await model.listByProject(projectId);

    return c.json(gallery);
  },

  // Create a new gallery item
  async create(c: Context<{ Bindings: Bindings }>) {
    const body = await c.req.json();
    const model = new GalleryModel(c.env.DB);
    const newId = await model.create(body);
    const item = newId ? await model.getById(newId) : null;
    return c.json(item ?? { success: true }, item ? 201 : 200);
  },

  // Update a gallery item
  async update(c: Context<{ Bindings: Bindings }>) {
    const id = Number(c.req.param("id"));
    if (Number.isNaN(id)) return c.json({ error: "Invalid gallery item ID" }, 400);

    const body = await c.req.json();
    const model = new GalleryModel(c.env.DB);
    const item = await model.update(id, body);
    return c.json(item ?? { success: true });
  },

  // Delete a gallery item
  async delete(c: Context<{ Bindings: Bindings }>) {
    const id = Number(c.req.param("id"));
    if (Number.isNaN(id)) return c.json({ error: "Invalid gallery item ID" }, 400);

    const model = new GalleryModel(c.env.DB);
    await model.delete(id);
    return c.json({ success: true });
  },
};
