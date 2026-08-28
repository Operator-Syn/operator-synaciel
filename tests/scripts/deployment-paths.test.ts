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
