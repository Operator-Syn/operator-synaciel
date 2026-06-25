// src/controller/HomePage/SectionsController.ts
import type { Context } from "hono";
import { SectionsModel } from "../../model/HomePage/SectionsModel";
import type { Bindings } from "../../Api";

export class SectionsController {
  static async list(c: Context<{ Bindings: Bindings }>) {
    const model = new SectionsModel(c.env.DB);
    return c.json(await model.list());
  }

  static async create(c: Context<{ Bindings: Bindings }>) {
    const { title, section_type, order } = await c.req.json();
    const model = new SectionsModel(c.env.DB);
    return c.json(await model.create(title, section_type, order));
  }

  static async update(c: Context<{ Bindings: Bindings }>) {
    const { id, title, section_type, display_order } = await c.req.json();
    const model = new SectionsModel(c.env.DB);
    return c.json(await model.update(id, title, section_type, display_order ?? 0));
  }

  static async delete(c: Context<{ Bindings: Bindings }>) {
    const id = Number(c.req.param("id"));
    const model = new SectionsModel(c.env.DB);
    await model.delete(id);
    return c.json({ success: true });
  }
}
