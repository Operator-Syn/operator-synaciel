import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { assertPagesBuildHasTurnstileSiteKey } from "./src/components/portfolioAssistant/portfolioAssistantBuildGuard.ts";

const appRoot = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(appRoot, "../..");

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, repositoryRoot, "");
  assertPagesBuildHasTurnstileSiteKey({
    isPagesBuild: process.env.CF_PAGES === "1",
    mode,
    siteKey: env.VITE_TURNSTILE_SITE_KEY,
  });

  return {
    root: appRoot,
    envDir: repositoryRoot,
    plugins: [react(), tailwindcss()],
    base: "/",
    server: {
      host: true,
      port: 5173,
      strictPort: true,
      allowedHosts: [
        "yashindo.local",
        "dev.syn-forge.com",
        "yashindo.syn-forge.netbird",
        "portfolio.yashindo.syn-forge.com",
        "hiraeth.internal.netbird-network",
      ],
    },
    build: {
      chunkSizeWarningLimit: 1500,
      sourcemap: true,
      rollupOptions: {},
    },
  };
});
