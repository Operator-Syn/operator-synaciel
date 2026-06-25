// src/controller/ProjectPage/ProjectsController.ts
import type { Context } from "hono";
import type { Bindings } from "../../Api";
import { ProjectsModel } from "../../model/ProjectPage/ProjectsModel";

export class ProjectsController {
  static async list(c: Context<{ Bindings: Bindings }>) {
    const model = new ProjectsModel(c.env.DB);
    const projects = await model.listAll();
    return c.json(projects);
  }

  static async get(c: Context<{ Bindings: Bindings }>) {
    const id = Number(c.req.param("id"));
    const model = new ProjectsModel(c.env.DB);
    const project = await model.getById(id);
    if (!project) return c.json({ error: "Project not found" }, 404);
    return c.json(project);
  }

  static async create(c: Context<{ Bindings: Bindings }>) {
    const body = await c.req.json();
    const model = new ProjectsModel(c.env.DB);
    const newId = await model.create(body);
    const project = newId ? await model.getById(newId) : null;
    return c.json(project ?? { success: true }, project ? 201 : 200);
  }

  static async update(c: Context<{ Bindings: Bindings }>) {
    const id = Number(c.req.param("id"));
    const body = await c.req.json();
    const model = new ProjectsModel(c.env.DB);
    await model.update(id, body);
    const project = await model.getById(id);
    return c.json(project ?? { success: true });
  }

  static async delete(c: Context<{ Bindings: Bindings }>) {
    const id = Number(c.req.param("id"));
    const model = new ProjectsModel(c.env.DB);
    await model.delete(id);
    return c.json({ success: true });
  }
}
