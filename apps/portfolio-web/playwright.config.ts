import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "playwright/test";

const appRoot = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(appRoot, "../..");
const authStatePath = resolve(repositoryRoot, "playwright/.auth/google.json");

if (!existsSync(authStatePath)) {
  throw new Error(
    "Missing Playwright Google auth state at playwright/.auth/google.json. " +
      "Run `npx playwright codegen --save-storage=playwright/.auth/google.json http://localhost:5173/ai` from the repository root.",
  );
}

export default defineConfig({
  testDir: resolve(repositoryRoot, "tests/portfolio-web"),
  testMatch: "**/*.spec.ts",
  outputDir: resolve(repositoryRoot, "playwright/.artifacts"),
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
