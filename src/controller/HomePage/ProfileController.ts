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
    const { label, value, order } = await c.req.json();
    const model = new ProfileModel(c.env.DB);
    await model.create(label, value, order);
    return c.json({ success: true });
  }

  static async update(c: Context<{ Bindings: Bindings }>) {
    const { label, value } = await c.req.json();
    const model = new ProfileModel(c.env.DB);
    await model.update(label, value);
    return c.json({ success: true });
  }

  static async delete(c: Context<{ Bindings: Bindings }>) {
    const label = c.req.param("label");
    const model = new ProfileModel(c.env.DB);
    await model.delete(label);
    return c.json({ success: true });
  }
}
