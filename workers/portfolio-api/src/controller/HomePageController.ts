// workers/portfolio-api/src/controller/HomePageController.ts
import type { Context } from "hono";
import type { Bindings } from "../bindings";
import { HomePageModel } from "../model/HomePageModel";
import { respondWithInternalError } from "../utils/serverErrors";

export const HomePageController = {
  async handleHome(c: Context<{ Bindings: Bindings }>) {
    const model = new HomePageModel(c.env.DB);

    try {
      const data = await model.getHomePageData();
      c.header("Cache-Control", "public, max-age=300, s-maxage=300");
      return c.json(data);
    } catch (err: unknown) {
      return respondWithInternalError(c, "HomePageController.handleHome", err);
    }
  },
};
