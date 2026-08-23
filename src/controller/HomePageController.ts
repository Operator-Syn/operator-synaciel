// src/controller/HomePageController.ts
import type { Context } from "hono";
import type { Bindings } from "../Api";
import { HomePageModel } from "../model/HomePageModel";
import { respondWithInternalError } from "../utils/serverErrors";

export const HomePageController = {
  async handleHome(c: Context<{ Bindings: Bindings }>) {
    const model = new HomePageModel(c.env.DB);

    try {
      const data = await model.getHomePageData();
      return c.json(data);
    } catch (err: unknown) {
      return respondWithInternalError(c, "HomePageController.handleHome", err);
    }
  },
};
