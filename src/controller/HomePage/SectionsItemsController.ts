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
    try {
      const body = await c.req.json();
      console.log("[CONTROLLER DEBUG] INCOMING PAYLOAD:", JSON.stringify(body));

      const model = new SectionItemsModel(c.env.DB);
      
      const sectionId = body.sectionId ?? body.section_id;
      const order = body.order ?? body.display_order ?? 0;

      if (sectionId === undefined) {
        return c.json({ error: "sectionId is required", body_received: body }, 400);
      }

      await model.create(
        Number(sectionId), 
        body.label ?? null, 
        body.content ?? null, 
        body.image_url ?? null, 
        body.target_url ?? null, 
        Number(order)
      );

      return c.json({ success: true });
    } catch (err: any) {
      return c.json({ error: "Create failed", message: err.message }, 500);
    }
  }

  static async update(c: Context<{ Bindings: Bindings }>) {
    try {
      const body = await c.req.json();
      console.log("[CONTROLLER DEBUG] UPDATE PAYLOAD:", JSON.stringify(body));

      const model = new SectionItemsModel(c.env.DB);
      const id = body.id;
      
      // EXTRACT order from the body sent by handleDragEnd
      const order = body.display_order ?? body.order ?? 0;

      if (!id) {
        return c.json({ error: "id is required for update" }, 400);
      }

      await model.update(
        Number(id), 
        body.label ?? null, 
        body.content ?? null, 
        body.image_url ?? null, 
        body.target_url ?? null,
        Number(order) // PASS order to model
      );

      return c.json({ success: true });
    } catch (err: any) {
      return c.json({ error: "Update failed", message: err.message }, 500);
    }
  }

  static async delete(c: Context<{ Bindings: Bindings }>) {
    try {
      const id = Number(c.req.param("id"));
      const model = new SectionItemsModel(c.env.DB);
      await model.delete(id);
      return c.json({ success: true });
    } catch (err: any) {
      return c.json({ error: "Delete failed", message: err.message }, 500);
    }
  }
}
