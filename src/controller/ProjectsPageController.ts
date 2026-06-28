// src/controller/ProjectsPageController.ts
import type { Context } from "hono";
import { ProjectsPageModel } from "../model/ProjectsPageModel";
import type { Bindings } from "../Api";
import { respondWithInternalError } from "../utils/serverErrors";

export class ProjectsPageController {
  static async handleProjects(c: Context<{ Bindings: Bindings }>) {
    const model = new ProjectsPageModel(c.env.DB);
    
    try {
      const data = await model.getAllProjects();
      return c.json(data);
    } catch (err: unknown) {
      return respondWithInternalError(c, "ProjectsPageController.handleProjects", err);
    }
  }
}
