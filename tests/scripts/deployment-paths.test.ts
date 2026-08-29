import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { test } from "node:test";

const repositoryRoot = resolve(import.meta.dirname, "../..");
const legacyPackageName = "gh" + "-pages";
const legacyDomain = ["operator-eury", "github", "io"].join(".");
const legacyRootCommand = ["npm", "run", "deploy"].join(" ");
const ignoredDirectories = new Set([
  ".git",
  "dist",
  "graphify-out",
  "node_modules",
  ".venv",
  ".wrangler",
]);
const textExtensions = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".lock",
  ".mjs",
  ".md",
  ".toml",
  ".ts",
  ".tsx",
  ".txt",
  ".yaml",
  ".yml",
]);

type PackageManifest = {
  readonly homepage?: string;
  readonly scripts?: Record<string, string>;
  readonly dependencies?: Record<string, string>;
  readonly devDependencies?: Record<string, string>;
};

function isTextPath(path: string): boolean {
  const name = path.split("/").at(-1) ?? path;
  return (
    name === "Dockerfile" ||
    name === "Pipfile" ||
    name === ".gitignore" ||
    textExtensions.has(extname(name))
  );
}

async function collectTextFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (ignoredDirectories.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectTextFiles(path)));
    } else if (entry.isFile() && isTextPath(path)) {
      files.push(path);
    }
  }

  return files.sort();
}

test("keeps the legacy root GitHub Pages deployment retired", async () => {
  const rootPackage = JSON.parse(
    await readFile(join(repositoryRoot, "package.json"), "utf8"),
  ) as PackageManifest;
  const webPackage = JSON.parse(
    await readFile(join(repositoryRoot, "apps/portfolio-web/package.json"), "utf8"),
  ) as PackageManifest;
  const mcpPackage = JSON.parse(
    await readFile(join(repositoryRoot, "workers/portfolio-mcp/package.json"), "utf8"),
  ) as PackageManifest;
  const lockfile = await readFile(join(repositoryRoot, "package-lock.json"), "utf8");
  const deploymentDocumentation = await readFile(
    join(repositoryRoot, "docs/operations/deployment.md"),
    "utf8",
  );
  const deploymentWorkflow = await readFile(
    join(repositoryRoot, ".github/workflows/deploy-production-workers.yml"),
    "utf8",
  );
  const publicAuthWorkerConfiguration = await readFile(
    join(repositoryRoot, "workers/portfolio-public-auth/wrangler.toml"),
    "utf8",
  );
  const agentWorkerConfiguration = await readFile(
    join(repositoryRoot, "workers/portfolio-agent/wrangler.toml"),
    "utf8",
  );

  assert.equal(rootPackage.homepage, undefined);
  assert.equal(rootPackage.scripts?.predeploy, undefined);
  assert.equal(rootPackage.scripts?.deploy, undefined);
  assert.equal(rootPackage.dependencies?.[legacyPackageName], undefined);
  assert.equal(rootPackage.devDependencies?.[legacyPackageName], undefined);
  assert.equal(lockfile.includes(legacyPackageName), false);
  assert.equal(
    rootPackage.scripts?.["mcp:portfolio:deploy"],
    "npm run deploy --workspace=@syn-forge/portfolio-mcp --",
  );

  assert.equal(webPackage.scripts?.["pages:dev"], "wrangler pages dev dist");
  assert.equal(mcpPackage.scripts?.deploy, 'wrangler deploy --config wrangler.toml --env=""');
  assert.match(deploymentDocumentation, /Cloudflare Pages Git integration/);
  assert.match(deploymentDocumentation, /wrangler pages deploy/);

  assert.ok(deploymentWorkflow.includes("on:\n  push:\n    branches:\n      - main"));
  assert.doesNotMatch(deploymentWorkflow, /workflow_dispatch:/);
  assert.equal(
    deploymentWorkflow.match(/if: github\.ref == 'refs\/heads\/main'/g)?.length ?? 0,
    5,
    "all workflow jobs must be restricted to main",
  );
  assert.match(deploymentWorkflow, /group: production-deploy/);
  assert.match(deploymentWorkflow, /cancel-in-progress: false/);
  assert.match(deploymentWorkflow, /deploy-api:\n[\s\S]*?needs: validate/);
  assert.match(deploymentWorkflow, /deploy-mcp:\n[\s\S]*?needs: deploy-api/);
  assert.match(deploymentWorkflow, /deploy-public-auth:\n[\s\S]*?needs: deploy-agent/);
  assert.match(deploymentWorkflow, /deploy-agent:\n[\s\S]*?needs: deploy-mcp/);
  assert.equal(deploymentWorkflow.match(/cloudflare\/wrangler-action@v3/g)?.length ?? 0, 4);
  assert.ok(
    deploymentWorkflow.includes("secrets.CLOUDFLARE_API_TOKEN"),
    "Cloudflare API token secret is not configured",
  );
  assert.ok(
    deploymentWorkflow.includes("secrets.CLOUDFLARE_ACCOUNT_ID"),
    "Cloudflare account ID secret is not configured",
  );
  for (const command of [
    "npm ci",
    "npm run typecheck",
    "npm run lint",
    "npm run check:biome",
    "npm run build",
    "npm run test --workspace=@syn-forge/portfolio-web --",
    "npm run test --workspace=@syn-forge/portfolio-api --",
    "npm run test:portfolio-mcp",
    "npm run public-auth:check",
    "npm run test:public-auth",
    "npm run portfolio-agent:check",
    "npm run test:portfolio-agent",
    "npm exec -- tsx --tsconfig tsconfig.tests.json --test tests/scripts/deployment-paths.test.ts",
    "npm run docs:check",
    "npm run mcp:check",
    "npm run mcp:portfolio:check",
  ]) {
    assert.ok(deploymentWorkflow.includes(command), `Deployment workflow omits ${command}`);
  }
  for (const configPath of [
    "workers/portfolio-api/wrangler.toml",
    "workers/portfolio-mcp/wrangler.toml",
    "workers/portfolio-public-auth/wrangler.toml",
    "workers/portfolio-agent/wrangler.toml",
  ]) {
    assert.ok(deploymentWorkflow.includes(configPath), `Deployment workflow omits ${configPath}`);
  }
  assert.ok(
    deploymentWorkflow.includes(
      "npx wrangler deploy --dry-run --config workers/portfolio-api/wrangler.toml",
    ),
  );
  assert.ok(
    deploymentWorkflow.includes(
      'npx wrangler deploy --dry-run --env="" --config workers/portfolio-mcp/wrangler.toml',
    ),
  );
  assert.ok(
    deploymentWorkflow.includes("command: deploy --config workers/portfolio-api/wrangler.toml"),
  );
  assert.ok(
    deploymentWorkflow.includes(
      'command: deploy --env="" --config workers/portfolio-mcp/wrangler.toml',
    ),
  );
  assert.ok(
    deploymentWorkflow.includes(
      'npx wrangler deploy --dry-run --env="" --config workers/portfolio-public-auth/wrangler.toml',
    ),
  );
  assert.ok(
    deploymentWorkflow.includes(
      'npx wrangler deploy --dry-run --env="" --config workers/portfolio-agent/wrangler.toml',
    ),
  );
  assert.ok(deploymentWorkflow.includes('wranglerVersion: "4.125.0"'));
  assert.doesNotMatch(deploymentWorkflow, /wrangler pages deploy/);
  assert.doesNotMatch(deploymentWorkflow, /db:migrations:(?:apply|list)/);
  assert.doesNotMatch(deploymentWorkflow, /auth-worker/);
  assert.match(deploymentDocumentation, /deploy-production-workers\.yml/);
  assert.match(deploymentDocumentation, /CLOUDFLARE_API_TOKEN/);
  assert.match(
    publicAuthWorkerConfiguration,
    /\[\[routes\]\]\npattern = "public-auth\.syn-forge\.com"\ncustom_domain = true/,
  );
  assert.match(
    agentWorkerConfiguration,
    /\[\[routes\]\]\npattern = "assistant\.syn-forge\.com"\ncustom_domain = true/,
  );
  assert.match(
    publicAuthWorkerConfiguration,
    /\[env\.local\]\nname = "portfolio-public-auth-local"\ncompatibility_date = "2026-08-27"\nroutes = \[\]/,
  );
  assert.match(
    publicAuthWorkerConfiguration,
    /BROWSER_ORIGINS = "https:\/\/syn-forge\.com,https:\/\/www\.syn-forge\.com,http:\/\/localhost:5173"/,
  );
  assert.match(
    publicAuthWorkerConfiguration,
    /GOOGLE_REDIRECT_URI = "http:\/\/localhost:8787\/oauth\/google\/callback"/,
  );
  assert.match(
    agentWorkerConfiguration,
    /\[env\.local\]\nname = "portfolio-agent-local"\ncompatibility_date = "2026-08-27"\nroutes = \[\]/,
  );
  assert.match(
    agentWorkerConfiguration,
    /BROWSER_ORIGINS = "https:\/\/syn-forge\.com,https:\/\/www\.syn-forge\.com,http:\/\/localhost:5173"/,
  );
  assert.match(publicAuthWorkerConfiguration, /SESSION_COOKIE_SAME_SITE = "None"/);
  assert.match(publicAuthWorkerConfiguration, /service = "portfolio-agent-local"/);

  const textFiles = await collectTextFiles(repositoryRoot);
  for (const file of textFiles) {
    const contents = await readFile(file, "utf8");
    assert.equal(
      contents.includes(legacyPackageName),
      false,
      `Legacy package reference remains in ${file}`,
    );
    assert.equal(
      contents.includes(legacyDomain),
      false,
      `Legacy GitHub Pages domain remains in ${file}`,
    );
  }

  const documentationFiles = textFiles.filter(
    (file) =>
      file === join(repositoryRoot, "README.md") ||
      file.startsWith(`${join(repositoryRoot, "docs")}/`),
  );
  for (const file of documentationFiles) {
    const contents = await readFile(file, "utf8");
    assert.equal(
      contents.includes(legacyRootCommand),
      false,
      `Legacy root deploy command remains in ${file}`,
    );
  }
});
