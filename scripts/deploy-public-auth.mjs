import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PUBLIC_AUTH_CONFIG = "workers/portfolio-public-auth/wrangler.toml";
const WRANGLER_COMMAND = process.platform === "win32" ? "wrangler.cmd" : "wrangler";

export function buildMigrationInvocation() {
  return {
    args: [
      "d1",
      "migrations",
      "apply",
      "portfolio-agent-auth",
      "--remote",
      "--config",
      PUBLIC_AUTH_CONFIG,
    ],
    input: "y\n",
  };
}

export function shouldApplyMigration(args = []) {
  return (
    !args.includes("--dry-run") &&
    !args.includes("--skip-migration") &&
    !args.includes("--migrate-only")
  );
}

export function buildDeploymentInvocation(args = []) {
  return {
    args: [
      "deploy",
      "--env=",
      "--config",
      PUBLIC_AUTH_CONFIG,
      ...args.filter((arg) => arg !== "--skip-migration" && arg !== "--migrate-only"),
    ],
    input: "",
  };
}

export function runWrangler({ args, input = "" }) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(WRANGLER_COMMAND, args, {
      stdio: ["pipe", "inherit", "inherit"],
    });
    child.once("error", reject);
    child.once("close", (code, signal) => {
      if (code === 0) {
        resolvePromise();
        return;
      }
      reject(new Error(`wrangler exited with ${signal ?? code}`));
    });
    child.stdin.end(input);
  });
}

export async function deployPublicAuth(args = process.argv.slice(2), run = runWrangler) {
  if (args.includes("--migrate-only")) {
    await run(buildMigrationInvocation());
    return;
  }
  if (shouldApplyMigration(args)) {
    await run(buildMigrationInvocation());
  }
  await run(buildDeploymentInvocation(args));
}

const isMain =
  process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isMain) {
  deployPublicAuth().catch((error) => {
    const errorType = error instanceof Error ? error.name : typeof error;
    console.error(`[deploy:public-auth] failed (${errorType})`);
    process.exitCode = 1;
  });
}
