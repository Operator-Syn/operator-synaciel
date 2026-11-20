import { defineConfig, devices } from "playwright/test";

/**
 * Verification for the Cloudflare Pages runtime.
 *
 * The default `playwright.config.ts` starts the Vite dev server and requires a
 * Google auth state. The metadata behaviour this suite covers only exists when
 * the Pages Function runs — it is the Function that rewrites the head — so the
 * server here is `wrangler pages dev` against the built `dist`.
 */
const PORT = 4319;
const baseURL = `http://127.0.0.1:${PORT}`;
const apiUrl = process.env.VITE_API_URL ?? "https://personal-portfolio.syn-forge.com/api";
const chromiumExecutable = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;

export default defineConfig({
  testDir: "./tests/pages",
  testMatch: "**/*.pages.spec.ts",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    launchOptions: chromiumExecutable ? { executablePath: chromiumExecutable } : undefined,
  },
  webServer: {
    command: `npx --no-install wrangler pages dev dist --ip 127.0.0.1 --port ${PORT} --binding VITE_API_URL=${apiUrl}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
