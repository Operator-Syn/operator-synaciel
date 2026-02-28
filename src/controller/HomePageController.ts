// src/controller/HomePageController.ts
import type { Context } from "hono";
import { HomePageModel } from "../model/HomePageModel";
import type { Bindings } from "../Api";

export class HomePageController {
  static async handleHome(c: Context<{ Bindings: Bindings }>) {
    const model = new HomePageModel(c.env.DB);
    
    try {
      const data = await model.getHomePageData();
      return c.json(data); 
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      return c.json({ error: errorMessage }, 500);
    }
  }
}