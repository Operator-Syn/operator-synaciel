// src/controller/HomePage/ProfileController.ts
import type { Context } from "hono";
import { ProfileModel } from "../../model/HomePage/ProfileModel";
import type { Bindings } from "../../Api";

export class ProfileController {
  static async list(c: Context<{ Bindings: Bindings }>) {
    const model = new ProfileModel(c.env.DB);
    return c.json(await model.list());
  }

  static async create(c: Context<{ Bindings: Bindings }>) {
    // FIX: Look for display_order instead of order to match the frontend state
    const { label, value, display_order } = await c.req.json();
    const model = new ProfileModel(c.env.DB);
    await model.create(label, value, display_order ?? 0);
    return c.json({ success: true });
  }

  static async update(c: Context<{ Bindings: Bindings }>) {
    // ADDED: Extract display_order from the incoming JSON
    const { label, value, display_order } = await c.req.json();
    const model = new ProfileModel(c.env.DB);
    // Pass it to the model
    await model.update(label, value, display_order ?? 0);
    return c.json({ success: true });
  }

  static async delete(c: Context<{ Bindings: Bindings }>) {
    // Note: ensure your useAdminHomeData.ts wraps the label in encodeURIComponent(label) 
    // when making the DELETE request, otherwise labels with spaces will 404!
    const label = c.req.param("label");
    const model = new ProfileModel(c.env.DB);
    await model.delete(label);
    return c.json({ success: true });
  }
}