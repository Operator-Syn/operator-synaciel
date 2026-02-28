// src/controller/HomePage/SettingsController.ts
import type { Context } from "hono";
import { SettingsModel } from "../../model/HomePage/SettingsModel";
import type { Bindings } from "../../Api";

export class SettingsController {
  static async list(c: Context<{ Bindings: Bindings }>) {
    const model = new SettingsModel(c.env.DB);
    return c.json(await model.list());
  }

  static async create(c: Context<{ Bindings: Bindings }>) {
    const { key, value } = await c.req.json();
    const model = new SettingsModel(c.env.DB);
    await model.create(key, value);
    return c.json({ success: true });
  }

  static async update(c: Context<{ Bindings: Bindings }>) {
    const { key, value } = await c.req.json();
    const model = new SettingsModel(c.env.DB);
    await model.update(key, value);
    return c.json({ success: true });
  }

  static async delete(c: Context<{ Bindings: Bindings }>) {
    const key = c.req.param("key");
    const model = new SettingsModel(c.env.DB);
    await model.delete(key);
    return c.json({ success: true });
  }
}
