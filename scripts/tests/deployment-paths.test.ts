import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { test } from "node:test";

const repositoryRoot = resolve(import.meta.dirname, "../..");
const legacyPackageName = "gh" + "-pages";
const legacyDomain = ["operator-eury", "github", "io"].join(".");
const legacyRootCommand = /\bnpm run deploy(?:\s|`|$)/;
const ignoredDirectories = new Set([".git", "dist", "node_modules", ".venv", ".wrangler"]);
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
  return name === "Dockerfile" || name === ".gitignore" || textExtensions.has(extname(name));
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
  const publicAuthDeployScript = await readFile(
    join(repositoryRoot, "scripts/deploy-public-auth.mjs"),
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
  assert.equal(
    rootPackage.scripts?.["deploy:portfolio-agent"],
    'wrangler deploy --env="" --config workers/portfolio-agent/wrangler.toml',
  );
  assert.equal(
    rootPackage.scripts?.["migrate:public-auth"],
    "node scripts/deploy-public-auth.mjs --migrate-only",
  );
  assert.equal(rootPackage.scripts?.["deploy:public-auth"], "node scripts/deploy-public-auth.mjs");
  assert.equal(
    rootPackage.scripts?.["deploy:portfolio-assistant"],
    "npm run deploy:portfolio-agent -- --dry-run && npm run deploy:public-auth -- --dry-run && npm run migrate:public-auth && npm run deploy:portfolio-agent && npm run deploy:public-auth -- --skip-migration",
  );

  assert.equal(webPackage.scripts?.["pages:dev"], "wrangler pages dev dist");
  assert.equal(mcpPackage.scripts?.deploy, 'wrangler deploy --config wrangler.toml --env=""');
  assert.match(deploymentDocumentation, /Cloudflare Pages Git integration/);
  assert.match(deploymentDocumentation, /wrangler pages deploy/);

  assert.ok(deploymentWorkflow.includes("on:\n  push:\n    branches:\n      - main"));
  assert.ok(
    deploymentWorkflow.includes("workflow_dispatch:"),
    "Deployment workflow must expose a manual trigger for a forced redeploy",
  );
  assert.match(
    deploymentWorkflow,
    /force:\n\s+description: [^\n]+\n\s+type: boolean/,
    "The manual trigger must accept a force input",
  );
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

  // Deploy gate: a Worker deploys when its workspace differs from that Worker's
  // last successful deploy, so a deploy that failed is retried by a later run.
  assert.ok(
    deploymentWorkflow.includes("node scripts/detect-deploy-targets.mjs"),
    "Deployment workflow must run the deploy-target gate",
  );
  assert.match(deploymentWorkflow, /\n\s+id: targets\n/);
  assert.ok(
    deploymentWorkflow.includes("node scripts/detect-deploy-targets.mjs --tags"),
    "Deployment workflow must fetch the ledger tags the gate compares against",
  );
  assert.match(
    deploymentWorkflow,
    /FORCE_DEPLOY: \$\{\{ github\.event\.inputs\.force \|\| 'false' \}\}/,
    "The gate must take its force flag from the manual trigger, not from a constant",
  );
  assert.doesNotMatch(
    deploymentWorkflow,
    /FORCE_DEPLOY:\s*'?true'?/,
    "A hardcoded force flag would redeploy every Worker on every run",
  );
  for (const flag of ["api", "mcp", "agent", "public_auth"]) {
    assert.ok(
      deploymentWorkflow.includes(`${flag}: \${{ steps.targets.outputs.${flag} }}`),
      `Validate job must expose the ${flag} deploy flag as a job output`,
    );
  }
  const mainGuard = "github.ref == 'refs/heads/main'";
  for (const [job, flag, chained] of [
    ["deploy-api", "api", false],
    ["deploy-mcp", "mcp", true],
    ["deploy-agent", "agent", true],
    ["deploy-public-auth", "public_auth", true],
  ] as const) {
    const expectedCondition =
      `${mainGuard} && needs.validate.outputs.${flag} != 'false'` +
      (chained ? " && !failure() && !cancelled()" : "");
    assert.ok(
      deploymentWorkflow.includes(`    if: ${expectedCondition}\n`),
      `${job} must obey the ${flag} deploy flag, and must not collapse the deploy chain`,
    );
  }
  assert.doesNotMatch(
    deploymentWorkflow,
    /needs\.validate\.outputs\.\w+ == 'true'/,
    "Deploy gates must skip only on an explicit false flag so gate failures still deploy",
  );
  // A Worker that never advances its own ledger tag would redeploy on every run.
  for (const [job, tag] of [
    ["deploy-api", "deploy-portfolio-api"],
    ["deploy-mcp", "deploy-portfolio-mcp"],
    ["deploy-agent", "deploy-portfolio-agent"],
    ["deploy-public-auth", "deploy-portfolio-public-auth"],
  ] as const) {
    assert.ok(
      deploymentWorkflow.includes(`git tag --force ${tag} "$GITHUB_SHA"`),
      `${job} must record a successful deploy in the ${tag} ledger tag`,
    );
    assert.ok(
      deploymentWorkflow.includes(`git push --force origin "refs/tags/${tag}"`),
      `${job} must publish the ${tag} ledger tag for later runs to read`,
    );
  }
  assert.equal(
    deploymentWorkflow.match(/contents: write/g)?.length ?? 0,
    4,
    "only the deploy jobs may write the ledger tags",
  );
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
    "npm exec -- tsx --tsconfig tsconfig.tests.json --test scripts/tests/deployment-paths.test.ts",
    "npm exec -- tsx --tsconfig tsconfig.tests.json --test scripts/tests/detect-deploy-targets.test.ts",
    "npm run docs:check",
    "npm run test:tooling",
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
  assert.match(deploymentDocumentation, /npm run deploy:portfolio-assistant/);
  assert.match(publicAuthDeployScript, /--migrate-only/);
  assert.match(publicAuthDeployScript, /--skip-migration/);
  assert.match(publicAuthDeployScript, /--dry-run/);
  assert.match(publicAuthDeployScript, /input: "y\\n"/);
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
    assert.doesNotMatch(
      contents,
      legacyRootCommand,
      `Legacy root deploy command remains in ${file}`,
    );
  }
});
