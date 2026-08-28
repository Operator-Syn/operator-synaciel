// workers/portfolio-api/src/controller/HomePage/SettingsController.ts
import type { Context } from "hono";
import type { Bindings } from "../../bindings";
import { SettingsModel } from "../../model/HomePage/SettingsModel";

export const SettingsController = {
  async list(c: Context<{ Bindings: Bindings }>) {
    const model = new SettingsModel(c.env.DB);
    return c.json(await model.list());
  },

  async create(c: Context<{ Bindings: Bindings }>) {
    const { key, value } = await c.req.json();
    const model = new SettingsModel(c.env.DB);
    return c.json(await model.create(key, value));
  },

  async update(c: Context<{ Bindings: Bindings }>) {
    const { key, value } = await c.req.json();
    const model = new SettingsModel(c.env.DB);
    return c.json(await model.update(key, value));
  },

  async delete(c: Context<{ Bindings: Bindings }>) {
    const key = c.req.param("key");
    if (!key) return c.json({ error: "Key is required" }, 400);
    const model = new SettingsModel(c.env.DB);
    await model.delete(key);
    return c.json({ success: true });
  },
};
