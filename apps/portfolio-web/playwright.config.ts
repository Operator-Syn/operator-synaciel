import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "playwright/test";

const appRoot = dirname(fileURLToPath(import.meta.url));
const playwrightStateRoot = resolve(appRoot, "playwright");
const authStatePath = resolve(playwrightStateRoot, ".auth/google.json");

if (!existsSync(authStatePath)) {
  throw new Error(
    "Missing Playwright Google auth state at apps/portfolio-web/playwright/.auth/google.json. " +
      "Run `npx playwright codegen --save-storage=playwright/.auth/google.json http://localhost:5173/ai` from apps/portfolio-web.",
  );
}

export default defineConfig({
  testDir: resolve(appRoot, "tests"),
  testMatch: "**/*.spec.ts",
  // The Pages-runtime spec needs `wrangler pages dev` (the Function owns the head), so it runs
  // under `playwright.pages.config.ts` and must not be collected against the Vite dev server.
  testIgnore: "**/*.pages.spec.ts",
  outputDir: resolve(playwrightStateRoot, ".artifacts"),
  reporter: "line",
  workers: 1,
  use: {
    baseURL: process.env.E2E_BASE_URL?.trim() || "http://localhost:5173",
    storageState: authStatePath,
    trace: "off",
  },
  projects: [
    { name: "phone-small", use: { viewport: { width: 320, height: 568 }, hasTouch: true } },
    { name: "phone", use: { viewport: { width: 390, height: 844 }, hasTouch: true } },
    { name: "phone-tall", use: { viewport: { width: 412, height: 915 }, hasTouch: true } },
    { name: "phone-landscape", use: { viewport: { width: 667, height: 375 }, hasTouch: true } },
    { name: "tablet", use: { viewport: { width: 768, height: 1024 }, hasTouch: true } },
    { name: "desktop", use: { viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
    command: "npm run dev -- --host 127.0.0.1",
    url: "http://localhost:5173",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
