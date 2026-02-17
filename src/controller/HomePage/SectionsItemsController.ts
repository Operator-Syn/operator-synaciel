// src/controller/HomePage/SectionItemsController.ts
import type { Context } from "hono";
import { SectionItemsModel } from "../../model/HomePage/SectionItemsModel";
import type { Bindings } from "../../Api";

export class SectionItemsController {
  static async list(c: Context<{ Bindings: Bindings }>) {
    const sectionId = Number(c.req.param("sectionId"));
    const model = new SectionItemsModel(c.env.DB);
    return c.json(await model.list(sectionId));
  }

  static async create(c: Context<{ Bindings: Bindings }>) {
    const { sectionId, label, content, image_url, target_url, order } = await c.req.json();
    const model = new SectionItemsModel(c.env.DB);
    await model.create(sectionId, label, content, image_url, target_url, order);
    return c.json({ success: true });
  }

  static async update(c: Context<{ Bindings: Bindings }>) {
    const { id, label, content, image_url, target_url } = await c.req.json();
    const model = new SectionItemsModel(c.env.DB);
    await model.update(id, label, content, image_url, target_url);
    return c.json({ success: true });
  }

  static async delete(c: Context<{ Bindings: Bindings }>) {
    const id = Number(c.req.param("id"));
    const model = new SectionItemsModel(c.env.DB);
    await model.delete(id);
    return c.json({ success: true });
  }
}
